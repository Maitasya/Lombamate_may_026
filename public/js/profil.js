/* =========================================================
   LombaMate - profil.js
   Profil kini TERSIMPAN DI SERVER (ProfileAPI) supaya bisa
   dilihat orang lain; localStorage hanya sebagai cadangan.

   2 mode halaman:
   - Profil saya      : profil.html            -> bisa edit
   - Profil publik    : profil.html?u=username -> hanya lihat

   Statistik memakai data asli:
   - Lomba Diikuti = tim gabunganmu yang statusnya "diterima"
   - Partner       = orang yang bergabung ke postinganmu
   - Riwayat Lomba = riwayat manual + tim yang diterima
   ========================================================= */
'use strict';

(() => {
  const $ = (id) => document.getElementById(id);

  const form = $('profile-form');
  const formSection = $('form-profil');
  const messageEl = $('form-message');

  const PRESTASI_REGEX = /juara|medali|finalis|harapan|emas|perak|perunggu|winner|best|pemenang/i;

  // Siapa yang profilnya dibuka? "u" di URL berarti profil orang lain
  const session = getSession();
  const uParam = new URLSearchParams(window.location.search).get('u');
  const viewUsername = (uParam && session && uParam.toLowerCase() !== String(session.username).toLowerCase())
    ? uParam
    : null;

  let profile = loadProfile();   // data lokal paling baru
  let diterima = [];             // tim yang saya diterima
  let pendingPhoto = null;       // foto baru yang belum disimpan

  /* ---------- Helper ---------- */
  const splitList = (text) =>
    String(text || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((v, i, arr) => arr.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i);

  // "GEMASTIK 2025 - Juara 2" -> { title, result }
  function parseHistory(text) {
    return String(text || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const i = line.lastIndexOf(' - ');
        return i > 0
          ? { title: line.slice(0, i).trim(), result: line.slice(i + 3).trim() }
          : { title: line, result: '' };
      });
  }

  const historyToText = (list) =>
    (list || []).map((h) => (h.result ? `${h.title} - ${h.result}` : h.title)).join('\n');

  // Perkecil foto agar ringan dikirim ke server
  function resizeImage(file, max = 320) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) return reject(new Error('File harus berupa gambar.'));

      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Gambar tidak bisa dibuka.'));
        img.onload = () => {
          // Potong jadi persegi; foto potret dipotong condong ke atas agar wajah tidak hilang
          const side = Math.min(img.width, img.height);
          const sx = (img.width - side) / 2;
          const sy = img.height > img.width ? (img.height - side) * 0.2 : 0;
          const size = Math.min(max, side);
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          canvas.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, size, size);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // Riwayat gabungan: manual dari form + otomatis dari tim yang diterima
  function mergedHistory(profileData) {
    const manual = profileData.history || [];
    const sudah = new Set(manual.map((h) => String(h.title).toLowerCase()));
    const otomatis = diterima
      .filter((p) => p.competition && !sudah.has(String(p.competition).toLowerCase()))
      .map((p) => ({ title: p.competition, result: '' }));
    return [...manual, ...otomatis];
  }

  /* ---------- Tampilkan profil ---------- */
  function renderProfile() {
    $('profile-name').textContent = profile.name || 'Nama Lengkap';
    $('profile-username').textContent = profile.username ? `@${profile.username}` : '@username';
    $('profile-campus').textContent = profile.campus || 'Nama Kampus';
    $('profile-major').textContent = profile.major || 'Jurusan / Program Studi';
    $('profile-contact').textContent = profile.contact || 'Kontak (WhatsApp / Email)';
    setAvatar($('profile-avatar'), profile.photo);

    $('profile-bio').textContent = profile.bio ||
      'Belum ada deskripsi. Ceritakan sedikit tentang dirimu, semangatmu, dan tujuanmu mengikuti lomba.';

    // Status mencari partner
    const looking = profile.looking !== false;
    const status = $('profile-status');
    status.classList.toggle('status-open', looking);
    status.classList.toggle('status-closed', !looking);
    status.innerHTML = `<span class="status-dot"></span> ${looking ? 'Sedang mencari partner' : 'Tidak sedang mencari'}`;

    // Tag minat & keahlian
    renderTags($('interest-list'), profile.interests, 'Belum ada minat lomba');
    renderTags($('skill-list'), profile.skills, 'Belum ada keahlian');

    renderHistory();
    renderStats();
    applyNavbarAvatar();
  }

  function renderTags(listEl, items, emptyText) {
    listEl.innerHTML = '';
    const data = items && items.length ? items : [emptyText];
    data.forEach((text) => {
      const li = document.createElement('li');
      li.className = 'tag';
      li.textContent = text;
      listEl.appendChild(li);
    });
  }

  function renderHistory() {
    const listEl = $('history-list');
    const history = mergedHistory(profile);

    if (history.length === 0) {
      listEl.innerHTML = `
        <li class="empty-state empty-small">
          <img src="assets/mascot-kepala-tidur.png" alt="Maskot tidur" class="empty-mascot">
          <p class="empty-text">Belum ada riwayat lomba.</p>
        </li>`;
      return;
    }

    // 3 entri terbaru di atas
    listEl.innerHTML = history.slice().reverse().map((h) => `
      <li class="history-item">
        <div>
          <p class="history-title">${escapeHtml(h.title)}${h.otomatis ? ' <small class="history-auto">· tim di LombaMate</small>' : ''}</p>
        </div>
        ${h.result ? `<span class="history-badge">${escapeHtml(h.result)}</span>` : ''}
      </li>`).join('');
  }

  // Hitung statistik dari data partner & permintaan gabung nyata
  async function renderStats() {
    let dibantuGabung = 0; // orang yang diterima ke postingan milik sendiri
    diterima = [];         // tim milik SIAPAPUN tempat saya diterima

    try {
      const all = await PartnerAPI.getAll();
      const nama = viewUsername || (session && session.username);

      if (nama && !viewUsername) {
        // Mode profil saya
        for (const p of all) {
          // saya diakui anggota tim kalau ada permintaan "diterima" milik saya
          const saya = (p.requests || []).find((r) => r.status === 'diterima'
            && String(r.username).toLowerCase() === String(nama).toLowerCase());
          if (saya) diterima.push(p);

          // postingan milik sendiri: hitung anggota yang diterima
          if (p.ownerUsername
            && String(p.ownerUsername).toLowerCase() === String(nama).toLowerCase()) {
            dibantuGabung += (p.requests || []).filter((r) => r.status === 'diterima').length;
          }
        }
      } else if (viewUsername) {
        // Mode profil publik orang lain
        for (const p of all) {
          const anggotaCukup = (p.requests || []).find((r) => r.status === 'diterima'
            && String(r.username).toLowerCase() === String(viewUsername).toLowerCase());
          if (anggotaCukup) diterima.push(p);

          if (p.ownerUsername
            && String(p.ownerUsername).toLowerCase() === String(viewUsername).toLowerCase()) {
            dibantuGabung += (p.requests || []).filter((r) => r.status === 'diterima').length;
          }
        }
      }
    } catch {
      // server tidak jalan: statistik tetap tampil 0
    }

    $('stat-lomba').textContent = diterima.length;
    $('stat-prestasi').textContent = mergedHistory(profile).filter((h) => PRESTASI_REGEX.test(h.result)).length;
    $('stat-partner').textContent = dibantuGabung;
  }

  /* ---------- Form ---------- */
  function fillForm() {
    $('input-name').value = profile.name || '';
    $('input-username').value = profile.username || '';
    $('input-campus').value = profile.campus || '';
    $('input-major').value = profile.major || '';
    $('input-contact').value = profile.contact || '';
    $('input-bio').value = profile.bio || '';
    $('input-interest').value = (profile.interests || []).join(', ');
    $('input-skill').value = (profile.skills || []).join(', ');
    $('input-history').value = historyToText(profile.history);
    $('input-looking').checked = profile.looking !== false;
    $('input-photo').value = '';
    pendingPhoto = null;
    clearErrors();
  }

  function openForm() {
    if (viewUsername) return; // profil orang lain: tidak boleh edit
    fillForm();
    formSection.hidden = false;
    formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('input-name').focus({ preventScroll: true });
  }

  function closeForm() {
    pendingPhoto = null;
    setAvatar($('profile-avatar'), profile.photo); // buang pratinjau foto yang belum disimpan
    formSection.hidden = true;
    clearErrors();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setMessage(text, type = '') {
    messageEl.textContent = text;
    messageEl.className = `form-message${type ? ' ' + type : ''}`;
  }

  function clearErrors() {
    form.querySelectorAll('.invalid').forEach((el) => el.classList.remove('invalid'));
    setMessage('');
  }

  function validate() {
    const errors = [];
    const need = (el, msg) => { if (!el.value.trim()) errors.push({ el, msg }); };

    need($('input-name'), 'Nama lengkap wajib diisi.');
    need($('input-username'), 'Username wajib diisi.');
    need($('input-campus'), 'Kampus / sekolah wajib diisi.');
    need($('input-major'), 'Jurusan wajib diisi.');
    need($('input-contact'), 'Kontak wajib diisi.');

    const username = $('input-username').value.trim();
    if (username && !/^[A-Za-z0-9._]{3,20}$/.test(username)) {
      errors.push({ el: $('input-username'), msg: 'Username 3-20 karakter: huruf, angka, titik, atau underscore.' });
    }

    return errors;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    clearErrors();

    const errors = validate();
    if (errors.length) {
      errors.forEach(({ el }) => el.classList.add('invalid'));
      setMessage(errors[0].msg, 'error');
      errors[0].el.focus();
      return;
    }

    const updated = {
      ...profile,
      name: $('input-name').value.trim(),
      username: (session ? session.username : $('input-username').value.trim().replace(/^@/, '')),
      campus: $('input-campus').value.trim(),
      major: $('input-major').value.trim(),
      contact: $('input-contact').value.trim(),
      bio: $('input-bio').value.trim(),
      interests: splitList($('input-interest').value),
      skills: splitList($('input-skill').value),
      history: parseHistory($('input-history').value),
      looking: $('input-looking').checked
    };
    if (pendingPhoto) updated.photo = pendingPhoto;

    if (!saveProfile(updated)) {
      setMessage('Gagal menyimpan. Penyimpanan browser penuh atau diblokir.', 'error');
      return;
    }

    profile = updated;

    // Simpan juga keserver supaya bisa dilihat orang lain
    try {
      await ProfileAPI.save(session.username, updated);
      showToast('Profil berhasil disimpan 🎉');
    } catch (err) {
      showToast('Profil tersimpan di browser, tapi gagal ke server: ' + err.message, 'error');
    }

    renderProfile();
    closeForm();
  }

  /* ---------- Tampilkan halaman sesuai mode ---------- */
  function tampilkanMode() {
    const bannerEl = $('page-badge-text');
    const headingEl = $('profile-heading');
    const subEl = document.querySelector('.profile-subheading');

    if (viewUsername) {
      // Profil publik orang lain -> semua tombol edit disembunyikan
      if (bannerEl) bannerEl.textContent = 'PROFIL PUBLIK';
      if (headingEl) headingEl.innerHTML = `Kenalan dulu sama <span class="hero-accent">@${escapeHtml(viewUsername)}</span>! 🏆`;
      if (subEl) subEl.textContent = 'Cek pengalaman, keahlian, dan lomba yang pernah diikutinya sebelum mengajak gabung.';
      document.querySelectorAll('#btn-edit-profile, .avatar-edit, .link-add, #form-profil')
        .forEach((el) => { el.hidden = true; });
    } else {
      if (bannerEl) bannerEl.textContent = 'PROFIL SAYA';
      if (headingEl) headingEl.innerHTML = 'Halo, <span class="hero-accent">Pejuang Prestasi!</span> <span class="wave">👋</span>';
      if (subEl) subEl.textContent = 'Lengkapi profilmu supaya teman seperjuangan lebih mudah menemukanmu.';
    }
  }

  /* ---------- Muat data profil (dari server, cadangan lokal) ---------- */
  async function muatProfil() {
    if (viewUsername) {
      // Profil publik orang lain: ambil dari server
      try {
        const data = await ProfileAPI.get(viewUsername);
        if (data) {
          profile = { ...profile, ...data };
        } else {
          showToast('Profil ini belum pernah disimpan ke server.', 'error');
        }
      } catch (err) {
        showToast('Gagal memuat profil: ' + err.message, 'error');
      }
      return;
    }

    if (!session) return;

    try {
      const data = await ProfileAPI.get(session.username);
      if (data) {
        profile = { ...loadProfile(), ...data };
        console.log('profil dari server (sinkron)');
      }
    } catch {
      // server tidak jalan -> cukup pakai data lokal
    }
  }

  /* ---------- Event ---------- */
  $('btn-edit-profile').addEventListener('click', openForm);
  $('btn-cancel').addEventListener('click', closeForm);
  document.querySelector('.link-add').addEventListener('click', (e) => {
    e.preventDefault();
    openForm();
    $('input-history').focus({ preventScroll: true });
  });
  document.querySelector('.avatar-edit').addEventListener('click', () => {
    openForm();
    $('input-photo').focus({ preventScroll: true });
  });

  form.addEventListener('submit', handleSubmit);
  form.addEventListener('input', (e) => e.target.classList.remove('invalid'));

  $('input-photo').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) { pendingPhoto = null; return; }
    try {
      pendingPhoto = await resizeImage(file);
      setAvatar($('profile-avatar'), pendingPhoto); // pratinjau langsung
      setMessage('');
    } catch (err) {
      pendingPhoto = null;
      e.target.value = '';
      setMessage(err.message, 'error');
    }
  });

  /* ---------- Inisialisasi ---------- */
  (async () => {
    tampilkanMode();
    await muatProfil();
    renderProfile();

    // Jika halaman dibuka dengan #form-profil (mis. dari dropdown "Edit Profil"),
    // langsung buka form edit dan lompat ke sana
    if (location.hash === '#form-profil') openForm();
  })();
})();
