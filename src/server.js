
/* =========================================================
   LombaMate - src/server.js
   Backend Express + Prisma ORM + PostgreSQL (Neon)
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

/* =========================================================
   MIDDLEWARE
   ========================================================= */

app.use(express.json({ limit: '1mb' }));

// Header keamanan
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');

  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self'; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "img-src 'self' data:; " +
    "connect-src 'self'; " +
    "font-src 'self' data: https://fonts.gstatic.com; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "frame-ancestors 'none'"
  );

  next();
});

// Frontend
app.use(express.static(path.join(__dirname, '..', 'public')));

/* =========================================================
   AKUN DAN SESI
   ========================================================= */

// Registrasi
app.post('/api/auth/register', (req, res, next) => {
  const error = validasiDaftar(req.body || {});

  if (error) {
    return res.status(400).json({ message: error });
  }

  registerUser(req.body)
    .then((result) => {
      if (!result.ok) {
        return res.status(result.status || 400).json({
          message: result.message
        });
      }

      return createSession(res, result.user).then(() => {
        res.status(201).json({
          message: 'Akun berhasil dibuat. Selamat berjuang! 🚀',
          user: result.user
        });
      });
    })
    .catch(next);
});

// Login
app.post('/api/auth/login', (req, res, next) => {
  const ip = req.ip || 'tanpa-ip';

  loginUser(req.body || {}, ip)
    .then((result) => {
      if (!result.ok) {
        return res.status(result.status || 401).json({
          message: result.message
        });
      }

      return createSession(res, result.user).then(() => {
        res.json({
          message: 'Berhasil masuk. Semangat ya! 💪',
          user: result.user
        });
      });
    })
    .catch(next);
});

// Logout
app.post('/api/auth/logout', (req, res, next) => {
  destroySession(req, res)
    .then(() => {
      res.json({
        message: 'Kamu sudah keluar. Sampai jumpa! 👋'
      });
    })
    .catch(next);
});

// Cek sesi login
app.get('/api/auth/me', (req, res, next) => {
  userDariSesi(req)
    .then((hasil) => {
      if (!hasil) {
        return res.status(401).json({
          message: 'Belum masuk.'
        });
      }

      res.json({ user: hasil.user });
    })
    .catch(next);
});

// Daftar sesi aktif
app.get('/api/auth/sessions', requireAuth, (req, res, next) => {
  daftarSesi(req.user)
    .then((sessions) => res.json({ sessions }))
    .catch(next);
});

// Matikan satu sesi
app.delete('/api/auth/sessions/:id', requireAuth, (req, res, next) => {
  matikanSesi(req.user.id, String(req.params.id), req.sessionHash)
    .then((hasil) => {
      if (!hasil.ok) {
        return res.status(hasil.status).json({
          message: hasil.message
        });
      }

      if (hasil.diriSendiri) {
        return destroySession(req, res).then(() => {
          res.json({
            message: 'Sesi ini dimatikan. Kamu sudah keluar.'
          });
        });
      }

      res.json({
        message: 'Sesi perangkat itu dimatikan.'
      });
    })
    .catch(next);
});

// Logout semua perangkat
app.post('/api/auth/logout-all', requireAuth, (req, res, next) => {
  destroyAllSessions(req.user.id)
    .then((jumlah) => {
      cookieKosong(res);

      res.json({
        message: `Semua sesi dimatikan (${jumlah} perangkat keluar).`
      });
    })
    .catch(next);
});

// Ganti password
app.post('/api/auth/change-password', requireAuth, (req, res, next) => {
  const body = req.body || {};

  gantiPassword(
    req.user,
    req.sessionHash,
    body.currentPassword,
    body.newPassword
  )
    .then((hasil) => {
      if (!hasil.ok) {
        return res.status(hasil.status).json({
          message: hasil.message
        });
      }

      res.json({
        message: 'Password diganti. Perangkat lain diminta masuk ulang.'
      });
    })
    .catch(next);
});

