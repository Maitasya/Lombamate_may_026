/* =========================================================
   LombaMate - login.js
   Logika halaman LOGIN: tab Masuk/Daftar, validasi,
   dan penyimpanan sesi (pakai fungsi dari auth.js).
   ========================================================= */
'use strict';

(() => {
  const $ = (id) => document.getElementById(id);

  const formMasuk = $('form-masuk');
  const formDaftar = $('form-daftar');

  /* ---------- Tab Masuk / Daftar ---------- */
  function showPanel(name) {
    formMasuk.hidden = name !== 'masuk';
    formDaftar.hidden = name !== 'daftar';

    document.querySelectorAll('.auth-tab').forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.panel === name);
    });

    // bersihkan pesan lama pada kedua form
    setMessage('msg-masuk', '');
    setMessage('msg-daftar', '');
  }

  document.querySelectorAll('.auth-tab').forEach((tab) => {
    tab.addEventListener('click', () => showPanel(tab.dataset.panel));
  });

  // tautan "Daftar sekarang" / "Masuk di sini" di bawah form
  document.querySelectorAll('[data-switch]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      showPanel(link.dataset.switch);
    });
  });

  /* ---------- Helper pesan & validasi ---------- */
  function setMessage(formMsgId, text) {
    const el = $(formMsgId);
    if (!el) return;
    el.textContent = text;
  }

  function tandaiError(inputIds) {
    inputIds.forEach((id) => {
      const el = $(id);
      el.classList.add('invalid');
      el.addEventListener('input', () => el.classList.remove('invalid'), { once: true });
    });
    $(inputIds[0]).focus({ preventScroll: true });
  }

  const USERNAME_REGEX = /^[A-Za-z0-9._]{3,20}$/;

  /* ---------- Submit: Masuk (wajib login sebenarnya dilakukan SERVER) ---------- */
  formMasuk.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = $('login-username').value.trim();
    const password = $('login-password').value;

    if (!username || !password) {
      const kosong = [!username && 'login-username', !password && 'login-password'].filter(Boolean);
      setMessage('msg-masuk', 'Username dan password wajib diisi.');
      tandaiError(kosong);
      return;
    }

    const hasil = await loginUser(username, password);
    if (!hasil.ok) {
      setMessage('msg-masuk', hasil.message || 'Gagal masuk. Coba lagi ya.');
      tandaiError(['login-username', 'login-password']);
      return;
    }

    // Berhasil masuk -> simpan sesi lalu ke beranda dengan pesan sambutan
    startSession(hasil.user);
    setFlash(`Selamat masuk, ${hasil.user.name}! Semangat lombanya 🎉`);
    location.replace('index.html');
  });

  /* ---------- Submit: Daftar (SERVER yang membuat akun + hash password) ---------- */
  formDaftar.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = $('reg-name').value.trim();
    const username = $('reg-username').value.trim().replace(/^@/, '');
    const email = $('reg-email').value.trim();
    const password = $('reg-password').value;
    const confirm = $('reg-confirm').value;

    const inputKosong = [];
    if (!name) inputKosong.push('reg-name');
    if (!username) inputKosong.push('reg-username');
    if (!email) inputKosong.push('reg-email');
    if (!password) inputKosong.push('reg-password');
    if (!confirm) inputKosong.push('reg-confirm');

    if (inputKosong.length) {
      setMessage('msg-daftar', 'Semua data wajib diisi.');
      tandaiError(inputKosong);
      return;
    }

    if (!USERNAME_REGEX.test(username)) {
      setMessage('msg-daftar', 'Username 3-20 karakter: huruf, angka, titik, atau underscore.');
      tandaiError(['reg-username']);
      return;
    }

    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
      setMessage('msg-daftar', 'Format email tidak valid.');
      tandaiError(['reg-email']);
      return;
    }

    if (password.length < 8) {
      setMessage('msg-daftar', 'Password minimal 8 karakter.');
      tandaiError(['reg-password']);
      return;
    }

    if (password !== confirm) {
      setMessage('msg-daftar', 'Ulangi password tidak sama. Cek lagi ya.');
      tandaiError(['reg-password', 'reg-confirm']);
      return;
    }

    const hasil = await registerUser({ name, username, email, password });
    if (!hasil.ok) {
      setMessage('msg-daftar', hasil.message || 'Gagal mendaftar. Coba lagi ya.');
      if (String(hasil.message || '').indexOf('Username') === 0) {
        tandaiError(['reg-username']);
      } else if (String(hasil.message || '').indexOf('Email') === 0) {
        tandaiError(['reg-email']);
      }
      return;
    }

    // Daftar berhasil -> langsung masuk (sesi server sudah dibuat) dan ke beranda
    setFlash(`Semangat, ${name}! Akunmu siap dipakai 🎉`);
    location.replace('index.html');
  });

  /* ---------- Lupa password ---------- */
  const panelForgot = $('panel-forgot');

  $('btn-forgot').addEventListener('click', () => {
    panelForgot.hidden = !panelForgot.hidden;
    if (!panelForgot.hidden) $('forgot-email').focus();
  });

  $('btn-kirim-reset').addEventListener('click', async () => {
    const email = $('forgot-email').value.trim();
    setMessage('msg-forgot', '');

    if (!email) {
      setMessage('msg-forgot', 'Tulis email terdaftarmu dulu ya.');
      return;
    }

    const tombol = $('btn-kirim-reset');
    tombol.disabled = true;
    tombol.textContent = 'Mengirim...';

    try {
      const res = await fetch('/api/auth/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        let pesan = data.message || 'Kalau email itu terdaftar, tautan ganti password sudah dikirim.';
        // Mode pengembangan: server mengembalikan token utk demo (pengiriman
        // email sungguhan butuh layanan SMTP - di luar cakupan tugas).
        if (data.devToken) {
          pesan = 'Tautan ganti password siap (simulasi email di mode dev): ';
          const tautan = document.createElement('a');
          tautan.href = `reset.html?token=${encodeURIComponent(data.devToken)}`;
          tautan.textContent = 'Buka halaman ganti password →';
          setMessage('msg-forgot', pesan);
          $('msg-forgot').appendChild(tautan);
        } else {
          setMessage('msg-forgot', pesan);
        }
      } else {
        setMessage('msg-forgot', data.message || 'Gagal memproses. Coba lagi ya.');
      }
    } catch {
      setMessage('msg-forgot', 'Server tidak merespons. Coba lagi ya.');
    } finally {
      tombol.disabled = false;
      tombol.textContent = 'Kirim tautan ganti password';
    }
  });

  /* ---------- Inisialisasi ---------- */
  showPanel('masuk');
})();
