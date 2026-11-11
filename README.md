<div align="center">

# 🚀 LombaMate

**Temukan Partner, Wujudkan Prestasi**

LombaMate adalah web pencari teman satu tim lomba, tempat mahasiswa bisa memasang kebutuhan partner, menemukan tim yang membuka kuota, dan mengajukan diri untuk bergabung hanya dengan satu klik. Setiap postingan memuat peran yang dicari, batas pendaftaran, dan kuota yang tersisa, sehingga kamu langsung tahu tim mana yang cocok denganmu. Dibangun dengan Express dan JavaScript murni, LombaMate dilengkapi pencarian, profil publik, serta sistem terima atau tolak permintaan gabung, jadi tidak ada lagi alasan untuk lomba sendirian.

Aplikasi web pencari teman satu tim untuk lomba, dibangun dengan **Express (Node.js)** sebagai back-end dan **HTML, CSS, JavaScript** sebagai front-end.

![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-5.x-000000?logo=express&logoColor=white)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)

</div>

---

## 📋 Identitas

| | |
|---|---|
| **Mata Kuliah** | Pemweb B |
| **Topik** | Express API (REST API dengan GET, POST, PUT, DELETE) |
| **Nama** | Maitasya Rohmatul Ula |
| **NRP** | 5027251026 |

---

## 1. Pendahuluan

### 1.1 Latar Belakang
Banyak mahasiswa ingin mengikuti lomba tetapi kesulitan menemukan rekan satu tim yang memiliki keahlian yang sesuai, misalnya frontend, backend, UI/UX, atau penulis. **LombaMate** menyediakan satu tempat bagi mahasiswa untuk memasang kebutuhan partner lomba, mencari tim yang sedang membuka kuota, dan mengajukan diri untuk bergabung.

### 1.2 Tujuan
1. Membangun aplikasi web dengan **Express** sebagai back-end dan **HTML, CSS, JavaScript** sebagai front-end.
2. Menerapkan operasi **CRUD** melalui REST API:
   - **GET**: menampilkan seluruh data pada halaman web.
   - **POST**: menambahkan data melalui form.
   - **PUT**: mengubah data melalui fitur Edit.
   - **DELETE**: menghapus data melalui tombol Hapus.
3. Menyimpan data secara persisten di **database PostgreSQL (Neon) melalui Prisma ORM**.

---

## 2. Fitur

### Fitur wajib tugas (CRUD)
| Operasi | Endpoint | Cara pakai di web |
|---|---|---|
| **GET** | `GET /api/partners` | Seluruh kartu partner tampil di halaman Beranda |
| **POST** | `POST /api/partners` | Form pada halaman **Tambah Partner** |
| **PUT** | `PUT /api/partners/:id` | Tombol **✏️ Edit** pada kartu milik sendiri |
| **DELETE** | `DELETE /api/partners/:id` | Tombol **🗑️ Hapus** pada kartu milik sendiri, dengan dialog konfirmasi |

### Fitur tambahan
- 🔐 Login dan daftar akun.
- 🔍 Pencarian dan filter berdasarkan kategori dan deadline.
- 🤝 Tombol **Ikuti** untuk meminta bergabung ke tim, lengkap dengan kuota tersisa.
- ✅ Pemilik postingan dapat **Terima** atau **Tolak** permintaan gabung.
- 👥 Tab **Cari Teman** dan **Tim Saya**.
- 👤 Profil publik yang bisa dilihat pengguna lain (`profil.html?u=username`).
- 🛡️ Hanya pemilik postingan yang boleh mengubah atau menghapus (server mengembalikan `403` bagi selain pemilik).
- ✔️ Validasi data di sisi server (`400` jika data tidak lengkap).

---

## 3. Teknologi

| Lapisan | Teknologi |
|---|---|
| Back-end | Node.js, Express 5 |
| Front-end | HTML5, CSS3, JavaScript (vanilla, `fetch` API) |
| Database | **PostgreSQL (Neon) via Prisma ORM** |
| Pengujian API | Postman |

---

## 3b. Database (Prisma + PostgreSQL Neon)

