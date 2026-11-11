/* =========================================================
   LombaMate - tambah-partner.js
   POST -> form "Tambah Partner"
   PUT  -> form yang sama saat dibuka dengan ?id=... (mode Edit)
   ========================================================= */
'use strict';

(() => {
  const $ = (id) => document.getElementById(id);

  const form = $('partner-form');
  const messageEl = $('form-message');
  const competitionEl = $('input-competition');
  const otherWrap = $('other-competition-wrap');
  const otherInput = $('input-competition-other');
  const deadlineEl = $('input-deadline');
  const submitBtn = $('btn-submit');
  const resetBtn = $('btn-reset');

  const editId = new URLSearchParams(window.location.search).get('id');
  let editing = null; // data partner yang sedang diedit

  /* Simpan semua <optgroup> asli supaya bisa disaring per kategori */
  const allGroups = Array.from(competitionEl.querySelectorAll('optgroup')).map((g) => g.cloneNode(true));
  const placeholderOption = competitionEl.querySelector('option[value=""]').cloneNode(true);

  /* ---------- Ambil data dari form ---------- */
  function getFormData() {
    const fd = new FormData(form);
    const text = (name) => String(fd.get(name) || '').trim();

    let competition = text('competition');
    if (competition === 'lainnya') competition = text('competition_other');

    const slotsRaw = text('slots');

    return {
      category: text('category'),
      competition,
      organizer: text('organizer'),
      level: text('level'),
      deadline: text('deadline'),
      link: text('link'),
      teamSize: text('team_size'),
      slots: slotsRaw === '' ? null : Number(slotsRaw),
      roles: fd.getAll('roles'),
      scope: text('scope'),
      description: text('description'),
      contactType: text('contact_type'),
      contact: text('contact')
    };
  }

  /* ---------- Dropdown lomba mengikuti kategori ---------- */
  function filterCompetitionByCategory(category, keepValue) {
    const current = keepValue !== undefined ? keepValue : competitionEl.value;
    const index = CATEGORY_ORDER.indexOf(category);

    competitionEl.innerHTML = '';
    competitionEl.appendChild(placeholderOption.cloneNode(true));

    allGroups.forEach((group, i) => {
      const isLast = i === allGroups.length - 1; // grup "Lainnya"
      if (index === -1 || i === index || isLast) {
        competitionEl.appendChild(group.cloneNode(true));
      }
    });

    // Pertahankan pilihan lama jika masih tersedia
    const stillThere = Array.from(competitionEl.options).some((o) => o.value === current || o.text === current);
    competitionEl.value = stillThere ? current : '';
    toggleOtherField();
  }

  function toggleOtherField() {
    const isOther = competitionEl.value === 'lainnya';
    otherWrap.hidden = !isOther;
    if (!isOther) otherInput.value = '';
  }

  /* ---------- Preview ---------- */
  function updatePreview() {
    const d = getFormData();
    const cat = CATEGORIES[d.category];

    $('preview-competition').textContent = d.competition || 'Nama lomba';
    $('preview-category').textContent = cat ? `${cat.emoji} ${cat.label}` : 'Kategori belum dipilih';

    const rolesEl = $('preview-roles');
    rolesEl.innerHTML = '';
    const roles = d.roles.length ? d.roles : ['Peran dibutuhkan'];
    roles.forEach((r) => {
      const li = document.createElement('li');
      li.className = 'tag';
      li.textContent = r;
      rolesEl.appendChild(li);
    });

    const parts = [`Batas daftar: ${formatTanggal(d.deadline)}`];
    if (d.slots) parts.push(`Butuh ${d.slots} partner`);
    $('preview-meta').textContent = parts.join(' · ');
  }

  /* ---------- Validasi ---------- */
  function validate(d) {
    const errors = [];
    const add = (target, message) => errors.push({ target, message });

    if (!d.category) {
      add(document.querySelector('.category-grid'), 'Pilih kategori lomba dulu ya.');
    }

    if (!d.competition) {
      const isOther = competitionEl.value === 'lainnya';
      add(isOther ? otherInput : competitionEl,
        isOther ? 'Tulis nama lombanya dulu ya.' : 'Pilih nama lomba dulu ya.');
    }

    if (d.link) {
      let ok = false;
      try {
        const u = new URL(d.link);
        ok = u.protocol === 'http:' || u.protocol === 'https:';
      } catch { /* tidak valid */ }
      if (!ok) add($('input-link'), 'Link info lomba harus diawali http:// atau https://');
    }

    if (d.deadline) {
      const unchanged = editing && editing.deadline === d.deadline;
      if (!unchanged && d.deadline < todayISO()) {
        add(deadlineEl, 'Batas pendaftaran tidak boleh sebelum hari ini.');
      }
    }

    if (d.slots !== null && (!Number.isInteger(d.slots) || d.slots < 1 || d.slots > 10)) {
      add($('input-slots'), 'Jumlah partner yang dicari harus 1 sampai 10.');
    }

    if (d.roles.length === 0) {
      add($('role-group'), 'Pilih minimal satu peran yang dibutuhkan.');
    }

    if (!d.contact) {
      add($('input-contact'), 'Isi kontak yang bisa dihubungi.');
    } else {
      const c = d.contact;
      let msg = '';
      if (d.contactType === 'WhatsApp') {
        const digits = c.replace(/\D/g, '');
        if (digits.length < 9 || digits.length > 15) msg = 'Nomor WhatsApp tidak valid (9-15 digit).';
      } else if (d.contactType === 'Email') {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) msg = 'Format email tidak valid.';
      } else if (d.contactType === 'Instagram' || d.contactType === 'Telegram') {
        if (!/^@?[A-Za-z0-9._]{3,}$/.test(c)) msg = `Username ${d.contactType} tidak valid.`;
      }
      if (msg) add($('input-contact'), msg);
    }

    return errors;
  }

  function clearErrors() {
    form.querySelectorAll('.invalid, .invalid-group').forEach((el) => {
      el.classList.remove('invalid', 'invalid-group');
    });
    setMessage('');
  }

  function showErrors(errors) {
    errors.forEach(({ target }) => {
      const isGroup = target.matches('.category-grid, .chip-group');
      target.classList.add(isGroup ? 'invalid-group' : 'invalid');
    });

    setMessage(errors[0].message, 'error');

    const first = errors[0].target;
    first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (first.focus && !first.matches('.category-grid, .chip-group')) first.focus({ preventScroll: true });
  }

  function setMessage(text, type = '') {
    messageEl.textContent = text;
    messageEl.className = `form-message${type ? ' ' + type : ''}`;
  }

  function setBusy(busy, label) {
    submitBtn.disabled = busy;
    form.querySelectorAll('input, select, textarea, button').forEach((el) => {
      if (el !== submitBtn) el.disabled = busy;
    });
    if (label) $('btn-submit-label').textContent = label;
  }

  /* ---------- Data pemilik (diambil dari profil) ----------
     Username diambil dari sesi login (paling otoritatif)     */
  function ownerFromProfile() {
    const p = loadProfile();
    const s = getSession();
    return {
      ownerName: p.name || (s && s.name) || 'Pejuang Prestasi',
      ownerCampus: p.campus || '',
      ownerUsername: (s && s.username) || p.username || '',
      ownerPhoto: p.photo || ''
    };
  }

  /* ---------- Mode Edit: isi form dari data server ---------- */
  function fillForm(p) {
    const check = (name, value) => {
      const el = form.querySelector(`input[name="${name}"][value="${CSS.escape(value)}"]`);
      if (el) el.checked = true;
    };

    if (p.category) check('category', p.category);
    filterCompetitionByCategory(p.category, '');

    const hasOption = Array.from(competitionEl.options).some((o) => o.value === p.competition || o.text === p.competition);
    if (hasOption) {
      competitionEl.value = p.competition;
    } else {
      competitionEl.value = 'lainnya';
      otherInput.value = p.competition || '';
    }
    toggleOtherField();
    if (!hasOption) otherInput.value = p.competition || '';

    $('input-organizer').value = p.organizer || '';
    $('input-level').value = p.level || '';
    deadlineEl.value = p.deadline || '';
    $('input-link').value = p.link || '';
    $('input-team-size').value = p.teamSize || '';
    $('input-slots').value = p.slots ?? '';
    $('input-description').value = p.description || '';
    $('input-contact-type').value = p.contactType || 'WhatsApp';
    $('input-contact').value = p.contact || '';

    form.querySelectorAll('input[name="roles"]').forEach((el) => {
      el.checked = (p.roles || []).includes(el.value);
    });
    if (p.scope) check('scope', p.scope);

    updatePreview();
  }

  function enterEditMode() {
    document.title = 'Edit Partner - LombaMate';
    $('page-badge-text').textContent = 'EDIT PARTNER';
    $('page-title').innerHTML = 'Edit <span class="hero-accent">Partnermu!</span> <span class="wave">✏️</span>';
    $('page-subtitle').textContent = 'Perbarui detail lomba atau partner yang kamu cari, lalu simpan perubahannya.';
    $('btn-submit-label').textContent = 'Simpan Perubahan';

    // Tombol Reset berubah jadi Batal
    resetBtn.type = 'button';
    resetBtn.textContent = 'Batal';
    resetBtn.addEventListener('click', () => { window.location.href = 'index.html#teman'; });
  }

  async function loadForEdit() {
    enterEditMode();
    setBusy(true);
    setMessage('Memuat data partner...');

    try {
      editing = await PartnerAPI.getById(editId);
      setBusy(false);
      setMessage('');
      fillForm(editing);
    } catch (err) {
      setMessage(`${err.message} Kembali ke Beranda lalu coba lagi.`, 'error');
      showToast(err.message, 'error');
      // form tetap terkunci, hanya tombol Batal yang aktif
      resetBtn.disabled = false;
    }
  }

  /* ---------- Submit: POST atau PUT ---------- */
  async function handleSubmit(e) {
    e.preventDefault();
    clearErrors();

    const data = getFormData();
    const errors = validate(data);
    if (errors.length) return showErrors(errors);

    const idleLabel = editId ? 'Simpan Perubahan' : 'Tambah Partner';
    setBusy(true, 'Menyimpan...');

    try {
      if (editId) {
        // PUT: pertahankan data pemilik yang lama
        const owner = {
          ownerName: editing.ownerName,
          ownerCampus: editing.ownerCampus,
          ownerUsername: editing.ownerUsername,
          ownerPhoto: editing.ownerPhoto
        };
        const session = getSession();
        await PartnerAPI.update(editId, { ...owner, ...data });
        setFlash('Partner berhasil diperbarui ✨');
      } else {
        // POST
        await PartnerAPI.create({ ...data, ...ownerFromProfile() });
        setFlash('Partner berhasil ditambahkan 🎉');
      }
      window.location.href = 'index.html#teman';
    } catch (err) {
      setBusy(false, idleLabel);
      setMessage(err.message, 'error');
      showToast(err.message, 'error');
    }
  }

  /* ---------- Event ---------- */
  form.addEventListener('submit', handleSubmit);

  form.addEventListener('input', (e) => {
    e.target.classList.remove('invalid');
    const group = e.target.closest('.invalid-group');
    if (group) group.classList.remove('invalid-group');
    updatePreview();
  });

  form.addEventListener('change', (e) => {
    if (e.target.name === 'category') filterCompetitionByCategory(e.target.value);
    if (e.target.id === 'input-competition') toggleOtherField();
    const group = e.target.closest('.invalid-group');
    if (group) group.classList.remove('invalid-group');
    updatePreview();
  });

  form.addEventListener('reset', () => {
    // dijalankan setelah form dikosongkan oleh browser
    setTimeout(() => {
      clearErrors();
      filterCompetitionByCategory('', '');
      updatePreview();
    }, 0);
  });

  /* ---------- Inisialisasi ---------- */
  if (!editId) deadlineEl.min = todayISO();
  updatePreview();
  if (editId) loadForEdit();
})();
