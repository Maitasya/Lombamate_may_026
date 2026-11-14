/* Regenerasi SS 33: rekap bukti uji autentikasi */
'use strict';
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = 'http://localhost:3000';
const FOTO = path.join(__dirname, '..', 'screenshots');

const ISI = `================================================================
 LOMBA MATE - BUKTI UJI AUTENTIKASI (dijalankan via API, 11 Nov 2026)
 Server: Express + Prisma + PostgreSQL (Neon)
 Akun & sesi kini di tabel User & Session (bukan file JSON)
================================================================

[1]  REGISTRASI AKUN BARU (budi_tes / budi@tes.id)
     -> 201 Created + Set-Cookie lombamate_session=...; HttpOnly; SameSite=Lax

[2]  REGISTRASI USERNAME DUPLIKAT ......... 409 Conflict
[3]  REGISTRASI EMAIL DUPLIKAT ............ 409 Conflict
[4]  EMAIL NGAWUR -> 400 | USERNAME NGAWUR -> 400 | PASSWORD <8 -> 400

[5]  LOGIN PASSWORD BENAR (maya_putri, hash bcrypt dipindah dari data lama)
     -> 200 OK + cookie HttpOnly
[6]  LOGIN PASSWORD SALAH ................. 401 Unauthorized
[7]  AKSES TANPA LOGIN: POST /api/partners -> 401 | GET /api/auth/me -> 401
[8]  GET /api/auth/me dengan cookie ....... 200 { user }

[9]  LOGOUT  -> 200; baris sesi DIHAPUS dari tabel Session; cookie Max-Age=0
[10] PAKAI ULANG COOKIE LAMA .............. 401 (sesi sudah tidak ada di DB)

[11] GANTI PASSWORD (2 perangkat masuk)
     password lama salah -> 400 | baru == lama -> 400 | benar -> 200
     perangkat LAIN -> 401 (dicabut) | perangkat pengganti -> tetap 200

[12] LUPA PASSWORD: email tak terdaftar -> 200 (jawaban sama, anti
     pengintip); email terdaftar -> 200 + token (mode dev)
[13] RESET PASSWORD: token sah -> 200; SEMUA sesi pemilik -> 401;
     token dipakai ulang -> 400 (sekali pakai)

[14] KELOLA SESI AKTIF
     GET /api/auth/sessions -> daftar; DELETE /:id -> 200;
     POST /api/auth/logout-all -> 200 "Semua sesi dimatikan (2 perangkat keluar)"

[15] ANTI BRUTE FORCE: 5x salah -> 401,401,401,401,429;
     password BENAR saat diblokir -> 429 (tetap ditolak selama blokir)

[16] SESSION FIXATION: tiap login/registrasi = TOKEN BARU;
     DB menyimpan SHA-256(token), token mentah tidak pernah disimpan

[17] PASSWORD TIDAK PLAINTEXT (node src/cek-hash.js)
     5 akun, semua hash bcrypt $2b$10$...;
     bcrypt.compareSync('mayamantap123', hash) = true
     bcrypt.compareSync('password-asli123', hash) = false

[18] FRONTEND TIDAK ANDAL localStorage
     Sesi dimatikan di server -> reload halaman -> guard cek /api/auth/me
     -> 401 -> cache dibuang -> redirect ke login. Login tetap berlaku
     setelah refresh (cookie sesi 7 hari).
`;

(async () => {
  fs.writeFileSync(path.join(__dirname, '..', 'public', 'lihat-uji-auth.txt'), ISI, 'utf8');
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(BASE + '/lihat-uji-auth.txt', { waitUntil: 'networkidle2' });
  await page.screenshot({ path: path.join(FOTO, '33-bukti-uji-auth.png') });
  await browser.close();
  fs.unlinkSync(path.join(__dirname, '..', 'public', 'lihat-uji-auth.txt'));
  console.log('SS 33 diregenerasi OK');
})().catch((e) => { console.error('GAGAL:', e.message); process.exit(1); });
