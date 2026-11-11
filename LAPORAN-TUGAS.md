# 📄 Laporan Evidence — LombaMate (Prisma + Neon PostgreSQL)

**Kelompok B11 · Tugas PWEB: Melanjutkan project dengan Prisma + Neon Postgres**

---

## 1. Yang dikerjakan

LombaMate (platform pencari partner lomba) sebelumnya menyimpan semua data di
berkas JSON (`src/data/*.json`). Pada tugas ini seluruh lapisan data dimigrasikan:

| Aspek | Before (tugas lalu) | After (tugas ini) |
|---|---|---|
| Database | Berkas JSON di `src/data/` | **PostgreSQL di Neon** (region Singapore) |
| ORM | — (baca/tulis file manual) | **Prisma ORM** (`prisma/schema.prisma`) |
| Model | array di partners/joins/profiles.json | Tabel **Partner, Join, Profile** (+ FK `Join→Partner` dengan `onDelete: Cascade`, index `partnerId`) |
| ID | manual `partners.length + 1` | `@default(autoincrement())` + sequence dirapikan saat seed |
| Akun & sesi | `users.json` / `sessions.json` (file) | Tabel **User, Session, PasswordReset** (hash bcrypt, token sesi disimpan sebagai SHA-256) |
| Bentuk data ke frontend | — | **100% sama** dengan versi JSON → frontend tidak berubah |

Perintah yang dipakai (semuanya terdokumentasi di README):

```bash
npm install            # pasang dependensi
npx prisma db push     # buat tabel di Neon dari schema.prisma
npm run seed           # salin data JSON lama ke Neon (id tetap, hash akun tetap)
npm start              # jalankan server (Express + Prisma)
```

---

## 2. SS Perubahan database (BEFORE — AFTER)

| SS | Isi | Keterangan |
|---|---|---|
| 27 | `lihat-users-before.txt` = isi `src/data/users.json` | **BEFORE** — akun tersimpan di berkas JSON lokal |
| 28 | Prisma Studio → tabel **User** | **AFTER** — akun di PostgreSQL: kolom `email`, `passwordHash` (bcrypt `$2b$10$...`), unik |
| 29 | Prisma Studio → tabel **Session** | Sesi login tersimpan terpusat; id = SHA-256 token cookie (token mentah tidak pernah disimpan) |
| 23 | `prisma/schema.prisma` | Skema 6 model: Partner, Join, Profile, User, Session, PasswordReset |
| 24 | Output `npx prisma db push` + seed + `/api/health` | Bukti sinkronisasi tabel ke Neon |
| 25 | Respons `GET /api/partners` | Data yang kini diambil dari tabel Neon, bentuknya sama persis dengan versi JSON |
| 26 | Prisma Studio tabel Partner | Isi tabel hasil seed data lama |

---

## 3. SS Skenario (aplikasi & API)

| SS | Skenario |
|---|---|
| 30 | Halaman login (desain asli tetap) + panel **Lupa password** yang baru |
| 31 | Halaman **Ganti password** (reset via token) |
| 32 | Beranda setelah login (sesi cookie HttpOnly, kartu partner dari Neon) |
| 33 | Rekap hasil uji autentikasi 18 skenario (dijalankan via API) |

---

## 4. Bukti uji autentikasi (ringkas — detail di SS 33)

| Uji | Hasil |
|---|---|
| Registrasi akun baru | 201 + cookie HttpOnly |
| Registrasi username/email duplikat | 409 |
| Validasi email/username/password | 400 |
| Login benar / salah | 200 / 401 |
| Akses endpoint tanpa login | 401 |
| Logout → pakai ulang cookie | sesi dihapus → 401 |
| Ganti password (2 perangkat) | perangkat lain dicabut (401), perangkat aktif tetap masuk |
| Lupa + reset password | token sekali pakai, semua sesi dimatikan setelah reset |
| Kelola sesi aktif | daftar sesi, matikan satu, keluar semua perangkat |
| Anti brute force | 5× gagal → 429 (password benar pun ditolak saat blokir) |
| Session fixation | token BARU tiap login; DB hanya menyimpan SHA-256-nya |
| Password plaintext? | TIDAK — semua `$2b$10$` (bcrypt), dicek `node src/cek-hash.js` |
| Frontend andal localStorage? | TIDAK — guard memverifikasi sesi ke server tiap halaman; cache hanya untuk tampilan navbar |

---

## 5. Struktur penting

```
lombamate/
├── prisma/schema.prisma        # 6 model (Partner, Join, Profile, User, Session, PasswordReset)
├── src/
│   ├── server.js               # Express + Prisma; semua endpoint /api/*
│   ├── auth.js                 # modul autentikasi (bcrypt, sesi DB, rate limit, reset password)
│   ├── seed.js                 # npm run seed (JSON lama -> Neon)
│   └── data/*.json             # data legacy (sumber seed)
├── public/                     # frontend HTML/CSS/JS (tidak berubah bentuk datanya)
└── .env                        # DATABASE_URL Neon (TIDAK ikut repo)
```

---
*Kelompok B11 — LombaMate. Server: Express 5 + Prisma + PostgreSQL (Neon).*
