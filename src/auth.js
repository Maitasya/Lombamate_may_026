/* =========================================================
   LombaMate - src/auth.js
   MODUL KEAMANAN SERVER (versi DATABASE - PostgreSQL/Neon)

   Perubahan dari versi file-JSON:
   - Akun  : tabel User  (password hash bcrypt, plaintext TIDAK ada)
   - Sesi  : tabel Session; id = SHA-256 dari token cookie
             (token asli tidak pernah disimpan di database,
             jadi bocornya isi tabel tidak bisa dipakai masuk)
   - Reset password: tabel PasswordReset, token sekali pakai
             berlaku 30 menit, juga disimpan dalam bentuk hash

   Keamanan yang dirawat di sini:
   1. bcrypt = hashing password
   2. cookie httpOnly / SameSite=Lax / Secure (mulai saat
      NODE_ENV=production)
   3. Session fixation: SETIAP login/registrasi selalu membuat
      token BARU - token lama tidak pernah dipakai ulang
   4. Ganti password / reset password = mematikan semua sesi
      lama pengguna itu di perangkat lain
   5. Login gagal berlebih: 5x per (ip|username) = blokir
      5 menit, 20x gagal per ip = blokir 5 menit
   ========================================================= */
'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const COOKIE_NAME = 'lombamate_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;   // sesi berlaku 7 hari
const RESET_TTL_MS = 30 * 60 * 1000;              // token reset berlaku 30 menit
const BCRYPT_ROUNDS = 10;

/* ---------- Password (bcrypt) ---------- */

const hashPassword = (plain) => bcrypt.hashSync(String(plain), BCRYPT_ROUNDS);
const cocokPassword = (plain, hash) => bcrypt.compareSync(String(plain), hash || '');

/* ---------- Token & hash token ---------- */

// Token acak utk cookie; database hanya menyimpan SHA-256-nya
const tokenBaru = () => crypto.randomBytes(32).toString('hex');
const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

/* ---------- Cookie (HttpOnly, SameSite, Secure sesuai lingkungan) ---------- */

// NODE_ENV=production  -> cookie menambahkan atribut Secure (wajib https)
const diProduksi = process.env.NODE_ENV === 'production';

function aturCookie(res, token) {
  const bagian = [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
  ];
  if (diProduksi) bagian.push('Secure');
  res.setHeader('Set-Cookie', bagian.join('; '));
}

