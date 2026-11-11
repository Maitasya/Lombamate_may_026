/* =========================================================
   LombaMate - utils.js
   Fungsi bantu yang dipakai semua halaman.
   Harus dimuat PERTAMA (sebelum api.js dan script halaman).
   ========================================================= */
'use strict';

/* ---------- Konstanta ---------- */
const DEFAULT_AVATAR = 'assets/mascot-kepala.png';
const PROFILE_KEY = 'lombamate_profile';
const FLASH_KEY = 'lombamate_flash';

// Urutan key harus sama dengan urutan <optgroup> di dropdown "Nama Lomba"
const CATEGORY_ORDER = [
  'teknologi', 'desain', 'karya-tulis', 'bisnis',
  'sains', 'debat', 'teknik', 'olahraga-seni'
];

const CATEGORIES = {
  'teknologi':     { label: 'Teknologi & IT',          emoji: '💻' },
  'desain':        { label: 'Desain & Kreatif',        emoji: '🎨' },
  'karya-tulis':   { label: 'Karya Tulis',             emoji: '📝' },
  'bisnis':        { label: 'Bisnis & Startup',        emoji: '📈' },
  'sains':         { label: 'Sains & Olimpiade',       emoji: '🔬' },
  'debat':         { label: 'Debat & Public Speaking', emoji: '🎤' },
  'teknik':        { label: 'Teknik & Robotik',        emoji: '🤖' },
  'olahraga-seni': { label: 'Olahraga & Seni',         emoji: '🏆' }
};

/* ---------- Keamanan & format ---------- */

// Mencegah XSS saat data dimasukkan ke innerHTML
function escapeHtml(value) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value ?? '').replace(/[&<>"']/g, (c) => map[c]);
}

// URL aman untuk dipakai di atribut href: hanya http/https (#110).
// "javascript:alert(1)" yang sudah di-escape TETAP berbahaya kalau
// diklik, jadi divalidasi protokolnya sebelum dirender.
function safeUrl(value) {
  const s = String(value ?? '').trim();
  if (!/^https?:\/\//i.test(s)) return '';
  try {
    const u = new URL(s);
    return (u.protocol === 'http:' || u.protocol === 'https:') ? s : '';
  } catch {
    return '';
  }
}

// "2026-11-12" -> "12 Nov 2026"
function formatTanggal(iso) {
  if (!iso) return '-';
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Selisih hari dari hari ini (negatif = sudah lewat)
function sisaHari(iso) {
  if (!iso) return null;
  const target = new Date(iso + 'T00:00:00');
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

// Tanggal hari ini format YYYY-MM-DD (zona waktu lokal)
function todayISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

/* ---------- Link kontak ---------- */
function buildContact(type, value) {
  const v = String(value || '').trim();
  const handle = v.replace(/^@/, '');

  switch (type) {
    case 'WhatsApp': {
      let n = v.replace(/\D/g, '');
      if (n.startsWith('0')) n = '62' + n.slice(1);
      return { href: n ? `https://wa.me/${n}` : null, label: 'Chat WhatsApp' };
    }
    case 'Instagram':
      return { href: handle ? `https://instagram.com/${handle}` : null, label: 'Buka Instagram' };
    case 'Telegram':
      return { href: handle ? `https://t.me/${handle}` : null, label: 'Buka Telegram' };
    case 'Email':
      return { href: v ? `mailto:${v}` : null, label: 'Kirim Email' };
    default: // Discord dan lainnya: tidak ada tautan langsung
      return { href: null, label: `${type || 'Kontak'}: ${v}` };
  }
}

/* ---------- Profil (localStorage) ---------- */
function loadProfile() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveProfile(profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    return true;
  } catch {
    return false; // penyimpanan penuh / diblokir
  }
}

// Foto profil di navbar mengikuti foto yang disimpan di profil
// Foto asli memenuhi lingkaran (class has-photo); maskot bawaan tetap utuh
function setAvatar(img, photo) {
  img.src = photo || DEFAULT_AVATAR;
  img.classList.toggle('has-photo', Boolean(photo));
}

function applyNavbarAvatar() {
  const profile = loadProfile();
  document.querySelectorAll('.user-avatar').forEach((img) => setAvatar(img, profile.photo));
}

/* ---------- Toast ---------- */
function showToast(message, type = 'success') {
  let box = document.getElementById('toast-container');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toast-container';
    box.className = 'toast-container';
    box.setAttribute('aria-live', 'polite');
    document.body.appendChild(box);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  box.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Pesan yang tetap tampil setelah pindah halaman (mis. setelah simpan)
function setFlash(message, type = 'success') {
  try {
    sessionStorage.setItem(FLASH_KEY, JSON.stringify({ message, type }));
  } catch { /* abaikan */ }
}

function showFlash() {
  try {
    const raw = sessionStorage.getItem(FLASH_KEY);
    if (!raw) return;
    sessionStorage.removeItem(FLASH_KEY);
    const { message, type } = JSON.parse(raw);
    showToast(message, type);
  } catch { /* abaikan */ }
}

/* ---------- Dialog konfirmasi ---------- */
function confirmDialog({
  title = 'Yakin?',
  message = '',
  confirmText = 'Ya',
  cancelText = 'Batal'
} = {}) {
  return new Promise((resolve) => {
    const previousFocus = document.activeElement;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <img src="assets/mascot-kepala-tidur.png" alt="" class="modal-mascot">
        <h2 class="modal-title" id="modal-title">${escapeHtml(title)}</h2>
        <p class="modal-message">${escapeHtml(message)}</p>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" data-act="cancel">${escapeHtml(cancelText)}</button>
          <button type="button" class="btn-danger" data-act="ok">${escapeHtml(confirmText)}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));
    overlay.querySelector('[data-act="ok"]').focus();

    function close(result) {
      document.removeEventListener('keydown', onKey);
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 200);
      if (previousFocus && previousFocus.focus) previousFocus.focus();
      resolve(result);
    }

    function onKey(e) {
      if (e.key === 'Escape') close(false);
    }

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) return close(false);
      const act = e.target.closest('[data-act]');
      if (act) close(act.dataset.act === 'ok');
    });
    document.addEventListener('keydown', onKey);
  });
}

