/* =========================================================
   LombaMate - auth.js (sisi browser)
   Keamanan sekarang DIRAWAT SERVER (src/server.js):
   - password tidak pernah disimpan di browser
   - sesi = cookie httpOnly yang dibuat server (tidak
     bisa dibaca JavaScript), JS browser tidak memegangnya
   - localStorage hanya menyimpan "cache tampilan"
     (nama & username) untuk navbar, bukan untuk bukti
     identitas. Setiap permintaan tulis disahkan server.

   Dimuat setelah utils.js, sebelum script halaman.
   ========================================================= */
'use strict';

/* ---------- Konstanta ---------- */
const SESSION_KEY = 'lombamate_session'; // cache tampilan (nama & username)

/* ---------- Cache tampilan sesi ---------- */
function startSession(user) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      name: user.name,
      username: user.username
    }));
    return true;
  } catch {
    return false;
  }
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY)) || null;
  } catch {
    return null;
  }
}

/* ---------- Register: { ok, message?, user? } ---------- */
async function registerUser(data) {
  const hasil = await postJSON('/api/auth/register', data);
  if (hasil.ok) startSession(hasil.user);
  return hasil;
}

/* ---------- Login: { ok, message?, user? } ---------- */
async function loginUser(username, password) {
  const hasil = await postJSON('/api/auth/login', { username, password });
  if (hasil.ok) startSession(hasil.user);
  return hasil;
}

/* ---------- Logout ---------- */
async function logoutUser() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' }); // server menghapus sesi cookie
  } catch {
    // server tidak jalan: cache tetap dibuang supaya UI tidak berpura-pura sudah masuk
  }
  localStorage.removeItem(SESSION_KEY);
  location.replace('login.html');
}

/* ---------- Helper fetch JSON sederhana ---------- */
async function postJSON(url, body) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, message: data.message || '', user: data.user };
  } catch {
    return { ok: false, status: 0, message: 'Server tidak merespons. Coba lagi ya.' };
  }
}

/* ---------- Pintu masuk (guard) ----------
    localStorage HANYA cache tampilan (nama di navbar) -
    BUKAN bukti identitas. Kebenaran sesi selalu ditanyakan
    ke server lewat GET /api/auth/me (server mengecek cookie
    ke tabel Session di database).

    - Halaman terlindung: cache hilang -> login; cache ada ->
      tetap dibuka, lalu sesi diverifikasi ke server diam-diam;
      kalau server bilang 401 (sesi mati/kadaluarsa) -> cache
      dibuang dan kembali ke login.
    - Halaman login: kalau cache ada, verifikasi dulu ke server
      SEBELUM lompat ke beranda - kalau sesi sudah mati, cache
      dibuang dan pengguna tinggal di halaman login.         */
async function cekSesiServer() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
    return res.ok; // 200 = sesi sah di database; 401 = tidak sah
  } catch {
    return false; // server tak jalan: anggap belum masuk
  }
}

(function wajibMasuk() {
  const diHalamanTerlindung = document.body.dataset.requiresAuth === 'true';
  const diHalamanLogin = document.body.dataset.page === 'login';

  if (diHalamanTerlindung) {
    if (!getSession()) {
      location.replace('login.html');
      return;
    }
    // verifikasi senyap ke server (cookie httpOnly yang diajak bicara)
    cekSesiServer().then((sah) => {
      if (!sah) {
        localStorage.removeItem(SESSION_KEY);
        location.replace('login.html');
      }
    });
    return;
  }

  // Di halaman login: kalau masih punya cache, uji dulu ke server.
  // Sesi benar-benar hidup -> lanjut ke beranda; sesi mati ->
  // buang cache dan tetap di halaman login.
  if (diHalamanLogin && getSession()) {
    cekSesiServer().then((sah) => {
      if (sah) {
        location.replace('index.html');
      } else {
        localStorage.removeItem(SESSION_KEY);
      }
    });
  }
})();
