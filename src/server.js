/* =========================================================
   LombaMate - src/server.js
   Backend Express + Prisma ORM + PostgreSQL (Neon).

   Yang tetap SAMA seperti versi aman (P0 keamanan selesai):
   - akun & sesi di src/auth.js (password bcrypt, cookie HttpOnly)
   - semua endpoint tulis wajib login; identitas dari SESI
   - validasi backend menyeluruh + header keamanan
   - transisi status join dibatasi + anti duplikasi

   Yang BERUBAH: penyimpanan data.
   Dulu: file partners.json / joins.json / profiles.json.
   Kini: PostgreSQL di Neon lewat Prisma (prisma/schema.prisma).
   Bentuk data yang dikirim ke frontend TIDAK BERUBAH sama sekali.
   ========================================================= */
'use strict';

require('dotenv').config();
const express = require('express');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const {
  createSession,
  destroySession,
  destroyAllSessions,
  cookieKosong,
  requireAuth,
  userDariSesi,
  validasiDaftar,
  registerUser,
  loginUser,
  gantiPassword,
  mintaResetPassword,
  resetPassword,
  daftarSesi,
  matikanSesi
} = require('./auth');

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;

/* ---------- Middleware dasar ---------- */
app.use(express.json({ limit: '1mb' }));                        // membaca body JSON

/* ---------- Header keamanan (#113, #128) ----------
   HARUS di atas express.static, kalau tidak file HTML/CSS
   dibalas server statis tanpa header keamanan.              */
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "img-src 'self' data:; connect-src 'self'; font-src 'self' data: https://fonts.gstatic.com; " +
    "object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
  );
  next();
});

app.use(express.static(path.join(__dirname, '..', 'public')));  // menyajikan front-end

/* =========================================================
   AKUN & SESI (registrasi / login / logout / kelola)
   Akun & sesi kini tersimpan di PostgreSQL (tabel User,
   Session, PasswordReset) - bukan lagi file JSON.
   Semua handler async; sesi diverifikasi ke DATABASE
   pada setiap permintaan - localStorage tidak dipercaya.
   ========================================================= */

app.post('/api/auth/register', (req, res, next) => {
  const error = validasiDaftar(req.body || {});
  if (error) {
    return res.status(400).json({ message: error });
  }

  registerUser(req.body)
    .then((result) => {
      if (!result.ok) {
        return res.status(result.status || 400).json({ message: result.message });
      }
      // anti session fixation: token BARU setiap registrasi
      return createSession(res, result.user).then(() => {
        res.status(201).json({ message: 'Akun berhasil dibuat. Selamat berjuang! 🚀', user: result.user });
      });
    })
    .catch(next);
});

app.post('/api/auth/login', (req, res, next) => {
  const ip = req.ip || 'tanpa-ip';
  loginUser(req.body || {}, ip)
    .then((result) => {
      if (!result.ok) {
        return res.status(result.status || 401).json({ message: result.message });
      }
      // anti session fixation: token BARU setiap login; perangkat lain
      // tidak di-kick hanya karena ada login baru dari tempat lain
      return createSession(res, result.user).then(() => {
        res.json({ message: 'Berhasil masuk. Semangat ya! 💪', user: result.user });
      });
    })
    .catch(next);
});

app.post('/api/auth/logout', (req, res, next) => {
  destroySession(req, res) // hapus 1 sesi di database + bersihkan cookie
    .then(() => res.json({ message: 'Kamu sudah keluar. Sampai jumpa! 👋' }))
    .catch(next);
});

app.get('/api/auth/me', (req, res, next) => {
  userDariSesi(req) // verifikasi ke DATABASE, bukan localStorage
    .then((hasil) => {
      if (!hasil) {
        return res.status(401).json({ message: 'Belum masuk.' });
      }
      res.json({ user: hasil.user });
    })
    .catch(next);
});

/* ---------- Kelola sesi aktif ---------- */

// Daftar sesi yang masih hidup milik saya
app.get('/api/auth/sessions', requireAuth, (req, res, next) => {
  daftarSesi(req.user)
    .then((sessions) => res.json({ sessions }))
    .catch(next);
});

