/* =========================================================
   LombaMate - reset.js
   Halaman GANTI PASSWORD lewat token lupa password.
   Token dibawa lewat URL (?token=...) hasil tautan yang
   diminta di halaman login (POST /api/auth/forgot).
   ========================================================= */
'use strict';

(() => {
  const $ = (id) => document.getElementById(id);

  const form = $('form-reset');
  const pesan = $('msg-reset');

  // Token dari URL (tautan yang "terkirim")
  const token = new URLSearchParams(location.search).get('token') || '';

  function setMessage(text) {
    pesan.textContent = text;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!token) {
      setMessage('Tautan ini tidak membawa token. Minta tautan baru dari halaman masuk ya.');
      return;
    }

    const password = $('reset-password').value;
    const confirm = $('reset-confirm').value;

    if (password.length < 8) {
      setMessage('Password baru minimal 8 karakter.');
      return;
    }
    if (password !== confirm) {
      setMessage('Ulangi password tidak sama. Cek lagi ya.');
      return;
    }

    try {
      const res = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password })
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setFlash('Password berhasil diganti. Masuk dengan password baru ya! 🔑');
        location.replace('login.html');
      } else {
        setMessage(data.message || 'Gagal mengganti password. Minta tautan baru ya.');
      }
    } catch {
      setMessage('Server tidak merespons. Coba lagi ya.');
    }
  });

  // Token kosong / sudah dipakai: beri tahu sejak awal, form tetap tampil
  if (!token) {
    setMessage('Tautan tidak sah: token kosong. Buka halaman masuk lalu klik "Lupa password?" untuk minta tautan baru.');
  }
})();