/* ---------- Dropdown menu pengguna (tombol avatar di navbar) ---------- */
function initUserMenu() {
  const wraps = document.querySelectorAll('.user-menu-wrap');
  if (!wraps.length) return;

  // Tutup semua dropdown yang terbuka
  function closeAll() {
    wraps.forEach((wrap) => {
      wrap.classList.remove('open');
      const btn = wrap.querySelector('.user-menu');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
  }

  wraps.forEach((wrap) => {
    const button = wrap.querySelector('.user-menu');
    if (!button) return;

    // Isi nama, username, dan avatar dropdown dari sesi/login,
    // lalu foto dari profil yang tersimpan
    function isiDataProfil() {
      const session = getSession();
      const profile = loadProfile();
      const nameEl = wrap.querySelector('.user-dropdown-name');
      const usernameEl = wrap.querySelector('.user-dropdown-username');
      const avatarEl = wrap.querySelector('.user-dropdown-avatar');
      if (nameEl) nameEl.textContent = (session && session.name) || profile.name || 'Pejuang Prestasi';
      if (usernameEl) usernameEl.textContent = (session && '@' + session.username)
        || (profile.username ? '@' + profile.username : 'Belum ada profil');
      if (avatarEl) setAvatar(avatarEl, profile.photo);
    }

    // Klik tombol: buka jika tertutup, tutup jika terbuka
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      const akanBuka = !wrap.classList.contains('open');
      closeAll();
      if (akanBuka) {
        isiDataProfil(); // selalu ambil data profil terbaru
        wrap.classList.add('open');
        button.setAttribute('aria-expanded', 'true');
      }
    });

    // Klik di luar menu menutup dropdown
    document.addEventListener('click', (e) => {
      if (!wrap.contains(e.target)) {
        wrap.classList.remove('open');
        button.setAttribute('aria-expanded', 'false');
      }
    });

    // Klik salah satu menu langsung menutup dropdown
    const dropdown = wrap.querySelector('.user-dropdown');
    if (dropdown) {
      dropdown.addEventListener('click', (e) => {
        if (e.target.closest('a')) closeAll();
      });
    }

    // Tombol "Keluar" dan "Keluar semua perangkat" di dropdown
    const tombolKeluar = wrap.querySelector('[data-act="logout"]');
    if (tombolKeluar) {
      tombolKeluar.addEventListener('click', () => logoutUser());
    }
    const tombolKeluarSemua = wrap.querySelector('[data-act="logout-all"]');
    if (tombolKeluarSemua) {
      tombolKeluarSemua.addEventListener('click', async () => {
        // matikan SEMUA sesi milik akun ini di database, lalu keluar seperti biasa
        try { await fetch('/api/auth/logout-all', { method: 'POST', credentials: 'same-origin' }); } catch { /* tetap keluar lokal */ }
        logoutUser();
      });
    }
  });

  // Tombol Escape menutup semua dropdown
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAll();
  });
}

/* ---------- Inisialisasi umum ---------- */
document.addEventListener('DOMContentLoaded', () => {
  applyNavbarAvatar();
  initUserMenu();
  showFlash();
});