// Matikan satu sesi (perangkat lain, atau diri sendiri = keluar)
app.delete('/api/auth/sessions/:id', requireAuth, (req, res, next) => {
  matikanSesi(req.user.id, String(req.params.id), req.sessionHash)
    .then((hasil) => {
      if (!hasil.ok) {
        return res.status(hasil.status).json({ message: hasil.message });
      }
      if (hasil.diriSendiri) {
        return destroySession(req, res).then(() => {
          res.json({ message: 'Sesi ini dimatikan. Kamu sudah keluar.' });
        });
      }
      res.json({ message: 'Sesi perangkat itu dimatikan.' });
    })
    .catch(next);
});

// Keluar dari SEMUA perangkat
app.post('/api/auth/logout-all', requireAuth, (req, res, next) => {
  destroyAllSessions(req.user.id)
    .then((jumlah) => {
      cookieKosong(res);
      res.json({ message: `Semua sesi dimatikan (${jumlah} perangkat keluar).` });
    })
    .catch(next);
});

/* ---------- Ganti password (harus masuk) ---------- */

app.post('/api/auth/change-password', requireAuth, (req, res, next) => {
  const b = req.body || {};
  gantiPassword(req.user, req.sessionHash, b.currentPassword, b.newPassword)
    .then((hasil) => {
      if (!hasil.ok) {
        return res.status(hasil.status).json({ message: hasil.message });
      }
      res.json({ message: 'Password diganti. Perangkat lain diminta masuk ulang.' });
    })
    .catch(next);
});

/* ---------- Lupa & reset password (tanpa login) ---------- */

app.post('/api/auth/forgot', (req, res, next) => {
  mintaResetPassword(req.body && req.body.email)
    .then((hasil) => {
      if (!hasil.ok) {
        return res.status(hasil.status).json({ message: hasil.message });
      }
      // devToken hanya ada di mode pengembangan (NODE_ENV bukan "production")
      res.json({ message: hasil.message, devToken: hasil.devToken });
    })
    .catch(next);
});

app.post('/api/auth/reset', (req, res, next) => {
  const b = req.body || {};
  resetPassword(b.token, b.newPassword)
    .then((hasil) => {
      if (!hasil.ok) {
        return res.status(hasil.status).json({ message: hasil.message });
      }
      res.json({ message: 'Password berhasil diganti. Silakan masuk dengan password baru.' });
    })
    .catch(next);
});

/* =========================================================
   LAPISAN KONVERSI: baris Prisma  <->  bentuk data versi JSON
   Frontend mengenal bentuk data JSON lama; kita mengonversi
   dengan jeli di satu tempat supaya tidak tercecer.
   ========================================================= */

// Partner dari DB ke bentuk JSON tua (field tanggal jadi string ISO)
function partnerKeJson(p) {
  return {
    id: p.id,
    category: p.category,
    competition: p.competition,
    organizer: p.organizer || '',
    level: p.level || '',
    deadline: p.deadline || '',
    link: p.link || '',
    teamSize: p.teamSize || '',
    slots: p.slots === null || p.slots === undefined ? '' : p.slots,
    roles: Array.isArray(p.roles) ? p.roles : [],
    scope: p.scope || '',
    description: p.description || '',
    contactType: p.contactType,
    contact: p.contact,
    ownerName: p.ownerName || '',
    ownerCampus: p.ownerCampus || '',
    ownerUsername: p.ownerUsername,
    ownerPhoto: p.ownerPhoto || '',
    createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString()
  };
}

// Join dari DB ke bentuk JSON tua
function joinKeJson(j) {
  return {
    id: j.id,
    partnerId: j.partnerId,
    username: j.username,
    name: j.name,
    status: j.status,
    createdAt: j.createdAt ? new Date(j.createdAt).toISOString() : new Date().toISOString()
  };
}

// Profil dari DB ke bentuk JSON (field tidak sensitif saja)
function profilKeJson(p) {
  if (!p) return null;
  return {
    username: p.username,
    name: p.name,
    campus: p.campus,
    major: p.major,
    contact: p.contact,
    bio: p.bio,
    photo: p.photo || '',
    looking: p.looking,
    interests: Array.isArray(p.interests) ? p.interests : [],
    skills: Array.isArray(p.skills) ? p.skills : [],
    history: Array.isArray(p.history) ? p.history : [],
    updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : null
  };
}

