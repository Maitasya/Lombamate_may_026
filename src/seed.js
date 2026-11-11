/* =========================================================
   LombaMate - src/seed.js
   Mengisi database Neon dengan data dari folder src/data/*.json
   Cara pakai:  npm run seed
   ========================================================= */
'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const baca = (nama) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'data', nama), 'utf-8'));
  } catch {
    return [];
  }
};

async function main() {
  const users = baca('users.json');
  const partners = baca('partners.json');
  const joins = baca('joins.json');
  const profiles = baca('profiles.json');

  // --- Akun (hash bcrypt dipindahkan APA ADANYA - password tidak di-reset) ---
  // Email demo memakai placeholder karena akun lama tidak menyimpan email.
  for (const u of users) {
    const email = `${String(u.username).toLowerCase()}@lombamate.local`;
    await prisma.user.upsert({
      where: { username: String(u.username).toLowerCase() },
      update: {
        name: u.name || u.username,
        passwordHash: u.passwordHash
      },
      create: {
        username: String(u.username).toLowerCase(),
        email,
        name: u.name || u.username,
        passwordHash: u.passwordHash
      }
    });
  }
  console.log(`Akun (User): ${users.length} baris dipindah ke Neon (hash bcrypt tetap).`);

  // --- Profil ---
  for (const p of profiles) {
    await prisma.profile.upsert({
      where: { username: String(p.username).toLowerCase() },
      update: {
        name: p.name || '',
        campus: p.campus || '',
        major: p.major || '',
        contact: p.contact || '',
        bio: p.bio || '',
        photo: p.photo || '',
        looking: p.looking !== false,
        interests: p.interests || [],
        skills: p.skills || [],
        history: p.history || []
      },
      create: {
        username: String(p.username).toLowerCase(),
        name: p.name || '',
        campus: p.campus || '',
        major: p.major || '',
        contact: p.contact || '',
        bio: p.bio || '',
        photo: p.photo || '',
        looking: p.looking !== false,
        interests: p.interests || [],
        skills: p.skills || [],
        history: p.history || []
      }
    });
  }
  console.log(`Profil: ${profiles.length} baris disalin ke Neon.`);

  // --- Partner ---
  for (const p of partners) {
    await prisma.partner.upsert({
      where: { id: Number(p.id) },
      update: {
        category: p.category,
        competition: p.competition || '',
        organizer: p.organizer || '',
        level: p.level || '',
        deadline: p.deadline || '',
        link: p.link || '',
        teamSize: p.teamSize || '',
        slots: (p.slots === null || p.slots === undefined || p.slots === '') ? null : Number(p.slots),
        roles: Array.isArray(p.roles) ? p.roles : [],
        scope: p.scope || '',
        description: p.description || '',
        contactType: p.contactType || 'WhatsApp',
        contact: p.contact || '',
        ownerName: p.ownerName || '',
        ownerCampus: p.ownerCampus || '',
        ownerUsername: p.ownerUsername,
        ownerPhoto: p.ownerPhoto || ''
      },
      create: {
        id: Number(p.id),
        category: p.category,
        competition: p.competition || '',
        organizer: p.organizer || '',
        level: p.level || '',
        deadline: p.deadline || '',
        link: p.link || '',
        teamSize: p.teamSize || '',
        slots: (p.slots === null || p.slots === undefined || p.slots === '') ? null : Number(p.slots),
        roles: Array.isArray(p.roles) ? p.roles : [],
        scope: p.scope || '',
        description: p.description || '',
        contactType: p.contactType || 'WhatsApp',
        contact: p.contact || '',
        ownerName: p.ownerName || '',
        ownerCampus: p.ownerCampus || '',
        ownerUsername: p.ownerUsername,
        ownerPhoto: p.ownerPhoto || ''
      }
    });
  }
  console.log(`Partner: ${partners.length} baris disalin ke Neon.`);

  // --- Join (hapus semua dulu supaya id menerus data lama) ---
  await prisma.join.deleteMany({});
  for (const j of joins) {
    await prisma.join.create({
      data: {
        id: Number(j.id),
        partnerId: Number(j.partnerId),
        username: j.username,
        name: j.name,
        status: j.status || 'menunggu',
        createdAt: j.createdAt ? new Date(j.createdAt) : new Date()
      }
    });
  }
  console.log(`Join: ${joins.length} baris disalin ke Neon.`);

  // --- Rapikan sequence autoincrement agar tidak bentrok dengan id lama ---
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"Partner"', 'id'), (SELECT COALESCE(MAX(id),0) FROM "Partner") + 1, false)`
  );
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"Join"', 'id'), (SELECT COALESCE(MAX(id),0) FROM "Join") + 1, false)`
  );
  console.log('Sequence autoincrement dirapikan.');
}

main()
  .then(() => console.log('Seed selesai ✅'))
  .catch((e) => {
    console.error('Seed gagal:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