// Lupa password
app.post('/api/auth/forgot', (req, res, next) => {
  mintaResetPassword(req.body && req.body.email)
    .then((hasil) => {
      if (!hasil.ok) {
        return res.status(hasil.status).json({
          message: hasil.message
        });
      }

      res.json({
        message: hasil.message,
        devToken: hasil.devToken
      });
    })
    .catch(next);
});

// Reset password
app.post('/api/auth/reset', (req, res, next) => {
  const body = req.body || {};

  resetPassword(body.token, body.newPassword)
    .then((hasil) => {
      if (!hasil.ok) {
        return res.status(hasil.status).json({
          message: hasil.message
        });
      }

      res.json({
        message: 'Password berhasil diganti. Silakan masuk dengan password baru.'
      });
    })
    .catch(next);
});

/* =========================================================
   KONVERSI DATA PRISMA KE FORMAT FRONTEND
   ========================================================= */

// Partner
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
    createdAt: p.createdAt
      ? new Date(p.createdAt).toISOString()
      : new Date().toISOString()
  };
}

// Join
function joinKeJson(j) {
  return {
    id: j.id,
    partnerId: j.partnerId,
    username: j.username,
    name: j.name,
    status: j.status,
    createdAt: j.createdAt
      ? new Date(j.createdAt).toISOString()
      : new Date().toISOString()
  };
}

// Profil
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
    updatedAt: p.updatedAt
      ? new Date(p.updatedAt).toISOString()
      : null
  };
}

// Ambil data pemilik terbaru dari profil
async function dataPemilikTerbaru(ownerUsername) {
  if (!ownerUsername) return {};

  const profile = await prisma.profile.findUnique({
    where: {
      username: String(ownerUsername).toLowerCase()
    }
  });

  if (!profile) return {};

  return {
    ownerName: profile.name || undefined,
    ownerCampus: profile.campus || undefined,
    ownerPhoto: profile.photo || undefined,
    ownerBio: profile.bio || undefined
  };
}

/* =========================================================
   VALIDASI DATA PARTNER
   ========================================================= */

const KATEGORI = [
  'teknologi',
  'desain',
  'karya-tulis',
  'bisnis',
  'sains',
  'debat',
  'teknik',
  'olahraga-seni'
];

const TINGKAT = [
  'Sekolah',
  'Kampus / Universitas',
  'Kota / Kabupaten',
  'Provinsi',
  'Nasional',
  'Internasional'
];

const UKURAN_TIM = [
  'Individu (cari teman latihan)',
  '2 orang',
  '3 orang',
  '4 orang',
  '5 orang',
  '6 orang atau lebih'
];

const LINGKUP = [
  'Satu kampus',
  'Satu jurusan',
  'Beda kampus boleh',
  'Bebas'
];

const JENIS_KONTAK = [
  'WhatsApp',
  'Instagram',
  'Telegram',
  'Email',
  'Discord'
];

const amankanTeks = (nilai, maksimal) =>
  String(nilai ?? '').trim().slice(0, maksimal);

// Validasi URL
function urlAman(nilai) {
  const s = String(nilai ?? '').trim();

  if (!s) return '';
  if (s.length > 2048) return null;
  if (!/^https?:\/\//i.test(s)) return null;

  try {
    const url = new URL(s);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    return s;
  } catch {
    return null;
  }
}

/* =========================================================
   VALIDASI TANGGAL

   Format yang diterima:
   1. DD-MM-YYYY
   2. YYYY-MM-DD (format bawaan input type="date")

   Tanggal disimpan ke database dalam format YYYY-MM-DD
   ========================================================= */

function tanggalSah(nilai) {
  const s = String(nilai ?? '').trim();

  if (!s) return '';

  let tahun;
  let bulan;
  let hari;

  // Format DD-MM-YYYY
  const formatIndonesia = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s);

  // Format YYYY-MM-DD
  const formatISO = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);

  if (formatIndonesia) {
    hari = Number(formatIndonesia[1]);
    bulan = Number(formatIndonesia[2]);
    tahun = Number(formatIndonesia[3]);
  } else if (formatISO) {
    tahun = Number(formatISO[1]);
    bulan = Number(formatISO[2]);
    hari = Number(formatISO[3]);
  } else {
    return null;
  }

  // Periksa apakah tanggal benar-benar ada di kalender
  const tanggal = new Date(Date.UTC(tahun, bulan - 1, hari));

  if (
    tanggal.getUTCFullYear() !== tahun ||
    tanggal.getUTCMonth() !== bulan - 1 ||
    tanggal.getUTCDate() !== hari
  ) {
    return null;
  }

  // Ambil tanggal hari ini berdasarkan waktu lokal server
  const sekarang = new Date();
  const today = new Date(
    sekarang.getFullYear(),
    sekarang.getMonth(),
    sekarang.getDate()
  );

  const tanggalDipilih = new Date(tahun, bulan - 1, hari);

  if (tanggalDipilih < today) {
    return null;
  }

  // Normalisasi ke YYYY-MM-DD untuk penyimpanan database
  return [
    String(tahun).padStart(4, '0'),
    String(bulan).padStart(2, '0'),
    String(hari).padStart(2, '0')
  ].join('-');
}

