const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  await prisma.chapter.update({
    where: { id: 143 },
    data: { description: 'Pendekatan Design Thinking sebagai metode inovasi berorientasi manusia untuk merancang solusi interaktif yang kreatif, mulai dari tahap empati hingga pengukuran dampak nyata pada pengguna.' }
  });
  await prisma.chapter.update({
    where: { id: 144 },
    data: { name: 'UAS', description: 'Ujian Akhir Semester' }
  });
  console.log("Updated chapter descriptions.");
  process.exit(0);
}
run();
