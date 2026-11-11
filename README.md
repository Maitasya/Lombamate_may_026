# 🚀 LombaMate

<div align="center">

**Temukan Partner, Wujudkan Prestasi**

Aplikasi web pencari teman satu tim lomba untuk mahasiswa. LombaMate membantu mahasiswa menemukan partner berdasarkan kebutuhan keahlian, membuka kesempatan bergabung ke dalam tim, dan mengelola permintaan gabung dalam satu platform.

Dibangun menggunakan Express.js, JavaScript vanilla, dan PostgreSQL melalui Prisma ORM.

![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-5.x-000000?logo=express&logoColor=white)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6.19.3-2D3748?logo=prisma&logoColor=white)

</div>

---

## Identitas

| Keterangan | Informasi |
|---|---|
| Mata Kuliah | Pemweb B |
| Topik | Express API (REST API dengan GET, POST, PUT, DELETE) |
| Nama | Maitasya Rohmatul Ula |
| NRP | 5027251026 |

---

## 1. Pendahuluan

### 1.1 Latar Belakang

Banyak mahasiswa ingin mengikuti kompetisi, tetapi kesulitan menemukan rekan satu tim yang memiliki keahlian sesuai kebutuhan lomba, seperti frontend, backend, UI/UX, maupun penulisan.

LombaMate hadir sebagai platform yang mempertemukan mahasiswa dengan calon partner lomba. Pengguna dapat membuat postingan kebutuhan anggota tim, mencari tim yang masih membuka kuota, serta mengajukan permintaan untuk bergabung.

### 1.2 Tujuan

1. Membangun aplikasi web menggunakan Express.js sebagai back-end dan HTML, CSS, serta JavaScript sebagai front-end.
2. Menerapkan operasi CRUD melalui REST API:
   - **GET:** mengambil dan menampilkan data.
   - **POST:** menambahkan data baru.
   - **PUT:** memperbarui data yang sudah ada.
   - **DELETE:** menghapus data.
3. Mengimplementasikan autentikasi dan pembatasan hak akses pengguna.
4. Menyimpan data secara persisten menggunakan PostgreSQL melalui Prisma ORM.

---

## 2. Fitur Aplikasi

### 2.1 Fitur Utama (CRUD)

| Operasi | Endpoint | Implementasi pada Web |
|---|---|---|
| GET | `GET /api/partners` | Menampilkan daftar postingan partner di halaman Beranda |
| POST | `POST /api/partners` | Menambahkan postingan melalui form Tambah Partner |
| PUT | `PUT /api/partners/:id` | Mengedit postingan milik sendiri |
| DELETE | `DELETE /api/partners/:id` | Menghapus postingan milik sendiri dengan dialog konfirmasi |

### 2.2 Fitur Tambahan

- 🔐 Registrasi dan login pengguna.
- 🔍 Pencarian serta filter berdasarkan kategori dan deadline.
- 🤝 Pengajuan permintaan bergabung ke dalam tim.
- ✅ Pemilik postingan dapat menerima atau menolak permintaan bergabung.
- 👥 Tab Cari Teman dan Tim Saya.
- 👤 Profil pengguna yang dapat dilihat secara publik.
- 📊 Informasi kuota anggota yang masih tersedia.
- 🔒 Pembatasan akses edit dan hapus hanya untuk pemilik postingan.
- 🛡️ Validasi data pada sisi server.
- 🔑 Fitur lupa password dan reset password.
- 📱 Pengelolaan sesi login pada beberapa perangkat.

---

## 3. Teknologi

| Lapisan | Teknologi |
|---|---|
| Runtime | Node.js 20 atau lebih baru |
| Back-end | Express 5.x |
| Front-end | HTML5, CSS3, JavaScript vanilla |
| Komunikasi | Fetch API dan JSON |
| Database | PostgreSQL (Neon) |
| ORM | Prisma 6.19.3 |
| Database Adapter | `@prisma/adapter-neon` 6.19.3 |
| Autentikasi | bcryptjs 3.0.3 |
| Pengujian API | Postman |
| Version Control | Git dan GitHub |

---

## 4. Database dan Pengelolaan Data

LombaMate menggunakan PostgreSQL yang di-host melalui Neon sebagai tempat penyimpanan data. Pengelolaan database dilakukan menggunakan Prisma ORM dengan skema pada `prisma/schema.prisma`.

Database memiliki enam model utama:

| Model | Fungsi |
|---|---|
| `Partner` | Menyimpan informasi postingan kebutuhan partner lomba |
| `Join` | Menyimpan permintaan pengguna untuk bergabung ke tim |
| `Profile` | Menyimpan informasi profil pengguna |
| `User` | Menyimpan akun dan password yang sudah di-hash |
| `Session` | Menyimpan informasi sesi login pengguna |
| `PasswordReset` | Menyimpan token untuk proses reset password |

### 4.1 Konfigurasi Database

- Koneksi database disimpan pada variabel `DATABASE_URL` di file `.env`.
- File `.env` tidak dimasukkan ke repository dan sudah dicantumkan dalam `.gitignore`.
- Prisma ORM digunakan untuk melakukan operasi pembacaan dan perubahan data.
- Data utama aplikasi disimpan di PostgreSQL sehingga tetap tersedia setelah server dimatikan.

### 4.2 Data Awal (Seed)

Folder `src/data/` menyediakan berkas JSON sebagai sumber data awal untuk proses pengisian database.

Perintah yang digunakan:

```bash
npx prisma db push
npm run seed
```

Berkas JSON tersebut berfungsi sebagai sumber data awal, bukan sebagai penyimpanan utama saat aplikasi berjalan.

### 4.3 Keamanan Penyimpanan Akun

- Password pengguna di-hash menggunakan bcryptjs sebelum disimpan.
- Token sesi mentah tidak disimpan langsung di database.
- Data sesi dikelola melalui model `Session`.
- Token reset password disimpan dalam bentuk hash sesuai implementasi autentikasi.

---

## 5. Arsitektur Aplikasi

LombaMate menggunakan arsitektur client-server. Browser berkomunikasi dengan server melalui REST API menggunakan Fetch API dan pertukaran data JSON.

```text
Browser
(HTML + CSS + JavaScript)
        |
        | Fetch API / JSON
        v
Express Server
(src/server.js)
        |
        ├── express.static
        |   Menyajikan folder public/
        |
        ├── express.json
        |   Membaca request JSON
        |
        ├── requireAuth
        |   Memeriksa autentikasi pengguna
        |
        ├── REST API
        |   Mengelola data aplikasi
        |
        v
Prisma ORM
        |
        v
PostgreSQL (Neon)
        |
        ├── Partner
        ├── Join
        ├── Profile
        ├── User
        ├── Session
        └── PasswordReset
```

### 5.1 Struktur Folder

```text
lombamate/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── server.js
│   ├── auth.js
│   ├── seed.js
│   ├── cek-hash.js
│   └── data/
│       ├── users.json
│       ├── partners.json
│       ├── joins.json
│       ├── profiles.json
│       └── sessions.json
├── public/
│   ├── index.html
│   ├── tambah-partner.html
│   ├── profil.html
│   ├── login.html
│   ├── reset.html
│   ├── *.css
│   ├── assets/
│   └── js/
│       ├── api.js
│       ├── auth.js
│       ├── beranda.js
│       ├── tambah-partner.js
│       ├── profil.js
│       ├── login.js
│       ├── reset.js
│       └── utils.js
├── screenshots/
├── postman/
├── .env
├── package.json
├── package-lock.json
└── README.md
```

Keterangan:
- `prisma/`: konfigurasi skema database.
- `src/server.js`: server Express dan endpoint API.
- `src/auth.js`: pengelolaan autentikasi dan sesi.
- `src/seed.js`: pengisian data awal ke database.
- `src/cek-hash.js`: utilitas pengecekan hash password.
- `src/data/`: sumber data awal berbentuk JSON.
- `public/`: halaman, aset, CSS, dan JavaScript front-end.
- `screenshots/`: bukti dokumentasi pengujian.
- `postman/`: koleksi dan dokumentasi pengujian API.

---

## 6. Dokumentasi API

Base URL:

```text
http://localhost:3000
```

### 6.1 Endpoint Utama (CRUD)

| Method | Endpoint | Body | Respons Sukses | Respons Gagal |
|---|---|---|---|---|
| GET | `/api/partners` | - | `200` daftar partner | - |
| GET | `/api/partners/:id` | - | `200` detail partner milik sendiri | `400`, `401`, `403`, `404` |
| POST | `/api/partners` | Data partner | `201` partner baru | `400`, `401` |
| PUT | `/api/partners/:id` | Data perubahan | `200` partner terbaru | `400`, `401`, `403`, `404` |
| DELETE | `/api/partners/:id` | - | `200` pesan sukses | `401`, `403`, `404` |

**Catatan autentikasi:** Identitas pemilik postingan tidak ditentukan melalui `ownerUsername` yang dikirim dari browser. Server mengambil identitas pengguna dari sesi login yang sudah diverifikasi.