// Validasi foto
const FOTO_MAKSIMAL_KARAKTER = 700000;

function fotoSah(nilai) {
  if (!nilai) return '';

  const s = String(nilai);

  if (s.length > FOTO_MAKSIMAL_KARAKTER) {
    return null;
  }

  return /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=\s]+$/.test(s)
    ? s
    : null;
}

// Validasi array teks
function arrayTeks(nilai, maksItem, maksKarakter) {
  if (!Array.isArray(nilai)) return null;

  const bersih = nilai
    .map((v) => amankanTeks(v, maksKarakter))
    .filter(Boolean);

  if (bersih.length > maksItem) return null;

  return bersih;
}

// Ambil field partner yang diizinkan
function pick(body) {
  const output = {};

  const fields = [
    'category',
    'competition',
    'organizer',
    'level',
    'deadline',
    'link',
    'teamSize',
    'slots',
    'roles',
    'scope',
    'description',
    'contactType',
    'contact'
  ];

  for (const field of fields) {
    if (body && body[field] !== undefined) {
      output[field] = body[field];
    }
  }

  return output;
}

// Validasi data wajib
function validate(data) {
  if (!data.category) {
    return 'Kategori lomba wajib dipilih.';
  }

  if (!KATEGORI.includes(data.category)) {
    return 'Kategori tidak dikenal.';
  }

  if (!data.competition || !String(data.competition).trim()) {
    return 'Nama lomba wajib diisi.';
  }

  if (!Array.isArray(data.roles) || data.roles.length === 0) {
    return 'Pilih minimal satu peran.';
  }

  if (
    data.slots !== null &&
    data.slots !== undefined &&
    data.slots !== ''
  ) {
    const slots = Number(data.slots);

    if (!Number.isInteger(slots) || slots < 1 || slots > 10) {
      return 'Jumlah partner yang dicari harus 1 sampai 10.';
    }
  }

  if (!data.contact || !String(data.contact).trim()) {
    return 'Kontak wajib diisi.';
  }

  return null;
}