Setelah sebelumnya memakai berkas JSON, **semua data** — postingan partner, permintaan gabung, profil, akun, dan sesi login — kini tersimpan di **PostgreSQL** yang di-hosting **Neon** (region Singapore), dikelola lewat **Prisma ORM** skema `prisma/schema.prisma` (model `Partner`, `Join`, `Profile`, `User`, `Session`, `PasswordReset`).

- `DATABASE_URL` disimpan di `.env` (tidak di-commit; sudah masuk `.gitignore`).
- Struktur data yang dikirim ke frontend **sama persis** dengan versi JSON, jadi frontend tidak perlu berubah.
- Perintah penting:
  ```bash
  npm install             # pasang dependensi (sekali)
  npx prisma db push      # buat/sinkron tabel di Neon
  npm run seed            # salin data & akun lama dari src/data/*.json ke Neon
  npm start               # nyalakan server
  npx prisma studio       # (opsional) Prisma Studio untuk melihat isi tabel
  ```
- Akun & sesi: tabel `User` (password hash bcrypt) dan `Session` (id = SHA-256 token cookie, token mentah tidak pernah disimpan di database).

### Keamanan autentikasi (src/auth.js)

- Registrasi/login **sepenuhnya di server**; identitas pengguna selalu dibuktikan lewat **cookie `lombamate_session` (HttpOnly, SameSite=Lax, `Secure` otomatis saat `NODE_ENV=production`)** — frontend tidak pernah dipercaya.
- **Session fixation**: setiap login/registrasi membuat token baru; token lama tidak pernah dipakai ulang.
- **Anti brute force**: 5× gagal per akun (atau 20× per IP) = blokir 5 menit.
- **Ganti password** (`POST /api/auth/change-password`): mematikan sesi di perangkat lain otomatis.
- **Lupa password** (`POST /api/auth/forgot` + `/api/auth/reset`): token sekali pakai berlaku 30 menit, disimpan sebagai hash; semua sesi dimatikan setelah reset. Pengiriman email sungguhan butuh layanan SMTP — di mode pengembangan token dikembalikan di respons untuk demo.
- **Kelola sesi aktif** (`GET /api/auth/sessions`, `DELETE /api/auth/sessions/:id`, `POST /api/auth/logout-all`): lihat dan matikan sesi per perangkat.
- Halaman terlindung **memverifikasi sesi ke server** (`GET /api/auth/me`) — `localStorage` hanya cache tampilan navbar, bukan bukti identitas.
- Cek cepat "password tidak plaintext": `node src/cek-hash.js`.

### Diagram kartu kuota

```sql
Partner 1 ── * Join          -- onDelete Cascade (hapus partner = hapus join-nya)
User    1 ── * Session       -- sesi login per perangkat
User    1 ── * PasswordReset -- token ganti password sekali pakai
```

---

## 4. Arsitektur

```
 Browser (HTML + CSS + JS)
        │   fetch()  ── JSON ──►
        ▼
 Express server (src/server.js)
   ├─ express.static  → menyajikan folder public/
   ├─ express.json    → membaca body JSON
   ├─ requireAuth     → cookie HttpOnly dari src/auth.js
   └─ REST API /api/* → query via Prisma ORM
        ▼
 PostgreSQL (Neon, region Singapore):
   Partner · Join · Profile · User · Session · PasswordReset
   (akun & sesi juga di database - bukan lagi file JSON)
```

### Struktur folder
```
lombamate/
├── src/
│   ├── server.js            # server Express + semua endpoint
│   └── data/
│       ├── partners.json    # data partner (data utama CRUD)
│       ├── joins.json       # permintaan gabung
│       └── profiles.json    # profil publik
├── public/
│   ├── index.html           # Beranda (GET + Edit + Hapus)
│   ├── tambah-partner.html  # form Tambah (POST) dan Edit (PUT)
│   ├── profil.html          # profil pengguna
│   ├── login.html           # masuk dan daftar
│   ├── *.css                # style.css, app.css, profil.css, ...
│   ├── assets/              # gambar maskot
│   └── js/
│       ├── api.js           # semua pemanggilan ke back-end
│       ├── beranda.js       # tampil kartu, edit, hapus
│       ├── tambah-partner.js# form tambah / ubah
│       ├── profil.js, login.js, auth.js, utils.js
├── package.json
└── README.md
```

