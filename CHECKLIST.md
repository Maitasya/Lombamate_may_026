# ✅ Checklist Progres Perbaikan LombaMate

Dokumen ini melacak perbaikan yang sudah selesai terhadap audit 224 butir.
Status: ✔ selesai · 🔄 berjalan · ⬜ belum mulai.

---

## P0 — Keamanan (SElesai 9 Nov 2026)

| # Butir | Perbaikan | Status |
|---|---|---|
| 75, 79 | Password di-hash (bcrypt) di server, tidak ada plaintext | ✔ |
| 76 | Akun tersimpan di server (`src/data/users.json`) | ✔ |
| 77, 80, 83 | Sesi = token acak server + cookie `HttpOnly`; token bisa dicabut (logout) | ✔ |
| 78 | Middleware `requireAuth` menguji cookie di setiap endpoint tulis | ✔ |
| 81, 125 | Pembatasan percobaan login: 5x gagal ⇒ blokir 5 menit | ✔ |
| 85 | `POST /api/partners` wajib login; pemilik dipaksa dari sesi | ✔ |
| 86, 87 | `PUT`/`DELETE /api/partners/:id` identitas dari sesi, field `requester` diabaikan | ✔ |
| 88 | `POST .../joins` memaksa username & nama dari sesi | ✔ |
| 89 | `PUT /api/joins/:id` keputusan hanya pemilik (sesi) | ✔ |
| 90 | `DELETE /api/joins/:id` hanya pengaju sendiri (sesi) | ✔ |
| 91 | `PUT /api/profiles/:username` target wajib sama dengan sesi | ✔ |
| 92 - profil | `GET /api/profiles` (daftar) wajib login — anti scraping massal | ✔ |
| 92 - permintaan | Daftar permintaan gabung disesuaikan pengunjung: pemilik semua, yang masuk miliknya sendiri + anggota diterima, anonim kosong | ✔ |
| 94 | Validasi wajib di backend sudah membaca semua field | ✔ |
| 95–98 | Batas panjang: lomba 100, deskripsi 600, bio 500, nama 60, kampus/jurusan 100, kontak 60 | ✔ |
| 99, 107 | `roles` array 1–6 item × maks 40 karakter; interests/skills maks 12 item | ✔ |
| 100 | Kategori harus dari 8 kategori resmi | ✔ |
| 101 | `contactType` whitelist: WhatsApp/Instagram/Telegram/Email/Discord | ✔ |
| 104, 105 | Deadline `YYYY-MM-DD` valid & tidak boleh lewat | ✔ |
| 106 | `level`, `teamSize`, `scope` harus dari daftar opsi formulir | ✔ |
| 108, 112, 141* | Foto profil harus data-URL gambar png/jpg/webp maks ~600KB | ✔ |
| 109, 110 | URL hanya `http/https` (server **dan** helper `safeUrl()` di frontend untuk `href`) | ✔ |
| 113, 128 | CSP, X-Frame-Options DENY, nosniff, Referrer-Policy (middleware di atas static) | ✔ |
| 115 | Daftar profil hanya untuk yang masuk | ✔ |
| 118 | Permintaan gabung disembunyikan dari pengunjung tidak berkepentingan | ✔ |
| 145 | Permintaan `ditolak` tidak bisa menjadi `diterima` (transisi dibatasi) | ✔ |
| 147 | Transisi status: hanya `menunggu` → `diterima`/`ditolak` | ✔ |
| 148 | Hapus partner menghapus join-nya dalam satu penanganan | ✔ |
| 149 | Permintaan aktif duplikat ditolak (satu pengguna per tim per permintaan aktif) | ✔ |

\* butir 141 (foto membesarkan berkas JSON) masih berlaku sebagian; batas ukuran sudah diberlakukan, format data-URL tetap dipakai sampai migrasi DB.

## Uji yang membuktikan P0