### 6.2 Contoh Request

**POST `/api/partners`**

Contoh body JSON untuk membuat postingan partner:

```json
{
  "category": "teknologi",
  "competition": "Web Development Competition",
  "organizer": "Politeknik Negeri Surabaya",
  "level": "Nasional",
  "deadline": "2026-11-25",
  "slots": 2,
  "roles": [
    "Frontend",
    "Backend"
  ],
  "scope": "Satu kampus",
  "description": "Mencari partner untuk lomba web.",
  "contactType": "WhatsApp",
  "contact": "08123456789",
  "ownerCampus": "ITS"
}
```

`ownerName` dan `ownerUsername` tidak perlu dikirim karena server mengisinya berdasarkan pengguna yang sedang login.

**PUT `/api/partners/:id`**

Contoh mengubah kuota postingan:

```json
{
  "slots": 1
}
```

**DELETE `/api/partners/:id`**

Tidak membutuhkan body. Penghapusan hanya dapat dilakukan oleh pemilik postingan yang sudah login.

### 6.3 Aturan Validasi

- Kategori, nama kompetisi, minimal satu peran, dan kontak wajib diisi.
- Jumlah kuota harus berupa bilangan bulat 1 sampai 10 apabila diisi.
- Data diperiksa kembali oleh server sebelum disimpan.
- Pengguna harus login untuk melakukan operasi tulis.
- Edit dan hapus postingan hanya diizinkan untuk pemiliknya.

### 6.4 Endpoint Tambahan

| Method | Endpoint | Fungsi | Akses |
|---|---|---|---|
| POST | `/api/partners/:id/joins` | Mengajukan permintaan bergabung | Login |
| PUT | `/api/joins/:id` | Menerima atau menolak permintaan gabung | Login |
| DELETE | `/api/joins/:id` | Membatalkan permintaan atau meninggalkan tim | Login |
| GET | `/api/profiles` | Melihat daftar profil | Login |
| GET | `/api/profiles/:username` | Melihat profil berdasarkan username | Publik |
| PUT | `/api/profiles/:username` | Memperbarui profil sendiri | Login |

### 6.5 Endpoint Autentikasi

| Method | Endpoint | Fungsi |
|---|---|---|
| POST | `/api/auth/register` | Membuat akun baru |
| POST | `/api/auth/login` | Login pengguna |
| POST | `/api/auth/logout` | Logout dan menghapus sesi |
| GET | `/api/auth/me` | Memeriksa pengguna yang sedang login |
| GET | `/api/auth/sessions` | Melihat daftar sesi aktif |
| DELETE | `/api/auth/sessions/:id` | Mengakhiri sesi tertentu |
| POST | `/api/auth/logout-all` | Logout dari semua perangkat |
| POST | `/api/auth/change-password` | Mengganti password |
| POST | `/api/auth/forgot` | Meminta proses reset password |
| POST | `/api/auth/reset` | Mengatur ulang password melalui token |

### 6.6 Endpoint Sistem

| Method | Endpoint | Fungsi | Respons |
|---|---|---|---|
| GET | `/api/health` | Memeriksa koneksi database PostgreSQL Neon | `200` jika terhubung, `500` jika gagal |

---

## 7. Keamanan Aplikasi

Keamanan LombaMate ditangani pada sisi server agar pengguna tidak dapat menentukan identitas maupun hak akses hanya dengan memanipulasi data dari browser.

### 7.1 Autentikasi dan Sesi

1. **Password hashing:** Password disimpan dalam bentuk hash menggunakan bcryptjs, bukan sebagai teks biasa.
2. **Cookie HttpOnly:** Autentikasi menggunakan cookie sesi `lombamate_session` yang tidak dapat dibaca melalui JavaScript browser.
3. **Verifikasi sesi:** Server memeriksa sesi melalui database sebelum memberikan akses ke endpoint yang dilindungi.
4. **Session fixation:** Login dan registrasi membuat token sesi baru.
5. **Penyimpanan token:** Database menyimpan hash SHA-256 token sesi, bukan token mentah.
6. **Pengelolaan sesi:** Pengguna dapat melihat sesi aktif, mengakhiri sesi tertentu, maupun logout dari semua perangkat.
7. **Reset password:** Token reset memiliki masa berlaku dan digunakan untuk proses pengaturan ulang password.

### 7.2 Validasi dan Hak Akses