---

## 5. Dokumentasi API

Base URL: `http://localhost:3000`

### 5.1 Endpoint utama (CRUD)

| Method | Endpoint | Body | Respons sukses | Respons gagal |
|---|---|---|---|---|
| GET | `/api/partners` | – | `200` daftar partner | – |
| GET | `/api/partners/:id` | – | `200` satu partner (khusus pemilik) | `403`, `404` |
| POST | `/api/partners` | data partner | `201` partner baru | `400`, `401` |
| PUT | `/api/partners/:id` | data partner | `200` partner terbaru | `400`, `403`, `404` |
| DELETE | `/api/partners/:id` | – | `200` pesan sukses | `403`, `404` |

> Identitas pemilik **tidak dikirim dari klien** — server mengambilnya dari cookie sesi yang terverifikasi database.

### 5.2 Contoh request

**POST `/api/partners`**
```json
{
  "category": "teknologi",
  "competition": "Web Development Competition",
  "organizer": "Politeknik Negeri Surabaya",
  "level": "Nasional",
  "deadline": "2026-11-25",
  "slots": 2,
  "roles": ["Frontend", "Backend"],
  "scope": "Satu kampus",
  "description": "Mencari partner untuk lomba web.",
  "contactType": "WhatsApp",
  "contact": "08123456789",
  "ownerName": "Maya Putri",
  "ownerCampus": "ITS",
  "ownerUsername": "maya_putri"
}
```

**PUT `/api/partners/:id`** (hanya pemilik yang sedang masuk)
```json
{ "slots": 1 }
```

**DELETE `/api/partners/:id`** (hanya pemilik yang sedang masuk, tanpa body)

### 5.3 Aturan validasi
- `category`, `competition`, `roles` (minimal satu), dan `contact` wajib diisi.
- `slots` boleh kosong, atau bilangan bulat 1 sampai 10.
- `PUT` dan `DELETE` hanya diizinkan untuk pemilik data (sesi login di server = `ownerUsername`).

### 5.4 Endpoint tambahan
| Method | Endpoint | Fungsi |
|---|---|---|
| POST | `/api/partners/:id/joins` | Mengajukan permintaan gabung |
| PUT | `/api/joins/:id` | Pemilik menerima atau menolak permintaan |
| DELETE | `/api/joins/:id` | Membatalkan permintaan atau meninggalkan tim |
| GET | `/api/profiles`, `/api/profiles/:username` | Melihat profil publik |
| PUT | `/api/profiles/:username` | Menyimpan profil sendiri |

### 5.5 Endpoint autentikasi
| Method | Endpoint | Fungsi |
|---|---|---|
| POST | `/api/auth/register` | Membuat akun baru, otomatis masuk |
| POST | `/api/auth/login` | Masuk (dibatasi 5x gagal ⇒ jeda 5 menit) |
| POST | `/api/auth/logout` | Keluar, sesi dihapus di server |
| GET | `/api/auth/me` | Memeriksa siapa pengguna yang sedang masuk |
| POST | `/api/auth/change-password` | Ganti password (sesi perangkat lain dicabut) |
| POST | `/api/auth/forgot` | Minta tautan ganti password (token sekali pakai, 30 menit) |
| POST | `/api/auth/reset` | Ganti password lewat token |
| GET | `/api/auth/sessions` | Daftar sesi aktif per perangkat |
| DELETE | `/api/auth/sessions/:id` | Matikan satu sesi |
| POST | `/api/auth/logout-all` | Keluar dari semua perangkat |

---

## 5b. Keamanan (lapisan server)

Sebelumnya login hanya berjalan di browser, sehingga identitas bisa dipalsukan dengan mengirim field `requester` ke API. Sekarang keamanan ditangani server:

1. **Password di-hash** dengan **bcrypt** (`src/auth.js`), tersimpan di tabel `User` (PostgreSQL/Neon); password mentah tidak pernah disimpan.
2. **Sesi = cookie `HttpOnly`** yang dibuat server (token acak 32 byte, berlaku 7 hari). JavaScript di browser tidak bisa membacanya, dan database hanya menyimpan SHA-256 dari token — token mentah tidak pernah disimpan.
3. **Semua endpoint tulis wajib login** melalui middleware `requireAuth`; identitas diambil dari sesi yang diverifikasi ke database, **bukan dari body maupun localStorage**.
4. **Validasi backend menyeluruh**: kategori/tingkat/jenis kontak harus dari daftar resmi, panjang teks dibatasi, deadline wajib format `YYYY-MM-DD` dan tidak boleh lewat, link wajib `http/https`.
5. **Header keamanan**: Content-Security-Policy, X-Frame-Options DENY, nosniff, Referrer-Policy.
6. **Aturan keputusan join**: hanya permintaan berstatus `menunggu` yang bisa diputuskan, permintaan yang ditolak tidak bisa diaktifkan ulang, kuota dicek ulang saat menerima, dan permintaan aktif duplikat diblokir.
7. **Data privat sensitif**: daftar `GET /api/profiles` khusus pengguna yang sudah masuk; daftar permintaan gabung hanya terlihat bagi pemilik kartu atau pengajunya sendiri.
8. **Pembatasan percobaan login**: 5 kali gagal dalam satu kombinasi IP+username ⇒ diblokir 5 menit.

---

## 6. Cara Menjalankan