// dataPemilikTerbaru: foto/nama/kampus pemilik kartu selalu
// diperbarui dari tabel Profile (foto tidak ketinggalan zaman)
async function dataPemilikTerbaru(ownerUsername) {
  if (!ownerUsername) return {};
  const p = await prisma.profile.findUnique({
    where: { username: String(ownerUsername).toLowerCase() }
  });
  if (!p) return {};
  return {
    ownerName: p.name || undefined,
    ownerCampus: p.campus || undefined,
    ownerPhoto: p.photo || undefined,
    ownerBio: p.bio || undefined
  };
}

/* =========================================================
   VALIDASI BACKEND MENYELURUH (tetap sama dari versi aman)
   ========================================================= */

const KATEGORI = ['teknologi', 'desain', 'karya-tulis', 'bisnis', 'sains', 'debat', 'teknik', 'olahraga-seni'];
const TINGKAT = ['Sekolah', 'Kampus / Universitas', 'Kota / Kabupaten', 'Provinsi', 'Nasional', 'Internasional'];
const UKURAN_TIM = ['Individu (cari teman latihan)', '2 orang', '3 orang', '4 orang', '5 orang', '6 orang atau lebih'];
const LINGKUP = ['Satu kampus', 'Satu jurusan', 'Beda kampus boleh', 'Bebas'];
const JENIS_KONTAK = ['WhatsApp', 'Instagram', 'Telegram', 'Email', 'Discord'];

const amankanTeks = (nilai, maksimal) => String(nilai ?? '').trim().slice(0, maksimal);

// URL hanya http/https (anti javascript: dan data: #109)
function urlAman(nilai) {
  const s = String(nilai ?? '').trim();
  if (!s) return '';
  if (s.length > 2048) return null;
  if (!/^https?:\/\//i.test(s)) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return s;
  } catch {
    return null;
  }
}

// Tanggal harus YYYY-MM-DD yang sah dan tidak di masa lalu (#104, #105)
function tanggalSah(nilai) {
  const s = String(nilai ?? '').trim();
  if (!s) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return null;
  if (d.toISOString().slice(0, 10) !== s) return null;
  if (s < new Date().toISOString().slice(0, 10)) return null;
  return s;
}

// data URL foto (data:image/...;base64,...) maksimal ~600KB
const FOTO_MAKSIMAL_KARAKTER = 700000;
function fotoSah(nilai) {
  if (!nilai) return '';
  const s = String(nilai);
  if (s.length > FOTO_MAKSIMAL_KARAKTER) return null;
  return /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=\s]+$/.test(s) ? s : null;
}

// Array string sederhana
function arrayTeks(nilai, maksItem, maksKarakter) {
  if (!Array.isArray(nilai)) return null;
  const bersih = nilai.map((v) => amankanTeks(v, maksKarakter)).filter(Boolean);
  if (bersih.length > maksItem) return null;
  return bersih;
}

function pick(body) {
  const out = {};
  for (const field of ['category', 'competition', 'organizer', 'level', 'deadline', 'link',
    'teamSize', 'slots', 'roles', 'scope', 'description', 'contactType', 'contact']) {
    if (body && body[field] !== undefined) out[field] = body[field];
  }
  return out;
}

function validate(data) {
  if (!data.category) return 'Kategori lomba wajib dipilih.';
  if (!KATEGORI.includes(data.category)) return 'Kategori tidak dikenal.';
  if (!data.competition || !String(data.competition).trim()) return 'Nama lomba wajib diisi.';

  if (!Array.isArray(data.roles) || data.roles.length === 0) return 'Pilih minimal satu peran.';

  if (data.slots !== null && data.slots !== undefined && data.slots !== '') {
    const slots = Number(data.slots);
    if (!Number.isInteger(slots) || slots < 1 || slots > 10) {
      return 'Jumlah partner yang dicari harus 1 sampai 10.';
    }
  }
  if (!data.contact || !String(data.contact).trim()) return 'Kontak wajib diisi.';
  return null;
}