// Validasi detail partner
function validateDetail(data) {
  if (String(data.competition).length > 100) {
    return 'Nama lomba maksimal 100 karakter.';
  }

  if (data.organizer && String(data.organizer).length > 100) {
    return 'Nama penyelenggara terlalu panjang.';
  }

  if (data.level && !TINGKAT.includes(data.level)) {
    return 'Tingkat lomba tidak dikenal.';
  }

  if (data.teamSize && !UKURAN_TIM.includes(data.teamSize)) {
    return 'Jumlah anggota tim tidak dikenal.';
  }

  if (data.scope && !LINGKUP.includes(data.scope)) {
    return 'Lingkup partner tidak dikenal.';
  }

  if (data.contactType && !JENIS_KONTAK.includes(data.contactType)) {
    return 'Jenis kontak tidak dikenal.';
  }

  if (String(data.contact).length > 60) {
    return 'Kontak maksimal 60 karakter.';
  }

  if (data.description && String(data.description).length > 600) {
    return 'Deskripsi maksimal 600 karakter.';
  }

  const peran = arrayTeks(data.roles, 6, 40);

  if (!peran) {
    return 'Peran tidak valid (maksimal 6 peran, 40 karakter masing-masing).';
  }

  if (peran.length === 0) {
    return 'Pilih minimal satu peran.';
  }

  // Validasi tanggal DD-MM-YYYY atau YYYY-MM-DD
  if (data.deadline) {
    const tanggal = tanggalSah(data.deadline);

    if (tanggal === null) {
      return 'Batas pendaftaran tidak valid. Gunakan format DD-MM-YYYY dan pastikan tanggal tidak sebelum hari ini.';
    }

    // Simpan tanggal yang sudah dinormalisasi
    data.deadline = tanggal;
  }

  // Validasi link
  if (data.link) {
    const linkBersih = urlAman(data.link);

    if (linkBersih === null) {
      return 'Link info lomba harus URL http/https yang sah.';
    }

    data.link = linkBersih;
  }

  data.roles = peran;

  return null;
}

/* =========================================================
   PERSIAPAN DATA PARTNER UNTUK PRISMA
   ========================================================= */

function siapkanPartner(data) {
  return {
    category: String(data.category),
    competition: amankanTeks(data.competition, 100),
    organizer: amankanTeks(data.organizer || '', 100),
    level: amankanTeks(data.level || '', 40),
    deadline: amankanTeks(data.deadline || '', 10),
    link: data.link || '',
    teamSize: amankanTeks(data.teamSize || '', 40),
    slots:
      data.slots === null ||
      data.slots === undefined ||
      data.slots === ''
        ? null
        : Number(data.slots),
    roles: data.roles,
    scope: amankanTeks(data.scope || '', 40),
    description: amankanTeks(data.description || '', 600),
    contactType: data.contactType || 'WhatsApp',
    contact: amankanTeks(data.contact, 60)
  };
}

// Hitung kuota partner
function kuotaDari(partner, joins, excludeJoinId = null) {
  if (partner.slots === null || partner.slots === undefined) {
    return {
      sisa: null,
      penuh: false
    };
  }

  const aktif = joins.filter(
    (join) =>
      join.status !== 'ditolak' &&
      (excludeJoinId === null || join.id !== excludeJoinId)
  ).length;

  const sisa = Number(partner.slots) - aktif;

  return {
    sisa,
    penuh: sisa <= 0
  };
}

/* =========================================================
   MIDDLEWARE OTORISASI (hak akses)

   Autentikasi (requireAuth) menjawab "sudah masuk?".
   Middleware di bawah menjawab "boleh melakukan ini?".
   Semua identitas diambil dari req.user yang diisi
   requireAuth dari cookie sesi terverifikasi database -
   TIDAK PERNAH dari body request atau query.
   ========================================================= */

// Muat partner :id -> 400/404 bila tidak sah, lalu cek pemiliknya.
// Dipakai: GET/PUT/DELETE /api/partners/:id (satu aturan, satu tempat).
async function wajibPemilikPartner(req, res, next) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({
      message: 'ID partner tidak valid.'
    });
  }

  const partner = await prisma.partner.findUnique({
    where: { id },
    include: {
      joins: {
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  if (!partner) {
    return res.status(404).json({
      message: 'Partner tidak ditemukan.'
    });
  }

  if (
    String(partner.ownerUsername).toLowerCase() !==
    req.user.username.toLowerCase()
  ) {
    return res.status(403).json({
      message: 'Hanya pemilik postingan yang boleh melakukan ini.'
    });
  }

  req.partner = partner;
  next();
}

// Keputusan join (terima/tolak) = HANYA pemilik postingan tujuan.
// Dipakai: PUT /api/joins/:id
async function wajibPemilikKeputusanJoin(req, res, next) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({
      message: 'ID permintaan tidak valid.'
    });
  }

  const join = await prisma.join.findUnique({
    where: { id },
    include: {
      partner: {
        include: {
          joins: {
            orderBy: { createdAt: 'asc' }
          }
        }
      }
    }
  });

  if (!join) {
    return res.status(404).json({
      message: 'Permintaan tidak ditemukan.'
    });
  }

  if (
    String(join.partner.ownerUsername).toLowerCase() !==
    req.user.username.toLowerCase()
  ) {
    return res.status(403).json({
      message: 'Hanya pemilik postingan yang bisa memutuskan permintaan ini.'
    });
  }

  req.join = join;
  req.partner = join.partner;
  next();
}

// Pembatalan join = HANYA pengajunya sendiri.
// Dipakai: DELETE /api/joins/:id
async function wajibPengajuJoin(req, res, next) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({
      message: 'ID permintaan tidak valid.'
    });
  }

  const join = await prisma.join.findUnique({
    where: { id }
  });

  if (!join) {
    return res.status(404).json({
      message: 'Permintaan tidak ditemukan.'
    });
  }

  if (
    join.username.toLowerCase() !==
    req.user.username.toLowerCase()
  ) {
    return res.status(403).json({
      message: 'Hanya pengaju yang bisa membatalkan permintaannya.'
    });
  }

  req.join = join;
  next();
}