- Validasi input dilakukan di sisi server.
- Identitas pengguna berasal dari sesi yang sudah diverifikasi.
- Pengguna tidak dapat mengubah atau menghapus postingan milik orang lain.
- Daftar profil dan permintaan gabung memiliki pembatasan akses sesuai jenis penggunanya.
- Permintaan gabung diperiksa berdasarkan status dan hak akses sebelum diproses.
- Kuota diperiksa kembali saat permintaan diterima.

### 7.3 Perlindungan Tambahan

Aplikasi juga menerapkan konfigurasi keamanan HTTP, antara lain:

- Content Security Policy.
- X-Frame-Options.
- X-Content-Type-Options (`nosniff`).
- Referrer-Policy.

**Catatan:** Detail batas percobaan login dan konfigurasi keamanan lainnya mengikuti implementasi aktual pada `src/auth.js` dan `src/server.js`. Pengiriman email reset password sungguhan memerlukan konfigurasi layanan email; mode pengembangan dapat digunakan untuk demonstrasi token reset.

---

## 8. Cara Menjalankan Aplikasi

### 8.1 Prasyarat

Sebelum menjalankan aplikasi, pastikan perangkat sudah memiliki:

- Node.js versi 20 atau lebih baru.
- npm.
- Git.
- Akun PostgreSQL melalui Neon.
- Koneksi internet untuk instalasi dependensi dan koneksi database.

### 8.2 Clone Repository

Buka terminal, kemudian jalankan:

```bash
git clone https://github.com/Maitasya/Lombamate_may_026.git lombamate
cd lombamate
```

### 8.3 Instalasi Dependensi

Jalankan perintah:

```bash
npm install
```

Perintah tersebut akan memasang seluruh dependensi berdasarkan `package.json` dan `package-lock.json`.

### 8.4 Konfigurasi Database

Buat file `.env` di direktori utama proyek.