function validateDetail(data) {
  if (String(data.competition).length > 100) return 'Nama lomba maksimal 100 karakter.';
  if (data.organizer && String(data.organizer).length > 100) return 'Nama penyelenggara terlalu panjang.';

  if (data.level && data.level !== '' && !TINGKAT.includes(data.level)) {
    return 'Tingkat lomba tidak dikenal.';
  }
  if (data.teamSize && data.teamSize !== '' && !UKURAN_TIM.includes(data.teamSize)) {
    return 'Jumlah anggota tim tidak dikenal.';
  }
  if (data.scope && data.scope !== '' && !LINGKUP.includes(data.scope)) {
    return 'Lingkup partner tidak dikenal.';
  }
  if (data.contactType && !JENIS_KONTAK.includes(data.contactType)) {
    return 'Jenis kontak tidak dikenal.';
  }
  if (String(data.contact).length > 60) return 'Kontak maksimal 60 karakter.';
  if (data.description && String(data.description).length > 600) return 'Deskripsi maksimal 600 karakter.';

  const peran = arrayTeks(data.roles, 6, 40);
  if (!peran) return 'Peran tidak valid (maksimal 6 peran, 40 karakter masing-masing).';
  if (peran.length === 0) return 'Pilih minimal satu peran.';

  if (data.deadline) {
    const tgl = tanggalSah(data.deadline);
    if (tgl === null) return 'Batas pendaftaran tidak valid. Formatnya YYYY-MM-DD dan tidak boleh di masa lalu.';
    data.deadline = tgl;
  }
  if (data.link) {
    const bersih = urlAman(data.link);
    if (bersih === null) return 'Link info lomba harus URL http/https yang sah.';
    data.link = bersih;
  }

  data.roles = peran;
  return null;
}

// Field partner diubah jadi data siap simpan ke Prisma
function siapkanPartner(data) {
  return {
    category: String(data.category),
    competition: amankanTeks(data.competition, 100),
    organizer: amankanTeks(data.organizer || '', 100),
    level: amankanTeks(data.level || '', 40),
    deadline: amankanTeks(data.deadline || '', 10),
    link: data.link || '',
    teamSize: amankanTeks(data.teamSize || '', 40),
    slots: (data.slots === null || data.slots === undefined || data.slots === '') ? null : Number(data.slots),
    roles: data.roles,
    scope: amankanTeks(data.scope || '', 40),
    description: amankanTeks(data.description || '', 600),
    contactType: data.contactType || 'WhatsApp',
    contact: amankanTeks(data.contact, 60)
  };
}

// Perhitungan kuota dari join yang sudah terambil
function kuotaDari(partner, joins, excludeJoinId = null) {
  if (partner.slots === null || partner.slots === undefined) return { sisa: null, penuh: false };
  const aktif = joins.filter(
    (j) => j.status !== 'ditolak' && (excludeJoinId === null || j.id !== excludeJoinId)
  ).length;
  const sisa = Number(partner.slots) - aktif;
  return { sisa, penuh: sisa <= 0 };
}

/* =========================================================
   ENDPOINT PARTNER (kini memakai Prisma + Neon)
   ========================================================= */

/* ---------- GET: semua partner (publik, hanya baca) ---------- */
app.get('/api/partners', async (req, res) => {
  const viewers = await userDariSesi(req); // async: verifikasi sesi ke database
  const me = viewers ? viewers.user.username.toLowerCase() : null;

  const partners = await prisma.partner.findMany({
    include: { joins: { orderBy: { createdAt: 'asc' } } },
    orderBy: { createdAt: 'asc' }
  });

  const hasil = [];
  for (const p of partners) {
    const terbaru = await dataPemilikTerbaru(p.ownerUsername);
    const gab = partnerKeJson({ ...p, ...terbaru });
    const { sisa, penuh } = kuotaDari(p, p.joins);
    const pemilik = p.ownerUsername && String(p.ownerUsername).toLowerCase() === me;

    const semua = p.joins.map(joinKeJson);
    const dirender = pemilik
      ? semua
      : (me
        ? [
          ...semua.filter((j) => j.username.toLowerCase() === me),
          ...semua.filter((j) => j.status === 'diterima' && j.username.toLowerCase() !== me)
        ]
        : []);

    hasil.push({
      ...gab,
      requests: dirender,
      sisa,
      penuh
    });
  }
  res.json(hasil);
});