function cookieKosong(res) {
  const bagian = [`${COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (diProduksi) bagian.push('Secure');
  res.setHeader('Set-Cookie', bagian.join('; '));
}

/* ---------- Baca token dari header cookie ---------- */

function tokenDariRequest(req) {
  const header = String(req.headers.cookie || '');
  const awal = header.indexOf(COOKIE_NAME + '=');
  if (awal === -1) return null;
  const akhir = header.indexOf(';', awal);
  const token = header.slice(awal + COOKIE_NAME.length + 1, akhir === -1 ? undefined : akhir).trim();
  return token || null;
}

/* ---------- Membuat / menghapus sesi ---------- */

// Setiap pemanggilan membuat token BARU (anti session fixation)
async function createSession(res, user) {
  const token = tokenBaru();

  // bersihkan sesi kadaluarsa milik siapa pun (pembersihan hemat)
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });

  await prisma.session.create({
    data: {
      id: hashToken(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS)
    }
  });

  aturCookie(res, token);
  return token;
}

// Ambil user yang sedang login dari cookie (atau null).
// Sesi diverifikasi KE DATABASE pada setiap permintaan - localStorage
// browser tidak dipercaya sebagai bukti identitas.
async function userDariSesi(req) {
  const token = tokenDariRequest(req);
  if (!token) return null;

  const sesi = await prisma.session.findUnique({
    where: { id: hashToken(token) },
    include: { user: true }
  });
  if (!sesi) return null;

  if (sesi.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: sesi.id } }).catch(() => {});
    return null;
  }

  // lastSeenAt dipakai utk tampilan "sesi aktif"; cukup diperbarui bila beda > 5 menit
  if (Date.now() - sesi.lastSeenAt.getTime() > 5 * 60 * 1000) {
    await prisma.session.update({
      where: { id: sesi.id },
      data: { lastSeenAt: new Date() }
    }).catch(() => {});
  }

  return {
    token,
    sessionHash: sesi.id,
    user: { id: sesi.user.id, username: sesi.user.username, name: sesi.user.name }
  };
}

// Keluar: hapus 1 sesi + bersihkan cookie
async function destroySession(req, res) {
  const token = tokenDariRequest(req);
  if (token) {
    await prisma.session.deleteMany({ where: { id: hashToken(token) } });
  }
  cookieKosong(res);
}

// Keluar dari SEMUA perangkat milik satu user
async function destroyAllSessions(userId) {
  const hasil = await prisma.session.deleteMany({ where: { userId } });
  return hasil.count;
}

// Matikan semua sesi user KECUALI satu token (utk ganti/reset password)
async function revokeSesiLain(userTokenHash, userId) {
  await prisma.session.deleteMany({
    where: { userId, id: { not: userTokenHash } }
  });
}

/* ---------- Middleware ---------- */

// Wajib login. req.user diisi bila lolos; kalau tidak -> 401 JSON
function requireAuth(req, res, next) {
  userDariSesi(req)
    .then((hasil) => {
      if (!hasil) {
        return res.status(401).json({ message: 'Masuk (login) dulu untuk melanjutkan.' });
      }
      req.user = hasil.user;
      req.sessionToken = hasil.token;
      req.sessionHash = hasil.sessionHash;
      next();
    })
    .catch(next);
}

/* ---------- Pembatasan percobaan login (anti brute force) ----------
   Dua lapis:
   - per (ip|username): 5x gagal = blokir 5 menit (targetkan akun)
   - per ip: 20x gagal = blokir 5 menit (targetkan sebar akun)      */

const percobaanGagal = new Map(); // kunci -> { jumlah, blokirHingga }
const MAKS_GAGAL_AKUN = 5;
const MAKS_GAGAL_IP = 20;
const JEDA_BLOKIR_MS = 5 * 60 * 1000; // 5 menit

function loginTerblokir(kunci) {
  const data = percobaanGagal.get(kunci);
  return data && data.blokirHingga && Date.now() < data.blokirHingga;
}

function loginDibuatGagal(kunci, maksimal) {
  const data = percobaanGagal.get(kunci) || { jumlah: 0, blokirHingga: 0 };
  data.jumlah += 1;
  if (data.jumlah >= (maksimal || MAKS_GAGAL_AKUN)) data.blokirHingga = Date.now() + JEDA_BLOKIR_MS;
  percobaanGagal.set(kunci, data);
}

function loginDibuatSukses(kunci) {
  percobaanGagal.delete(kunci);
}

// rapikan Map tiap 10 menit agar memori tidak bengkak
setInterval(() => {
  for (const [kunci, data] of percobaanGagal.entries()) {
    if (!data.blokirHingga || data.blokirHingga < Date.now()) percobaanGagal.delete(kunci);
  }
}, 10 * 60 * 1000).unref();

/* ---------- Registrasi & login ---------- */

const USERNAME_REGEX = /^[A-Za-z0-9._]{3,20}$/;
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const bersihkanEmail = (nilai) => String(nilai ?? '').trim().toLowerCase();

function emailSah(nilai) {
  const email = bersihkanEmail(nilai);
  if (!email) return null;
  if (email.length > 120) return null;
  if (!EMAIL_REGEX.test(email)) return null;
  return email;
}

// Validasi registrasi (semua dilarang lolos tanpa pesan yang jelas)
function validasiDaftar({ name, username, email, password }) {
  if (!name || !String(name).trim()) return 'Nama wajib diisi.';
  if (String(name).trim().length > 60) return 'Nama terlalu panjang (maksimal 60 karakter).';
  if (!username) return 'Username wajib diisi.';
  if (!USERNAME_REGEX.test(String(username))) {
    return 'Username 3-20 karakter: huruf, angka, titik, atau underscore.';
  }
  if (!email) return 'Email wajib diisi.';
  if (!emailSah(email)) return 'Format email tidak valid.';
  if (!password || String(password).length < 8) {
    return 'Password minimal 8 karakter.';
  }
  if (String(password).length > 72) return 'Password maksimal 72 karakter.';
  return null;
}

// Registrasi: memeriksa duplikat username & email
async function registerUser({ name, username, email, password }) {
  const uname = String(username).trim().toLowerCase();
  const mail = emailSah(email);
  if (!mail) return { ok: false, status: 400, message: 'Format email tidak valid.' };

  const [sudahUsername, sudahEmail] = await Promise.all([
    prisma.user.findUnique({ where: { username: uname } }),
    prisma.user.findUnique({ where: { email: mail } })
  ]);

  if (sudahUsername) {
    return { ok: false, status: 409, message: 'Username sudah dipakai. Coba yang lain.' };
  }
  if (sudahEmail) {
    return { ok: false, status: 409, message: 'Email sudah terdaftar. Gunakan email lain atau masuk.' };
  }

  const user = await prisma.user.create({
    data: {
      username: uname,
      email: mail,
      name: String(name).trim(),
      passwordHash: hashPassword(password) // plaintext TIDAK disimpan
    }
  });
  return { ok: true, user: { id: user.id, username: user.username, name: user.name } };
}

// Login: cocokkan username lalu password (hash bcrypt)
async function loginUser({ username, password }, ip) {
  const uname = String(username ?? '').trim().toLowerCase();
  const kunciAkun = `${ip}|${uname}`;
  const kunciIp = `ip:${ip}`;

  if (loginTerblokir(kunciAkun)) {
    return { ok: false, status: 429, message: 'Terlalu banyak percobaan gagal untuk akun ini. Coba lagi dalam 5 menit.' };
  }
  if (loginTerblokir(kunciIp)) {
    return { ok: false, status: 429, message: 'Terlalu banyak percobaan gagal. Coba lagi dalam 5 menit.' };
  }

  const user = await prisma.user.findUnique({ where: { username: uname } });
  const benar = user && cocokPassword(password, user.passwordHash);

  if (!benar) {
    loginDibuatGagal(kunciAkun);
    loginDibuatGagal(kunciIp, MAKS_GAGAL_IP);
    return { ok: false, status: 401, message: 'Username atau password salah.' };
  }

  loginDibuatSukses(kunciAkun); // kunciIp tidak dihapus - berlaku utk seluruh percobaan
  return { ok: true, user: { id: user.id, username: user.username, name: user.name } };
}

/* ---------- Ganti password (akun sedang login) ---------- */

async function gantiPassword(user, sessionHashKini, passwordLama, passwordBaru) {
  if (!passwordBaru || String(passwordBaru).length < 8) {
    return { ok: false, status: 400, message: 'Password baru minimal 8 karakter.' };
  }
  if (String(passwordBaru).length > 72) {
    return { ok: false, status: 400, message: 'Password baru maksimal 72 karakter.' };
  }
  if (String(passwordBaru) === String(passwordLama)) {
    return { ok: false, status: 400, message: 'Password baru tidak boleh sama dengan yang lama.' };
  }

  const akun = await prisma.user.findUnique({ where: { id: user.id } });
  if (!akun || !cocokPassword(passwordLama, akun.passwordHash)) {
    return { ok: false, status: 400, message: 'Password saat ini salah.' };
  }

  await prisma.user.update({
    where: { id: akun.id },
    data: { passwordHash: hashPassword(passwordBaru) }
  });
  // password berubah = semua sesi DI PERANGKAT LAIN dimatikan
  await revokeSesiLain(sessionHashKini, akun.id);
  return { ok: true };
}

/* ---------- Lupa password (token sekali pakai, hash di DB) ---------- */

// Selalu balas sukses (tanpa memberi tahu email terdaftar apa tidak)
async function mintaResetPassword(email) {
  const mail = emailSah(email);
  if (!mail) {
    return { ok: false, status: 400, message: 'Format email tidak valid.' };
  }

  const pesanUmum = 'Kalau email itu terdaftar, tautan ganti password sudah dikirim. Cek kotak masuk ya.';
  let user;
  try {
    user = await prisma.user.findUnique({ where: { email: mail } });
  } catch {
    return { ok: true, message: pesanUmum, devToken: null };
  }

  if (!user) return { ok: true, message: pesanUmum, devToken: null };

  await prisma.passwordReset.deleteMany({ where: { userId: user.id } }); // token lama hangus

  const token = tokenBaru();
  await prisma.passwordReset.create({
    data: {
      id: hashToken(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + RESET_TTL_MS)
    }
  });

  // Catatan tugas: pengiriman email sungguhan butuh layanan SMTP (di luar cakupan,
  // gratis Neon/Express). Untuk uji & demo, token dikembalikan ke DEV saja.
  const devToken = diProduksi ? null : token;
  return { ok: true, message: pesanUmum, devToken };
}

async function resetPassword(token, passwordBaru) {
  if (!token) return { ok: false, status: 400, message: 'Token reset tidak ditemukan.' };
  if (!passwordBaru || String(passwordBaru).length < 8) {
    return { ok: false, status: 400, message: 'Password baru minimal 8 karakter.' };
  }
  if (String(passwordBaru).length > 72) {
    return { ok: false, status: 400, message: 'Password baru maksimal 72 karakter.' };
  }

  const minta = await prisma.passwordReset.findUnique({ where: { id: hashToken(token) } });
  if (!minta || minta.usedAt || minta.expiresAt.getTime() < Date.now()) {
    return { ok: false, status: 400, message: 'Token reset tidak sah atau sudah kedaluwarsa. Minta tautan baru.' };
  }

  await prisma.user.update({
    where: { id: minta.userId },
    data: { passwordHash: hashPassword(passwordBaru) }
  });
  await prisma.passwordReset.update({
    where: { id: minta.id },
    data: { usedAt: new Date() } // token DIPAKAI - tidak bisa dipakai lagi
  });
  // password berubah = SEMUA sesi dimatikan (termasuk penyerang yang mungkin pegang sesi)
  await destroyAllSessions(minta.userId);
  return { ok: true };
}

/* ---------- Kelola sesi aktif (halaman perangkat) ---------- */

async function daftarSesi(user) {
  const daftar = await prisma.session.findMany({
    where: { userId: user.id, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' }
  });
  return daftar.map((s) => ({
    id: s.id.slice(0, 12), // versi pendek utk tampilan (tidak reversibel)
    perangkat: `Mulai ${s.createdAt.toISOString().slice(0, 16).replace('T', '')}`,
    createdAt: s.createdAt.toISOString(),
    lastSeenAt: s.lastSeenAt.toISOString(),
    expiresAt: s.expiresAt.toISOString()
  }));
}

async function matikanSesi(userId, idPendek, tokenSekarang) {
  const sesiSemua = await prisma.session.findMany({ where: { userId } });
  const target = sesiSemua.find((s) => s.id.slice(0, 12) === idPendek);
  if (!target) return { ok: false, status: 404, message: 'Sesi tidak ditemukan.' };

  await prisma.session.delete({ where: { id: target.id } });
  const diriSendiri = target.id === tokenSekarang;
  return { ok: true, diriSendiri };
}

module.exports = {
  COOKIE_NAME,
  createSession,
  destroySession,
  destroyAllSessions,
  cookieKosong,
  revokeSesiLain,
  requireAuth,
  userDariSesi,
  validasiDaftar,
  registerUser,
  loginUser,
  gantiPassword,
  mintaResetPassword,
  resetPassword,
  daftarSesi,
  matikanSesi,
  bersihkanEmail,
  emailSah
};