Isi dengan konfigurasi koneksi PostgreSQL dari Neon:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/dbname?sslmode=require"
```

Ganti nilai konfigurasi sesuai informasi koneksi database milik masing-masing.

**Penting:** Jangan membagikan isi `.env` atau mengunggahnya ke repository publik.

### 8.5 Membuat Tabel dan Mengisi Data

Jalankan:

```bash
npx prisma db push
npm run seed
```

Keterangan:
- `npx prisma db push`: menyinkronkan skema Prisma dengan database.
- `npm run seed`: mengisi database menggunakan data awal dari folder `src/data/`.

### 8.6 Menjalankan Server

Jalankan:

```bash
npm start
```

Alternatif:

```bash
node src/server.js
```

Jika berhasil, terminal akan menampilkan:

```text
Server jalan di http://localhost:3000
```

### 8.7 Membuka Aplikasi

Buka browser dan akses:

http://localhost:3000

Untuk menghentikan server, tekan `Ctrl + C` pada terminal.

### 8.8 Mengganti Port (Opsional)

Windows PowerShell:

```powershell
$env:PORT=4000; npm start
```

Linux/macOS:

```bash
PORT=4000 npm start
```

---

## 9. Alur Penggunaan Aplikasi

1. Buka halaman Masuk dan buat akun baru.
2. Login menggunakan akun yang telah dibuat.
3. Buka halaman Tambah Partner untuk membuat postingan kebutuhan anggota tim.
4. Isi informasi lomba, peran yang dibutuhkan, kuota, deadline, dan kontak.
5. Setelah disimpan, postingan akan tampil di halaman Beranda.
6. Pengguna lain dapat mencari postingan dan mengajukan permintaan bergabung.
7. Pemilik postingan dapat melihat permintaan dan memilih untuk menerima atau menolak.
8. Pengguna dapat mengelola profil serta melihat tim yang diikuti.
9. Pemilik postingan dapat mengedit atau menghapus postingan miliknya.

---

## 10. Pengujian Aplikasi

### 10.1 Pengujian melalui Web

| No. | Operasi | Keterangan | Bukti |
|---:|---|---|---|
| 1 | GET | Seluruh kartu partner tampil di Beranda | `screenshots/01-beranda-tampilan.png` |
| 2 | POST | Form Tambah Partner terisi | `screenshots/03-post-form-terisi.png` |
| 3 | POST | Kartu baru muncul di Beranda | `screenshots/04-post-beranda-kartu-baru.png` |
| 4 | PUT | Form Edit tampil | `screenshots/05-put-form-edit.png` |
| 5 | PUT | Kuota berubah setelah disimpan | `screenshots/06-put-hasil-kuota-berubah.png` |
| 6 | DELETE | Dialog konfirmasi penghapusan | `screenshots/07-delete-konfirmasi.png` |
| 7 | DELETE | Kartu hilang dari Beranda | `screenshots/08-delete-hasil-kartu-hilang.png` |

### 10.2 Pengujian API melalui Postman

| No. | Pengujian | Hasil yang Diharapkan | Bukti |
|---:|---|---|---|
| 1 | `GET /api/partners` | `200 OK` | `screenshots/09-postman-get-semua-partner.png` |
| 2 | `POST /api/partners` | `201 Created` | `screenshots/10-postman-post-tambah-partner.png` |
| 3 | `PUT /api/partners/:id` | `200 OK` | `screenshots/12-postman-put-ubah-partner.png` |
| 4 | `DELETE /api/partners/:id` | `200 OK` | `screenshots/13-postman-delete-hapus-partner.png` |
| 5 | POST dengan data kosong | `400 Bad Request` | `screenshots/15-postman-post-gagal-400.png` |
| 6 | PUT oleh bukan pemilik | `403 Forbidden` | `screenshots/16-postman-put-bukan-pemilik-403.png` |

### 10.3 Pengujian Keamanan

Pengujian keamanan dilakukan untuk memastikan server tidak memberikan akses kepada pengguna yang tidak memiliki hak.

Beberapa skenario pengujian:

- Mengakses endpoint yang membutuhkan login tanpa autentikasi.
- Mengedit postingan menggunakan akun yang bukan pemilik.
- Menghapus postingan menggunakan akun yang bukan pemilik.
- Mengubah status permintaan gabung tanpa hak sebagai pemilik.
- Memeriksa sesi login dan proses logout.
- Memeriksa penyimpanan password dalam bentuk hash.

> Letakkan seluruh screenshot yang digunakan pada folder `screenshots/` di direktori yang sama dengan README ini. Pastikan nama file dan lokasi gambar sesuai dengan tabel dokumentasi.

---

## 11. Pemecahan Masalah

| Masalah | Penyebab dan Solusi |
|---|---|
| `Cannot find module 'express'` | Dependensi belum terpasang. Jalankan `npm install`. |
| `PrismaClientInitializationError` atau `P1001` | Periksa `DATABASE_URL`, koneksi internet, dan konfigurasi Neon. |
| Akun tidak ditemukan saat login | Pastikan `npx prisma db push` dan `npm run seed` sudah dijalankan. |
| `npm start` tidak dikenali | Pastikan terminal berada di direktori proyek yang memiliki `package.json`. |
| `EADDRINUSE` | Port sedang digunakan proses lain. Gunakan port berbeda. |
| Halaman tidak bisa terhubung ke server | Pastikan server Express sedang berjalan. |
| Login tidak berhasil | Periksa username, password, dan status sesi. |
| Database tidak terhubung | Periksa kembali konfigurasi koneksi PostgreSQL pada `.env`. |

---

## 12. Kesimpulan

LombaMate berhasil dikembangkan sebagai aplikasi web pencari partner lomba mahasiswa menggunakan Express.js sebagai back-end dan HTML, CSS, serta JavaScript sebagai front-end.

Aplikasi ini menerapkan empat operasi utama REST API, yaitu GET, POST, PUT, dan DELETE yang terhubung dengan antarmuka web. Selain itu, terdapat fitur autentikasi, pengelolaan profil, pengajuan permintaan bergabung, serta pembatasan hak akses berdasarkan identitas pengguna.

Pengelolaan data dilakukan menggunakan Prisma ORM dengan PostgreSQL sebagai database utama. Dengan demikian, data aplikasi tersimpan secara persisten dan tidak bergantung pada penyimpanan JSON saat aplikasi berjalan.

Melalui LombaMate, mahasiswa diharapkan dapat lebih mudah menemukan rekan satu tim yang sesuai dengan kebutuhan kompetisi dan bersama-sama mewujudkan prestasi.

### Pengembangan Selanjutnya

Beberapa pengembangan yang dapat dilakukan pada versi berikutnya:

- Integrasi layanan email sungguhan untuk pengiriman tautan reset password.
- Penguatan rate limiting pada endpoint selain autentikasi.
- Penggunaan transaksi database untuk menjaga konsistensi perubahan kuota.
- Pengembangan notifikasi ketika ada permintaan bergabung baru.
- Peningkatan pengalaman pengguna melalui penyempurnaan antarmuka.

---

<div align="center">

**LombaMate — Temukan Partner, Wujudkan Prestasi.**

Dibuat untuk tugas Modul Express API
Institut Teknologi Sepuluh Nopember

</div>