/* ---------- GET: satu partner (mode Edit, khusus pemilik) ---------- */
app.get('/api/partners/:id', requireAuth, async (req, res) => {
  const p = await prisma.partner.findUnique({
    where: { id: Number(req.params.id) },
    include: { joins: { orderBy: { createdAt: 'asc' } } }
  });
  if (!p) {
    return res.status(404).json({ message: 'Partner tidak ditemukan.' });
  }
  if (String(p.ownerUsername).toLowerCase() !== req.user.username.toLowerCase()) {
    return res.status(403).json({ message: 'Hanya pemilik postingan yang bisa mengeditnya.' });
  }
  const terbaru = await dataPemilikTerbaru(p.ownerUsername);
  res.json(partnerKeJson({ ...p, ...terbaru }));
});

/* ---------- POST: tambah partner (wajib login) ---------- */
app.post('/api/partners', requireAuth, async (req, res) => {
  const data = pick(req.body);
  const error = validate(data);
  if (error) {
    return res.status(400).json({ message: error });
  }
  const detail = validateDetail(data);
  if (detail) {
    return res.status(400).json({ message: detail });
  }

  // Identitas pemilik DIPAKSA dari sesi (#85): body tidak dipercaya
  const partner = await prisma.partner.create({
    data: {
      ...siapkanPartner(data),
      ownerName: amankanTeks(req.user.name, 60),
      ownerCampus: amankanTeks(req.body && req.body.ownerCampus, 100),
      ownerUsername: req.user.username,
      ownerPhoto: ''
    }
  });

  res.status(201).json(partnerKeJson(partner));
});

/* ---------- PUT: ubah partner (khusus pemilik) ---------- */
app.put('/api/partners/:id', requireAuth, async (req, res) => {
  const lama = await prisma.partner.findUnique({ where: { id: Number(req.params.id) } });
  if (!lama) {
    return res.status(404).json({ message: 'Partner tidak ditemukan.' });
  }
  if (String(lama.ownerUsername).toLowerCase() !== req.user.username.toLowerCase()) {
    return res.status(403).json({ message: 'Hanya pemilik postingan yang bisa mengubah.' });
  }

  const data = pick(req.body);
  // validasi dijalankan atas GABUNGAN data lama + data baru
  // (kolom wajib tetap harus terisi walau PUT hanya mengirim sebagian)
  const gabungan = { ...partnerKeJson(lama), ...data };
  const error = validate(gabungan);
  if (error) {
    return res.status(400).json({ message: error });
  }
  const detail = validateDetail(gabungan);
  if (detail) {
    return res.status(400).json({ message: detail });
  }

  const updated = await prisma.partner.update({
    where: { id: lama.id },
    data: siapkanPartner(gabungan)
  });
  res.json(partnerKeJson(updated));
});

/* ---------- DELETE: hapus partner (khusus pemilik) ----------
   join terkait ikut terhapus otomatis lewat onDelete: Cascade
   - satu operasi, atomik, transaksi JDBC/PG (perbaikan #148). */
app.delete('/api/partners/:id', requireAuth, async (req, res) => {
  const lama = await prisma.partner.findUnique({ where: { id: Number(req.params.id) } });
  if (!lama) {
    return res.status(404).json({ message: 'Partner tidak ditemukan.' });
  }
  if (String(lama.ownerUsername).toLowerCase() !== req.user.username.toLowerCase()) {
    return res.status(403).json({ message: 'Hanya pemilik postingan yang bisa menghapus.' });
  }

  await prisma.partner.delete({ where: { id: lama.id } });
  res.json({ message: 'Partner berhasil dihapus.' });
});

/* =========================================================
   ENDPOINT PERMINTAAN GABUNG
   ========================================================= */

