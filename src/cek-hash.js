/* Uji sekali-pakai: bukti password tidak tersimpan plaintext (HAPUS setelah laporan) */
'use strict';
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const p = new PrismaClient();

(async () => {
  const users = await p.user.findMany({ select: { username: true, email: true, passwordHash: true } });
  console.log('Jumlah akun di tabel User:', users.length);
  for (const u of users) {
    const hash = u.passwordHash || '';
    const bentukHash = /^\$2[aby]\$10\$[./A-Za-z0-9]{53}$/.test(hash); // format bcrypt standar
    const miripPlaintext = !hash.startsWith('$2') && hash.length >= 8;
    console.log(`- ${u.username} | email: ${u.email} | hash: ${hash.slice(0, 12)}... | format-bcrypt: ${bentukHash ? 'YA' : 'BUKAN'} | plaintext? ${miripPlaintext ? 'YA (BAHAYA)' : 'tidak'}`);
  }
  const maya = users.find((u) => u.username === 'maya_putri');
  console.log('\nUji bcrypt maya_putri:');
  console.log('  cocok dgn "mayamantap123" (password asli)  :', bcrypt.compareSync('mayamantap123', maya.passwordHash));
  console.log('  cocok dgn "password-asli123" (tebakan)     :', bcrypt.compareSync('password-asli123', maya.passwordHash));
  await p.$disconnect();
})();
