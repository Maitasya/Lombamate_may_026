/* =========================================================
   LombaMate - api.js
   Semua komunikasi ke back-end Express ada di sini.

   KONTRAK API (yang harus disediakan server.js):
   GET    /api/partners        -> 200  [ {partner}, ... ]
   GET    /api/partners/:id    -> 200  {partner}        | 404
   POST   /api/partners        -> 201  {partner}        | 400 {message}
   PUT    /api/partners/:id    -> 200  {partner}        | 400 / 404
   DELETE /api/partners/:id    -> 200  {message}        | 404

   Bentuk {partner}:
   {
     id, category, competition, organizer, level, deadline, link,
     teamSize, slots, roles: [], scope, description,
     contactType, contact,
     ownerName, ownerCampus, ownerUsername, createdAt
   }
   ========================================================= */
'use strict';

const API_URL = '/api/partners';

async function request(url, options = {}) {
  let response;

  try {
    response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin', // cookie sesi httpOnly ikut terkirim setiap permintaan
      ...options
    });
  } catch {
    throw new Error('Tidak bisa terhubung ke server. Pastikan server Express sudah berjalan.');
  }

  // Body bisa kosong (mis. 204) atau bukan JSON
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error((data && data.message) || `Permintaan gagal (kode ${response.status}).`);
  }

  return data;
}

/* =========================================================
   PartnerAPI.
   Catatan keamanan: identitas "siapa yang mengirim"
   tidak lagi diisi bodi (parameter requester dihapus).
   Server membuktikan lewat cookie sesi (httpOnly).
   401 = belum login, 403 = sudah login tapi bukan pemilik.
   ========================================================= */
const PartnerAPI = {
  // GET semua partner
  async getAll() {
    const data = await request(API_URL);
    return Array.isArray(data) ? data : (data && data.data) || [];
  },

  // GET satu partner (untuk mode Edit; dibatasi khusus pemilik)
  getById(id) {
    return request(`${API_URL}/${encodeURIComponent(id)}`);
  },

  // POST partner baru (pemilik ditetapkan SERVER dari sesi)
  create(partner) {
    return request(API_URL, { method: 'POST', body: JSON.stringify(partner) });
  },

  // PUT ubah partner (hanya pemilik; server yang mengizinkan)
  update(id, partner) {
    return request(`${API_URL}/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(partner)
    });
  },

  // DELETE hapus partner (hanya pemilik; server yang mengizinkan)
  remove(id) {
    return request(`${API_URL}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }
};

/* =========================================================
   API permintaan gabung (fitur "Ikuti")
   POST   /api/partners/:id/joins -> kirim permintaan
   PUT    /api/joins/:id      -> terima / tolak (pemilik)
   DELETE /api/joins/:id      -> batalkan / tinggalkan tim
   ========================================================= */
const JoinAPI = {
  // Kirim permintaan gabung: username & nama dipaksa SERVER dari sesi
  requestJoin(partnerId) {
    return request(`${API_URL}/${encodeURIComponent(partnerId)}/joins`, {
      method: 'POST',
      body: JSON.stringify({})
    });
  },

  // Pemilik memberi keputusan: status = 'diterima' | 'ditolak'
  decide(joinId, status) {
    return request(`/api/joins/${encodeURIComponent(joinId)}`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  },

  // Batalkan permintaan / tinggalkan tim (hanya pengajunya sendiri)
  cancel(joinId) {
    return request(`/api/joins/${encodeURIComponent(joinId)}`, { method: 'DELETE' });
  }
};

/* =========================================================
   API profil publik
   GET /api/profiles/:username -> lihat profil siapa pun
   PUT /api/profiles/:username -> simpan profil sendiri
   (server memastikan target sama dengan sesi cookie)
   ========================================================= */
const ProfileAPI = {
  async get(username) {
    try {
      return await request(`/api/profiles/${encodeURIComponent(username)}`);
    } catch (err) {
      // 404 = profil belum pernah disimpan -> kembalikan null saja
      if (String(err.message || '').indexOf('Profil tidak ditemukan') !== -1) return null;
      throw err;
    }
  },

  save(username, profil) {
    return request(`/api/profiles/${encodeURIComponent(username)}`, {
      method: 'PUT',
      body: JSON.stringify(profil)
    });
  }
};