/* ---------- POST: ajukan permintaan (wajib login) ---------- */
app.post('/api/partners/:id/joins', requireAuth, async (req, res) => {
  const partner = await prisma.partner.findUnique({
    where: { id: Number(req.params.id) },
    include: { joins: { orderBy: { createdAt: 'asc' } } }
  });
  if (!partner) {
    return res.status(404).json({ message: 'Partner tidak ditemukan.' });
  }

  const username = req.user.username;
  const name = amankanTeks(req.user.name, 60);

  if (username.toLowerCase() === String(partner.ownerUsername || '').toLowerCase()) {
    return res.status(400).json({ message: 'Ini postinganmu sendiri, tidak bisa mengikuti dirimu sendiri.' });
  }

  // Cegah duplikasi permintaan aktif (#149)
  const sudah = partner.joins.find(
    (j) => j.username.toLowerCase() === username.toLowerCase() && j.status !== 'ditolak'
  );
  if (sudah) {
    return sudah.status === 'diterima'
      ? res.status(400).json({ message: 'Kamu sudah menjadi anggota tim ini.' })
      : res.status(400).json({ message: 'Kamu sudah mengajukan permintaan ke tim ini.' });
  }

  const { sisa } = kuotaDari(partner, partner.joins);
  if (sisa !== null && sisa <= 0) {
    return res.status(400).json({ message: 'Kuota tim ini sudah penuh.' });
  }

  const join = await prisma.join.create({
    data: { partnerId: partner.id, username, name, status: 'menunggu' }
  });

  res.status(201).json({
    message: `Permintaan gabung ke "${partner.competition}" terkirim!`,
    requests: partnerKeJsonJ(partner.joins.concat([join])),
    sisa: kuotaDari(partner, partner.joins.concat([join])).sisa
  });
});