// Profil :username hanya boleh diubah oleh pemiliknya.
// Dipakai: PUT /api/profiles/:username
function wajibProfilSendiri(req, res, next) {
  const target = String(req.params.username || '').toLowerCase();

  if (target !== req.user.username.toLowerCase()) {
    return res.status(403).json({
      message: 'Hanya pemilik profil yang bisa mengubah profilnya.'
    });
  }

  next();
}

/* =========================================================
   ENDPOINT PARTNER
   ========================================================= */

// GET semua partner
app.get('/api/partners', async (req, res) => {
  const viewers = await userDariSesi(req);
  const me = viewers ? viewers.user.username.toLowerCase() : null;

  const partners = await prisma.partner.findMany({
    include: {
      joins: {
        orderBy: { createdAt: 'asc' }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  const hasil = [];

  for (const p of partners) {
    const terbaru = await dataPemilikTerbaru(p.ownerUsername);
    const gabungan = partnerKeJson({ ...p, ...terbaru });

    const { sisa, penuh } = kuotaDari(p, p.joins);

    const pemilik =
      p.ownerUsername &&
      String(p.ownerUsername).toLowerCase() === me;

    const semua = p.joins.map(joinKeJson);

    const dirender = pemilik
      ? semua
      : me
        ? [
            ...semua.filter(
              (j) => j.username.toLowerCase() === me
            ),
            ...semua.filter(
              (j) =>
                j.status === 'diterima' &&
                j.username.toLowerCase() !== me
            )
          ]
        : [];

    hasil.push({
      ...gabungan,
      requests: dirender,
      sisa,
      penuh
    });
  }

  res.json(hasil);
});

// GET satu partner untuk mode edit (khusus pemilik)
app.get('/api/partners/:id', requireAuth, wajibPemilikPartner, (req, res, next) => {
  dataPemilikTerbaru(req.partner.ownerUsername)
    .then((terbaru) => {
      res.json(partnerKeJson({ ...req.partner, ...terbaru }));
    })
    .catch(next);
});

// POST tambah partner
// Identitas pemilik (ownerName/ownerUsername) SELALU dari sesi -
// field owner* yang dikirim klien diabaikan lewat pick().
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

  const partner = await prisma.partner.create({
    data: {
      ...siapkanPartner(data),
      ownerName: amankanTeks(req.user.name, 60),
      ownerCampus: amankanTeks(
        req.body && req.body.ownerCampus,
        100
      ),
      ownerUsername: req.user.username,
      ownerPhoto: ''
    }
  });

  res.status(201).json(partnerKeJson(partner));
});

// PUT edit partner (hanya pemilik)
app.put('/api/partners/:id', requireAuth, wajibPemilikPartner, async (req, res) => {
  const data = pick(req.body);

  // Gabungkan data lama dan data baru untuk validasi PUT
  const gabungan = {
    ...partnerKeJson(req.partner),
    ...data
  };

  const error = validate(gabungan);

  if (error) {
    return res.status(400).json({ message: error });
  }

  const detail = validateDetail(gabungan);

  if (detail) {
    return res.status(400).json({ message: detail });
  }

  const updated = await prisma.partner.update({
    where: { id: req.partner.id },
    data: siapkanPartner(gabungan)
  });

  res.json(partnerKeJson(updated));
});

// DELETE partner (hanya pemilik)
app.delete('/api/partners/:id', requireAuth, wajibPemilikPartner, async (req, res) => {
  await prisma.partner.delete({
    where: { id: req.partner.id }
  });

  res.json({
    message: 'Partner berhasil dihapus.'
  });
});

/* =========================================================
   ENDPOINT PERMINTAAN GABUNG
   ========================================================= */

// POST ajukan permintaan gabung
app.post('/api/partners/:id/joins', requireAuth, async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({
      message: 'ID partner tidak valid.'
    });
  }

  const partner = await prisma.partner.findUnique({
    where: { id },
    include: {
      joins: {
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  if (!partner) {
    return res.status(404).json({
      message: 'Partner tidak ditemukan.'
    });
  }

  const username = req.user.username;
  const name = amankanTeks(req.user.name, 60);

  if (
    username.toLowerCase() ===
    String(partner.ownerUsername || '').toLowerCase()
  ) {
    return res.status(400).json({
      message: 'Ini postinganmu sendiri, tidak bisa mengikuti dirimu sendiri.'
    });
  }

  const sudah = partner.joins.find(
    (j) =>
      j.username.toLowerCase() === username.toLowerCase() &&
      j.status !== 'ditolak'
  );

  if (sudah) {
    return res.status(400).json({
      message:
        sudah.status === 'diterima'
          ? 'Kamu sudah menjadi anggota tim ini.'
          : 'Kamu sudah mengajukan permintaan ke tim ini.'
    });
  }

  const { sisa } = kuotaDari(partner, partner.joins);

  if (sisa !== null && sisa <= 0) {
    return res.status(400).json({
      message: 'Kuota tim ini sudah penuh.'
    });
  }

  const join = await prisma.join.create({
    data: {
      partnerId: partner.id,
      username,
      name,
      status: 'menunggu'
    }
  });

  const semuaJoin = partner.joins.concat([join]);

  res.status(201).json({
    message: `Permintaan gabung ke "${partner.competition}" terkirim!`,
    requests: partnerKeJsonJ(semuaJoin),
    sisa: kuotaDari(partner, semuaJoin).sisa
  });
});

// Konversi daftar join
function partnerKeJsonJ(joins) {
  return joins
    .map(joinKeJson)
    .sort((a, b) =>
      String(a.createdAt).localeCompare(String(b.createdAt))
    );
}

// PUT terima atau tolak permintaan (hanya pemilik postingan)
app.put('/api/joins/:id', requireAuth, wajibPemilikKeputusanJoin, (req, res, next) => {
  const status = req.body && req.body.status;
  const join = req.join;
  const partner = req.partner;

  if (status !== 'diterima' && status !== 'ditolak') {
    return res.status(400).json({
      message: 'Status harus "diterima" atau "ditolak".'
    });
  }

  if (join.status !== 'menunggu') {
    return res.status(400).json({
      message: 'Hanya permintaan berstatus "menunggu" yang bisa diputuskan.'
    });
  }

  if (status === 'diterima') {
    const { sisa } = kuotaDari(
      partner,
      partner.joins,
      join.id
    );

    if (sisa !== null && sisa <= 0) {
      return res.status(400).json({
        message: 'Kuota tim sudah penuh. Tolak dulu permintaan lain untuk menyisakan tempat.'
      });
    }
  }

  prisma.join.update({
    where: { id: join.id },
    data: { status }
  })
    .then((updated) => {
      const message =
        status === 'diterima'
          ? 'Permintaan diterima. Selamat bergabung! 🎉'
          : 'Permintaan ditolak dan kuota dikembalikan.';

      res.json({
        message,
        requests: partnerKeJsonJ(partner.joins),
        join: joinKeJson(updated)
      });
    })
    .catch(next);
});

// DELETE batalkan permintaan atau tinggalkan tim (hanya pengaju)
app.delete('/api/joins/:id', requireAuth, wajibPengajuJoin, async (req, res) => {
  const join = req.join;

  await prisma.join.delete({
    where: { id: join.id }
  });

  const message =
    join.status === 'diterima'
      ? 'Kamu meninggalkan tim. Semoga jumpa di lomba lain! 👋'
      : 'Permintaan dibatalkan dan kuota dikembalikan.';

  res.json({ message });
});

/* =========================================================
   PROFIL PUBLIK
   ========================================================= */

// GET semua profil (wajib login)
app.get('/api/profiles', requireAuth, async (req, res) => {
  const daftar = await prisma.profile.findMany({
    orderBy: { username: 'asc' }
  });

  res.json(daftar.map(profilKeJson));
});

// GET satu profil (wajib login - sama seperti daftar profil; least privilege)
app.get('/api/profiles/:username', requireAuth, async (req, res) => {
  const username = String(req.params.username).toLowerCase();

  const profile = await prisma.profile.findUnique({
    where: { username }
  });

  if (!profile) {
    return res.status(404).json({
      message: 'Profil tidak ditemukan.'
    });
  }

  res.json(profilKeJson(profile));
});

// PUT simpan profil sendiri (hanya pemilik profil)
app.put('/api/profiles/:username', requireAuth, wajibProfilSendiri, async (req, res) => {
  const target = String(req.params.username).toLowerCase();

  const bersih = validateProfilBody(req.body);

  if (bersih.error) {
    return res.status(400).json({
      message: bersih.error
    });
  }

  const tersimpan = await prisma.profile.upsert({
    where: { username: target },
    update: bersih.data,
    create: {
      username: target,
      ...bersih.data
    }
  });

  res.json({
    message: 'Profil berhasil disimpan.',
    profile: profilKeJson(tersimpan)
  });
});

// Validasi data profil
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
    return {
      error: 'Riwayat lomba tidak valid (maksimal 20 entri).'
    };
  } else {
    let valid = true;

    data.history = b.history
      .map((h) => {
        if (!h || typeof h !== 'object') {
          valid = false;
          return null;
        }

        return {
          title: amankanTeks(h.title, 100),
          result: amankanTeks(h.result, 40)
        };
      })
      .filter((h) => h !== null);

    if (!valid) {
      return {
        error: 'Riwayat lomba tidak valid.'
      };
    }
  }

  const foto = fotoSah(b.photo);

  if (foto === null) {
    return {
      error: 'Foto harus berupa gambar (png/jpg/webp, maksimal sekitar 600KB).'
    };
  }

  data.photo = foto || '';

  return { data };
}

/* =========================================================
   MISC
   ========================================================= */

// Cek koneksi database
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      ok: true,
      database: 'neon-postgres',
      waktu: new Date().toISOString()
    });
  } catch (error) {
    console.error('Health check database gagal:', error.message);

    res.status(500).json({
      ok: false,
      database: 'terputus',
      waktu: new Date().toISOString()
    });
  }
});

// Endpoint API tidak ditemukan
app.use('/api', (req, res) => {
  res.status(404).json({
    message: 'Endpoint tidak ditemukan.'
  });
});

// Penanganan error
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      message: 'Format JSON tidak valid.'
    });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      message: 'Data yang dikirim terlalu besar.'
    });
  }

  console.error(err);

  res.status(500).json({
    message: 'Terjadi kesalahan pada server.'
  });
});

/* =========================================================
   JALANKAN SERVER
   ========================================================= */

const server = app.listen(PORT, () => {
  console.log(`Server jalan di http://localhost:${PORT}`);
});

// Tutup koneksi Prisma saat server dihentikan
async function tutupServer() {
  console.log('\nMenutup server...');

  await prisma.$disconnect();

  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGINT', tutupServer);
process.on('SIGTERM', tutupServer);