| Uji | Hasil yang diharapkan | Hasil |
|---|---|---|
| Register akun baru | 201 + cookie HttpOnly | ✔ |
| Register regex lemah / password pendek | 400 | ✔ |
| Register username duplikat | 409 | ✔ |
| Login salah** | 401, counter gagal bertambah | ✔ |
| `POST /api/partners` tanpa cookie | 401 | ✔ |
| Palsukan `requester` di body tanpa sesi | 401 (dihiraukan) | ✔ |
| Edit/hapus partner orang lain (dengan sesi) | 403 | ✔ |
| `GET /api/partners/:id` oleh non-pemilik | 403 | ✔ |
| Join memakai `username` orang lain di body | 201 tercatat sebagai **username sesi** | ✔ |
| Pemilik ikut kartunya sendiri | 400 | ✔ |
| Join duplikat | 400 | ✔ |
| Keputusan oleh non-pemilik | 403 | ✔ |
| `ditolak` → `diterima` | 400 | ✔ |
| Hapus join milik orang lain | 403 | ✔ |
| `PUT` profil orang lain | 403 | ✔ |
| `GET /api/profiles` anonim | 401 | ✔ |
| Link `javascript:` / deadline lewat / kategori ngawur / 7 peran | 400 | ✔ |
| Header CSP muncul di file statis | tercantum | ✔ |
| Halaman web: login Maya, render kartu, panel pemilik | 3 kartu, Tanpa error konsol | ✔ |

\*\* uji blokir 5x gagal dilakukan lewat pembacaan kode; percobaan berulang dikendalikan oleh `percobaanGagal` di `src/auth.js`.

---

## P1 — Tinggi

| Butir | Perbaikan | Status |
|---|---|---|
| 131–136 | Migrasi database (PostgreSQL/Neon + Prisma) | ✔ **Selesai 10 Nov 2026** — Partner/Join/Profile di Neon, seed data lama, API tetap sama |
| 137 | **Autentikasi terpusat di database** | ✔ **Selesai 11 Nov 2026** — tabel User (bcrypt), Session (token SHA-256), PasswordReset; users.json/sessions.json tidak lagi dipakai runtime |
| 138 | ID dari autoincrement database | ✔ (`@default(autoincrement())` + sequence dirapikan saat seed) |
| 139, 140, 165, 166 | Unique & foreign key di database | ✔ (Join → Partner FK + onDelete Cascade; Profile PK username; User.username & User.email @unique) |
| 143, 148 | Transaksi kuota & sinkronisasi hapus | ✔ sebagian (hapus partner atomik via Cascade; kuota dicek ulang saat menerima) |
| 133 | Atomic write file JSON | ✔ (auth.js) — tidak lagi dipakai: akun & sesi pindah ke database |
| 168 | Seed terdokumentasi | ✔ `src/seed.js` (jalan dengan `npm run seed`) |
| — | Ganti password, lupa/reset password, kelola sesi aktif, logout semua perangkat | ✔ endpoint + UI (panel lupa password di login, halaman reset.html, menu "Keluar semua perangkat") |
| — | Session fixation & cookie per lingkungan | ✔ token baru tiap login; HttpOnly/SameSite=Lax/Secure saat NODE_ENV=production |
| — | Frontend tidak andal localStorage | ✔ guard memverifikasi sesi ke server (GET /api/auth/me); localStorage hanya cache tampilan |
| 123, 124 | Rate limiting seluruh endpoint | 🔄 login saja (5x/akun, 20x/IP); endpoint lain menyusul |
| 126 | Idempotency operasi tertentu | ⬜ |
| 191–194 | Pengujian otomatis | 🔄 `npm test` cek sintaks semua server; uji manual 18 skenario auth lulus (11 Nov) |

## P2 — Peningkatan produk

Status: ⬜ (notifikasi, bookmark, verifikasi akun, pengelolaan anggota, dsb). Disarankan setelah P1.

## P3 — Penyempurnaan

Status: ⬜ (UI/UX, aksesibilitas, deployment, dokumentasi lengkap).

---

## Bukti migrasi database (screenshot di folder lombamate-screenshots)

| SS | Isi |
|---|---|
| 23 | `prisma/schema.prisma` (model Partner, Join, Profile) |
| 24 | Output `npx prisma db push` tersambung ke Neon + hasil seed + `/api/health` |
| 25 | Respons `GET /api/partners` dari tabel Neon (bentuk data sama) |
| 26 | Prisma Studio menampilkan isi tabel Partner (Join 5, Partner 4, Profile 3) |

## Akun demo

| Akun | Password | Keterangan |
|---|---|---|
| `maya_putri` | `mayamantap123` | terdaftar di server ✔ |
| `adi` | `adimantap123` | terdaftar di server ✔ |
| `mawar123`, `zakiristek` | - | perlu daftar ulang (password lama tidak diketahui) |