function partnerKeJsonJ(joins) {
  return joins.map(joinKeJson).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

/* ---------- PUT: pemilik menyetujui / menolak (#89) ---------- */
app.put('/api/joins/:id', requireAuth, async (req, res) => {
  const status = req.body && req.body.status;

  if (status !== 'diterima' && status !== 'ditolak') {
    return res.status(400).json({ message: 'Status harus "diterima" atau "ditolak".' });
  }

  const join = await prisma.join.findUnique({
    where: { id: Number(req.params.id) },
    include: { partner: { include: { joins: { orderBy: { createdAt: 'asc' } } } } }
  });
  if (!join) {
    return res.status(404).json({ message: 'Permintaan tidak ditemukan.' });
  }

  const partner = join.partner;
  if (String(partner.ownerUsername).toLowerCase() !== req.user.username.toLowerCase()) {
    return res.status(403).json({ message: 'Hanya pemilik postingan yang bisa memutuskan.' });
  }

  if (join.status !== 'menunggu') {
    return res.status(400).json({ message: 'Hanya permintaan berstatus "menunggu" yang bisa diputuskan.' });
  }

  // Pengaman kuota saat menerima (#145)
  if (status === 'diterima') {
    const { sisa } = kuotaDari(partner, partner.joins, join.id);
    if (sisa !== null && sisa <= 0) {
      return res.status(400).json({ message: 'Kuota tim sudah penuh. Tolak dulu permintaan lain untuk menyisakan tempat.' });
    }
  }

  const updated = await prisma.join.update({
    where: { id: join.id },
    data: { status }
  });

  const message = status === 'diterima'
    ? 'Permintaan diterima. Selamat bergabung! 🎉'
    : 'Permintaan ditolak dan kuota dikembalikan.';

  res.json({
    message,
    requests: partnerKeJsonJ(partner.joins),
    join: joinKeJson(updated)
  });
});

/* ---------- DELETE: batalkan / tinggalkan tim (#90) ---------- */
app.delete('/api/joins/:id', requireAuth, async (req, res) => {
  const join = await prisma.join.findUnique({ where: { id: Number(req.params.id) } });
  if (!join) {
    return res.status(404).json({ message: 'Permintaan tidak ditemukan.' });
  }

  if (join.username.toLowerCase() !== req.user.username.toLowerCase()) {
    return res.status(403).json({ message: 'Hanya pengaju yang bisa membatalkan permintaannya.' });
  }

  const statusLama = join.status;
  await prisma.join.delete({ where: { id: join.id } });

  const message = statusLama === 'diterima'
    ? 'Kamu meninggalkan tim. Semoga jumpa di lomba lain! 👋'
    : 'Permintaan dibatalkan dan kuota dikembalikan.';

  res.json({ message });
});

/* =========================================================
   PROFIL PUBLIK
   ========================================================= */

// GET semua profil: khusus pengguna masuk (#115 anti scraping)
app.get('/api/profiles', requireAuth, async (req, res) => {
  const daftar = await prisma.profile.findMany({ orderBy: { username: 'asc' } });
  res.json(daftar.map(profilKeJson));
});

// GET satu profil: publik (fitur "cek pengalaman orang")
app.get('/api/profiles/:username', async (req, res) => {
  const p = await prisma.profile.findUnique({
    where: { username: String(req.params.username).toLowerCase() }
  });
  if (!p) {
    return res.status(404).json({ message: 'Profil tidak ditemukan.' });
  }
  res.json(profilKeJson(p));
});

/* ---------- PUT: simpan profil sendiri (#91) ---------- */
app.put('/api/profiles/:username', requireAuth, async (req, res) => {
  const target = String(req.params.username).toLowerCase();

  if (target !== req.user.username.toLowerCase()) {
    return res.status(403).json({ message: 'Hanya pemilik profil yang bisa menyimpan profilnya.' });
  }

  const bersih = validateProfilBody(req.body);
  if (bersih.error) {
    return res.status(400).json({ message: bersih.error });
  }

  const tersimpan = await prisma.profile.upsert({
    where: { username: target },
    update: bersih.data,
    // data profil lengkap bila profil baru dibuat:
    create: { username: target, ...bersih.data }
  });

  res.json({ message: 'Profil berhasil disimpan.', profile: profilKeJson(tersimpan) });
});

function validateProfilBody(body) {
  const b = body || {};
  const data = {};

  data.name = amankanTeks(b.name, 60);
  data.campus = amankanTeks(b.campus, 100);
  data.major = amankanTeks(b.major, 100);
  data.contact = amankanTeks(b.contact, 60);
  data.bio = amankanTeks(b.bio, 500);
  data.looking = b.looking !== false;

  data.interests = arrayTeks(b.interests, 12, 40) || [];
  data.skills = arrayTeks(b.skills, 12, 40) || [];

  if (b.history === undefined) {
    data.history = [];
  } else if (!Array.isArray(b.history) || b.history.length > 20) {
    return { error: 'Riwayat lomba tidak valid (maksimal 20 entri).' };
  } else {
    let valid = true;
    data.history = b.history.map((h) => {
      if (!h || typeof h !== 'object') { valid = false; return null; }
      return {
        title: amankanTeks(h.title, 100),
        result: amankanTeks(h.result, 40)
      };
    }).filter((h) => h !== null);
    if (!valid) return { error: 'Riwayat lomba tidak valid.' };
  }

  const foto = fotoSah(b.photo);
  if (foto === null) return { error: 'Foto harus berupa gambar (png/jpg/webp, maksimal sekitar 600KB).' };
  data.photo = foto || '';

  return { data };
}

/* =========================================================
   MISC
   ========================================================= */

// Pengecekan hidup untuk monitoring + bukti DB tersambung (#188)
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, database: 'neon-postgres', waktu: new Date().toISOString() });
  } catch {
    res.status(500).json({ ok: false, database: 'terputus', waktu: new Date().toISOString() });
  }
});

/* ---------- Route /api yang tidak dikenal ---------- */
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Endpoint tidak ditemukan.' });
});

/* ---------- Body JSON rusak / terlalu besar ---------- */
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Format JSON tidak valid.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Data yang dikirim terlalu besar.' });
  }
  console.error(err);
  res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
});

/* ---------- Jalankan server ---------- */
app.listen(PORT, () => {
  console.log(`Server jalan di http://localhost:${PORT}`);
});
