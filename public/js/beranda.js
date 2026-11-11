/* =========================================================
   LombaMate - beranda.js
   2 tampilan: "Cari Teman" (semua partner) & "Tim Saya"
   (postingan milik sendiri + tim yang diikuti)
   GET    -> menampilkan semua partner sebagai kartu
   POST   -> tombol Ikuti (permintaan gabung)
   PUT/DELETE -> Terima/Tolak (pemilik) & Batalkan/Tinggalkan
   DELETE -> tombol Hapus (dengan konfirmasi, hanya pemilik)
   Tombol Edit mengarah ke tambah-partner.html?id=... (PUT)
   ========================================================= */
'use strict';

(() => {
  const listEl = document.getElementById('partner-list');
  const searchEl = document.getElementById('search-input');
  const filterEl = document.getElementById('filter-category');
  const deadlineEl = document.getElementById('filter-deadline');
  const countEl = document.getElementById('partner-count');

  // simpan tampilan "belum ada teman" bawaan HTML untuk dipakai saat data kosong
  const emptyHTML = listEl.innerHTML;

  let partners = [];
  let currentView = 'cari'; // 'cari' | 'timku'

  // Bisa dibuka langsung di tab "Tim Saya" lewat index.html#timku
  if (location.hash === '#timku') currentView = 'timku';

  /* ---------- Tampilan status ---------- */
  function showLoading() {
    listEl.innerHTML = `
      <div class="state-box">
        <div class="spinner" aria-hidden="true"></div>
        <p class="empty-text">Memuat data partner...</p>
      </div>`;
    countEl.textContent = '';
  }

  function showError(message) {
    listEl.innerHTML = `
      <div class="state-box state-error">
        <img src="assets/mascot-kepala-tidur.png" alt="" class="empty-mascot">
        <p class="empty-text">${escapeHtml(message)}</p>
        <button type="button" class="btn-secondary" id="btn-retry">Coba Lagi</button>
      </div>`;
    countEl.textContent = '';
  }

  /* ---------- Helper tampilan ---------- */
  function deadlineInfo(deadline) {
    const days = sisaHari(deadline);
    if (days === null) return { text: 'Batas daftar belum ditentukan', cls: '' };
    if (days < 0) return { text: 'Pendaftaran ditutup', cls: 'is-expired' };
    if (days === 0) return { text: 'Hari ini batas daftar!', cls: 'is-urgent' };
    if (days <= 7) return { text: `${days} hari lagi · ${formatTanggal(deadline)}`, cls: 'is-urgent' };
    return { text: `Daftar sampai ${formatTanggal(deadline)}`, cls: '' };
  }

  // Badge "Baru" untuk postingan dibuat maksimal 3 hari terakhir
  function isBaru(p) {
    if (!p.createdAt) return false;
    const dibuat = new Date(p.createdAt).setHours(0, 0, 0, 0);
    const hariIni = new Date().setHours(0, 0, 0, 0);
    return (hariIni - dibuat) <= 3 * 86400000;
  }

  function myUsername() {
    const session = getSession();
    return session ? String(session.username).toLowerCase() : null;
  }

  function isOwner(p) {
    const me = myUsername();
    return Boolean(me && p.ownerUsername
      && String(p.ownerUsername).toLowerCase() === me);
  }

  // permintaan saya di kartu ini yang masih berlaku (menunggu / diterima)
  function myRequest(p) {
    const me = myUsername();
    if (!me) return null;
    return (p.requests || []).find((r) => r.status !== 'ditolak'
      && String(r.username).toLowerCase() === me) || null;
  }

  /* ---------- Template kartu ---------- */
  function cardTemplate(p) {
    const cat = CATEGORIES[p.category] || { label: 'Lainnya', emoji: '✨' };
    const contact = buildContact(p.contactType, p.contact);
    const deadline = deadlineInfo(p.deadline);
    const roles = Array.isArray(p.roles) ? p.roles : [];
    const requests = Array.isArray(p.requests) ? p.requests : [];
    const owner = isOwner(p);
    const mine = myRequest(p);

    const meta = [p.organizer, p.level].filter(Boolean).map(escapeHtml).join(' · ');

    // info kuota
    const slotInfo = p.penuh
      ? `<li class="is-penuh">👥 Kuota penuh</li>`
      : (p.sisa !== null && p.sisa !== undefined
        ? `<li>👥 Bisa buat ${escapeHtml(p.sisa)} partner lagi${p.teamSize ? ` · ${escapeHtml(p.teamSize)}` : ''}</li>`
        : `<li>👥 Cari partner · jumlah bebas${p.teamSize ? ` · ${escapeHtml(p.teamSize)}` : ''}</li>`);

    const contactBtn = contact.href
      ? `<a class="btn-contact" href="${escapeHtml(contact.href)}" target="_blank" rel="noopener">${escapeHtml(contact.label)}</a>`
      : `<span class="btn-contact is-text">${escapeHtml(contact.label)}</span>`;

    const linkAman = safeUrl(p.link);
    const infoLink = linkAman
      ? `<a class="pc-link" href="${escapeHtml(linkAman)}" target="_blank" rel="noopener">Info lomba ↗</a>`
      : '';

    // nama pemilik bisa diklik untuk melihat profil publiknya
    const pemilikLink = p.ownerUsername
      ? `<a class="pc-owner" href="profil.html?u=${encodeURIComponent(p.ownerUsername)}" title="Lihat profil">${escapeHtml(p.ownerName || 'Pejuang Prestasi')}</a>`
      : `<span class="pc-owner">${escapeHtml(p.ownerName || 'Pejuang Prestasi')}</span>`;

    // Badge di pojok kartu
    let badge = '';
    if (owner) badge = '<span class="pc-badge-owner">📌 Postinganmu</span>';
    else if (mine && mine.status === 'diterima') badge = '<span class="pc-badge-joined">✔ Anggota tim</span>';
    else if (isBaru(p)) badge = '<span class="pc-badge-new">✨ Baru</span>';

    // tombol Ikuti / status permintaan saya (untuk pengunjung, bukan pemilik)
    let joinArea = '';
    if (!owner) {
      if (mine && mine.status === 'diterima') {
        joinArea = `<span class="btn-contact is-joined">✔ Permintaanmu diterima!</span>`;
      } else if (mine) {
        joinArea = `<span class="btn-contact is-text is-waiting">⏳ Menunggu persetujuan pemilik</span>`;
      } else if (!p.penuh) {
        joinArea = `<button type="button" class="btn-contact btn-join" data-join="${escapeHtml(p.id)}">🤝 Ikuti</button>`;
      }
    }

    // Untuk pemilik: daftar orang yang meminta gabung (status: menunggu)
    const pending = requests.filter((r) => r.status === 'menunggu');
    const accepted = requests.filter((r) => r.status === 'diterima');
    const requestArea = owner ? `
      <div class="pc-requests">
        <p class="pc-requests-title">Permintaan gabung (${pending.length} menunggu · ${accepted.length} diterima)</p>
        ${pending.length === 0 ? '<p class="pc-request-empty">Belum ada yang minta gabung. Sabar ya! 🙌</p>' : ''}
        <ul class="pc-request-list">
          ${pending.map((r) => `
            <li class="pc-request">
              <span class="pc-request-name">${escapeHtml(r.name)} <small>@${escapeHtml(r.username)}</small></span>
              <button type="button" class="btn-card btn-card-accept" data-accept="${escapeHtml(r.id)}">✅ Terima</button>
              <button type="button" class="btn-card btn-card-reject" data-reject="${escapeHtml(r.id)}">❌ Tolak</button>
            </li>`).join('')}
        </ul>
        ${p.penuh ? '<p class="pc-request-empty">Kuota sudah penuh — kartu ini disembunyikan dari orang lain.</p>' : ''}
      </div>` : '';

    // Untuk kartu di tab "Tim Saya": status + tombol batal / tinggalkan
    let timSayaArea = '';
    if (currentView === 'timku' && !owner && mine) {
      const tombol = mine.status === 'diterima'
        ? `<button type="button" class="btn-card btn-card-delete" data-cancel="${escapeHtml(mine.id)}">👋 Tinggalkan Tim</button>`
        : `<button type="button" class="btn-card btn-card-reject" data-cancel="${escapeHtml(mine.id)}">✖ Batalkan Permintaan</button>`;
      timSayaArea = `<div class="pc-manage">${tombol}</div>`;
    }

    // Pemilik saja yang boleh Edit & Hapus (keamanan)
    const manageArea = owner ? `
      <div class="pc-manage">
        <a class="btn-card btn-card-edit" href="tambah-partner.html?id=${encodeURIComponent(p.id)}">✏️ Edit</a>
        <button type="button" class="btn-card btn-card-delete" data-delete="${escapeHtml(p.id)}">🗑️ Hapus</button>
      </div>` : '';

    return `
      <article class="partner-card" data-id="${escapeHtml(p.id)}">
        <div class="pc-top">
          <img class="pc-avatar${p.ownerPhoto ? ' has-photo' : ''}" src="${escapeHtml(p.ownerPhoto || DEFAULT_AVATAR)}" alt="">
          <div class="pc-owner-wrap">
            <h3 class="pc-owner-title">${pemilikLink}</h3>
            <p class="pc-campus">${escapeHtml(p.ownerCampus || 'Mencari partner')}</p>
          </div>
          ${badge}
        </div>

        <span class="pc-category">${cat.emoji} ${escapeHtml(cat.label)}</span>
        <h4 class="pc-competition">${escapeHtml(p.competition)}</h4>
        ${meta ? `<p class="pc-meta">${meta}</p>` : ''}

        ${roles.length ? `<ul class="tag-list pc-roles">${roles.map((r) => `<li class="tag">${escapeHtml(r)}</li>`).join('')}</ul>` : ''}

        ${p.description ? `<p class="pc-desc">${escapeHtml(p.description)}</p>` : ''}

        <ul class="pc-info">
          ${slotInfo}
          <li class="${deadline.cls}">⏰ ${escapeHtml(deadline.text)}</li>
          ${p.scope ? `<li>📍 ${escapeHtml(p.scope)}</li>` : ''}
        </ul>

        <div class="pc-actions">
          ${contactBtn}
          ${infoLink}
          ${joinArea}
        </div>

        ${requestArea}
        ${timSayaArea}
        ${manageArea}
      </article>`;
  }

  /* ---------- Filter & render ---------- */
  function getFiltered(list = partners) {
    const q = searchEl.value.trim().toLowerCase();
    const cat = filterEl.value;
    const dl = deadlineEl.value;

    return list.filter((p) => {
      if (cat && p.category !== cat) return false;

      // filter deadline
      if (dl) {
        const days = sisaHari(p.deadline);
        if (dl === 'closed') {
          if (days === null || days >= 0) return false;
        } else {
          if (days === null || days < 0 || days > Number(dl)) return false;
        }
      }

      if (!q) return true;

      const haystack = [
        p.competition, p.organizer, p.level, p.ownerName, p.ownerCampus,
        p.description, p.scope, (p.roles || []).join(' '),
        (CATEGORIES[p.category] || {}).label
      ].join(' ').toLowerCase();

      return haystack.includes(q);
    });
  }

  function getTimSaya() {
    // Tim Saya = postingan milik sendiri + tim yang diikuti (menunggu / diterima)
    return partners.filter((p) => isOwner(p) || myRequest(p));
  }

  function timSayaCount() {
    return getTimSaya().length;
  }

  // Kartu kuota penuh disembunyikan dari beranda umum,
  // KECUALI untuk pemiliknya dan orang yang punya permintaan aktif di sana
  function sembunyikanPenuh(list) {
    return list.filter((p) => !p.penuh || isOwner(p) || myRequest(p));
  }

  function updateHeaderTeks() {
    const titleEl = document.querySelector('.partners-title');
    const subEl = document.querySelector('.partners-subtitle');
    if (!titleEl) return;
    if (currentView === 'timku') {
      titleEl.innerHTML = 'Tim Saya <span class="heart">👥</span>';
      if (subEl) subEl.textContent = 'Tim yang kamu buat dan tim yang kamu ikuti. Semangat ya!';
    } else {
      titleEl.innerHTML = 'Teman yang Sedang Mencari Partner <span class="heart">💙</span>';
      if (subEl) subEl.textContent = 'Yuk, kenalan dengan teman-teman yang siap berjuang bersama!';
    }
  }

  function render() {
    updateHeaderTeks();

    // Baton jumlah di tab "Tim Saya"
    const countTab = document.querySelector('.view-count');
    if (countTab) countTab.textContent = timSayaCount() ? `(${timSayaCount()})` : '';

    const asal = currentView === 'timku' ? getTimSaya() : partners;
    if (asal.length === 0) {
      listEl.innerHTML = currentView === 'timku'
        ? `
        <div class="state-box">
          <img src="assets/mascot-kepala-tidur.png" alt="" class="empty-mascot">
          <p class="empty-text">Belum ada timmu di sini. Cari teman dulu di tab "Cari Teman" ya! 🔍</p>
        </div>`
        : emptyHTML;
      if (currentView !== 'timku') countEl.textContent = '';
      return;
    }

    let hasil = asal;
    if (currentView !== 'timku') hasil = sembunyikanPenuh(hasil);
    const filtered = getFiltered(hasil);
    countEl.textContent = `Menampilkan ${filtered.length} dari ${asal.length} partner`;

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="state-box">
          <img src="assets/mascot-kepala-tidur.png" alt="" class="empty-mascot">
          <p class="empty-text">${currentView === 'timku'
            ? 'Tidak ada tim yang cocok dengan pencarianmu.'
            : 'Tidak ada partner yang cocok dengan pencarianmu.'}</p>
        </div>`;
      return;
    }

    listEl.innerHTML = `<div class="partner-grid">${filtered.map(cardTemplate).join('')}</div>`;
  }

  /* ---------- GET ---------- */
  async function loadPartners() {
    if (currentView === 'timku') {
      // set tab aktif supaya tampil klop dengan hash #timku
      document.querySelectorAll('.view-tab').forEach((t) => {
        t.classList.toggle('active', t.dataset.view === currentView);
      });
    }
    showLoading();
    try {
      const data = await PartnerAPI.getAll();
      // Terbaru di atas
      partners = data.slice().sort((a, b) => {
        return String(b.createdAt || '').localeCompare(String(a.createdAt || '')) || Number(b.id) - Number(a.id);
      });
      render();
    } catch (err) {
      showError(err.message);
    }
  }

  /* ---------- IKUTI ---------- */
  async function handleJoin(button) {
    const id = button.dataset.join;
    const partner = partners.find((p) => String(p.id) === String(id));
    if (!partner) return;

    const session = getSession();
    if (!session) {
      showToast('Masuk dulu sebelum mengikuti tim ya.', 'error');
      return;
    }

    const ok = await confirmDialog({
      title: 'Mau gabung tim ini?',
      message: `Permintaan gabung ke "${partner.competition}" akan dikirim ke ${partner.ownerName || 'pemilik'} dan 1 kuota akan langsung ditahan untukmu.`,
      confirmText: 'Ya, Ikuti',
      cancelText: 'Batal'
    });
    if (!ok) return;

    button.disabled = true;
    button.textContent = 'Mengirim...';

    try {
      await JoinAPI.requestJoin(id);
      await loadPartners();
      showToast('Permintaan gabung terkirim! 🤝');
    } catch (err) {
      button.disabled = false;
      button.textContent = '🤝 Ikuti';
      showToast(err.message, 'error');
    }
  }

  /* ---------- TERIMA / TOLAK (khusus pemilik) ---------- */
  async function handleDecide(button) {
    const joinId = button.dataset.accept || button.dataset.reject;
    const status = button.dataset.accept ? 'diterima' : 'ditolak';

    if (status === 'ditolak') {
      const ok = await confirmDialog({
        title: 'Tolak permintaan ini?',
        message: 'Permintaan akan ditolak dan 1 kuota dikembalikan ke postingan.',
        confirmText: 'Ya, Tolak',
        cancelText: 'Batal'
      });
      if (!ok) return;
    }

    const session = getSession();
    button.disabled = true;
    try {
      await JoinAPI.decide(joinId, status);
      await loadPartners();
      showToast(status === 'diterima' ? 'Permintaan diterima! 🎉' : 'Permintaan ditolak.');
    } catch (err) {
      button.disabled = false;
      showToast(err.message, 'error');
    }
  }

  /* ---------- BATALKAN PERMINTAAN / TINGGALKAN TIM ---------- */
  async function handleCancel(button) {
    const joinId = button.dataset.cancel;
    const session = getSession();
    if (!session) return;

    const ok = await confirmDialog({
      title: button.textContent.indexOf('Tinggalkan') !== -1 ? 'Tinggalkan tim ini?' : 'Batalkan permintaan?',
      message: 'Kuota di postingan akan kembali tersedia untuk orang lain.',
      confirmText: 'Ya, lanjut',
      cancelText: 'Batal'
    });
    if (!ok) return;

    button.disabled = true;
    try {
      await JoinAPI.cancel(joinId);
      await loadPartners();
      showToast('Berhasil dihapus dari tim 👋');
    } catch (err) {
      button.disabled = false;
      showToast(err.message, 'error');
    }
  }

  /* ---------- DELETE (hanya pemilik) ---------- */
  async function handleDelete(button) {
    const id = button.dataset.delete;
    const partner = partners.find((p) => String(p.id) === String(id));
    if (!partner) return;

    const ok = await confirmDialog({
      title: 'Hapus partner ini?',
      message: `Postingan "${partner.competition}" akan dihapus permanen dan tidak bisa dikembalikan.`,
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal'
    });
    if (!ok) return;

    const session = getSession();
    button.disabled = true;
    button.textContent = 'Menghapus...';

    try {
      await PartnerAPI.remove(id);
      partners = partners.filter((p) => String(p.id) !== String(id));
      render();
      showToast('Partner berhasil dihapus 🗑️');
    } catch (err) {
      button.disabled = false;
      button.textContent = '🗑️ Hapus';
      showToast(err.message, 'error');
    }
  }

  /* ---------- Tab tampilan ---------- */
  document.querySelectorAll('.view-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      currentView = tab.dataset.view;
      document.querySelectorAll('.view-tab').forEach((t) => {
        t.classList.toggle('active', t === tab);
      });
      render();
    });
  });

  /* ---------- Event ---------- */
  listEl.addEventListener('click', (e) => {
    const join = e.target.closest('[data-join]');
    if (join) return handleJoin(join);

    const accept = e.target.closest('[data-accept]');
    if (accept) return handleDecide(accept);

    const reject = e.target.closest('[data-reject]');
    if (reject) return handleDecide(reject);

    const cancel = e.target.closest('[data-cancel]');
    if (cancel) return handleCancel(cancel);

    const del = e.target.closest('[data-delete]');
    if (del) return handleDelete(del);

    if (e.target.closest('#btn-retry')) loadPartners();
  });

  searchEl.addEventListener('input', render);
  filterEl.addEventListener('change', render);
  deadlineEl.addEventListener('change', render);

  loadPartners();
})();