### 6.1 Prasyarat
- [Node.js](https://nodejs.org/) versi 18 atau lebih baru (cek dengan `node -v`).
- Koneksi internet saat `npm install` pertama kali.
- Akun database **PostgreSQL** (project ini memakai [Neon](https://neon.tech) — ada paket gratis).

### 6.2 Langkah-langkah
1. **Clone** repository, lalu buka terminal di foldernya.
   ```bash
   git clone https://github.com/Maitasya/lombamate.git
   cd lombamate
   ```
2. **Pasang dependensi** (cukup sekali; folder `node_modules` dibuat otomatis).
   ```bash
   npm install
   ```
3. **Siapkan koneksi database**: buat file `.env` di dalam folder (tidak ikut repo) berisi:
   ```
   DATABASE_URL="postgresql://USER:PASSWORD@HOST/dbname?sslmode=require"
   ```
4. **Buat tabel** di database dari skema Prisma, lalu **isi data & akun demo**:
   ```bash
   npx prisma db push     # membuat tabel Partner, Join, Profile, User, Session, PasswordReset
   npm run seed           # mengisi data & akun demo dari src/data/*.json
   ```
   Akun demo: `maya_putri` / `mayamantap123`, `adi` / `adimantap123`, `uji_pemilik` / `rahasia123`, `uji_cari` / `rahasia456`.
5. **Jalankan server.**
   ```bash
   npm start
   ```
   Alternatif: `node src/server.js`.
6. Jika berhasil, terminal menampilkan:
   ```
   Server jalan di http://localhost:3000
   ```
7. **Buka browser** dan akses <http://localhost:3000>.
8. Untuk menghentikan server, tekan `Ctrl + C` di terminal.

### 6.3 Mengganti port (opsional)
```bash
# Windows PowerShell
$env:PORT=4000; npm start

# Linux / macOS
PORT=4000 npm start
```

### 6.4 Alur mencoba aplikasi
1. Buka halaman **Masuk**, lalu daftar akun baru dan masuk.
2. Klik **Tambah Partner**, isi form, lalu klik **Tambah Partner** → kartu baru muncul di Beranda **(POST)**.
3. Pada kartu milik sendiri, klik **Edit**, ubah isi form, lalu **Simpan Perubahan** → kartu berubah **(PUT)**.
4. Klik **Hapus** lalu **Ya, Hapus** → kartu hilang **(DELETE)**.
5. Beranda otomatis memuat seluruh data setiap halaman dibuka **(GET)**.

### 6.5 Pemecahan masalah
| Masalah | Penyebab dan solusi |
|---|---|
| `Cannot find module 'express'` | Belum menjalankan `npm install`. |
| `PrismaClientInitializationError` / `P1001` (tidak bisa ke database) | `DATABASE_URL` salah atau kosong; cek isi `.env` dan koneksi internet (Neon butuh `sslmode=require`). |
| Error `User was not found` saat masuk / tabel kosong | Belum menjalankan `npx prisma db push` dan `npm run seed` (lihat 6.2 langkah 4). |
| `npm start` tidak dikenali | Pastikan terminal berada di folder `lombamate` (yang berisi `package.json`). |
| `EADDRINUSE: address already in use` | Port 3000 sedang dipakai; ganti port (lihat 6.3). |
| Halaman menampilkan "Tidak bisa terhubung ke server" | Server belum berjalan; jalankan `npm start`. |

---

## 7. Hasil dan Pengujian

> Letakkan folder `screenshots/` di samping README ini agar gambar tampil.

### 7.1 Pengujian melalui web

| No | Operasi | Keterangan | Bukti |
|---|---|---|---|
| 1 | GET | Seluruh kartu partner tampil di Beranda | ![](screenshots/01-beranda-tampilan.png) |
| 2 | POST | Form Tambah Partner terisi | ![](screenshots/03-post-form-terisi.png) |
| 3 | POST | Kartu baru muncul di Beranda | ![](screenshots/04-post-beranda-kartu-baru.png) |
| 4 | PUT | Form Edit | ![](screenshots/05-put-form-edit.png) |
| 5 | PUT | Kuota berubah setelah disimpan | ![](screenshots/06-put-hasil-kuota-berubah.png) |
| 6 | DELETE | Dialog konfirmasi hapus | ![](screenshots/07-delete-konfirmasi.png) |
| 7 | DELETE | Kartu hilang dari Beranda | ![](screenshots/08-delete-hasil-kartu-hilang.png) |

### 7.2 Pengujian API dengan Postman

| No | Pengujian | Hasil yang diharapkan | Bukti |
|---|---|---|---|
| 1 | `GET /api/partners` | `200 OK` | ![](screenshots/09-postman-get-semua-partner.png) |
| 2 | `POST /api/partners` | `201 Created` | ![](screenshots/10-postman-post-tambah-partner.png) |
| 3 | `PUT /api/partners/:id` | `200 OK` | ![](screenshots/12-postman-put-ubah-partner.png) |
| 4 | `DELETE /api/partners/:id` | `200 OK` | ![](screenshots/13-postman-delete-hapus-partner.png) |
| 5 | `POST` data kosong | `400 Bad Request` | ![](screenshots/15-postman-post-gagal-400.png) |
| 6 | `PUT` oleh bukan pemilik | `403 Forbidden` | ![](screenshots/16-postman-put-bukan-pemilik-403.png) |

> Bagian 7.2 hanya diisi jika kamu membuat screenshot Postman; hapus bagian ini jika tidak dipakai.

---

## 8. Kesimpulan
Aplikasi **LombaMate** berhasil dibangun dengan Express sebagai back-end dan HTML, CSS, JavaScript sebagai front-end. Keempat operasi wajib (GET, POST, PUT, DELETE) berjalan dan terhubung ke antarmuka web, serta dilengkapi validasi data dan pembatasan hak akses pemilik. Seluruh data — postingan partner, permintaan gabung, profil, akun, dan sesi login — kini tersimpan **persisten di PostgreSQL (Neon) melalui Prisma ORM**, sehingga tetap ada setelah server dimatikan. Autentikasi ditangani sepenuhnya di server: password di-hash bcrypt, sesi cookie HttpOnly diverifikasi ke database di setiap permintaan, dan frontend tidak dipercaya menyimpan identitas.

### Pengembangan lanjutan
- Kirim tautan "lupa password" lewat email sungguhan (layanan SMTP seperti Resend/Gmail).
- Rate limiting untuk seluruh endpoint (mis. `express-rate-limit`), bukan hanya login.
- Transaksi kuota partner (`prisma.$transaction`) agar benar-benar atomik.

---

<div align="center">

Dibuat untuk tugas modul **Express API** · Institut Teknologi Sepuluh Nopember

</div>