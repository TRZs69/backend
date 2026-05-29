const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const assignments = [
    { chapterId: 137, instruction: 'Buatlah sketsa paper prototype sederhana untuk halaman login atau profil pada sebuah aplikasi mobile.', fileUrl: '' },
    { chapterId: 138, instruction: 'Identifikasi dan jelaskan elemen yang memberikan rasa senang atau kepuasan saat Anda menggunakan aplikasi favorit Anda.', fileUrl: '' },
    { chapterId: 139, instruction: 'Temukan satu contoh affordance yang baik pada sebuah aplikasi dan jelaskan bagaimana elemen tersebut membantu Anda memahaminya.', fileUrl: '' },
    { chapterId: 140, instruction: 'Lakukan tinjauan singkat pada sebuah formulir pendaftaran dan evaluasi kemudahannya bagi pengguna yang kurang mahir teknologi.', fileUrl: '' },
    { chapterId: 141, instruction: 'Buatlah daftar berisi tiga perintah suara yang dapat membantu mempermudah navigasi pada sebuah aplikasi belanja online.', fileUrl: '' },
    { chapterId: 142, instruction: 'Deskripsikan satu fitur berbasis AI pada aplikasi yang Anda gunakan dan jelaskan bagaimana fitur tersebut meningkatkan pengalaman Anda.', fileUrl: '' },
    { chapterId: 143, instruction: 'Buatlah satu profil User Persona sederhana yang menggambarkan kebutuhan dan masalah utama pengguna untuk aplikasi manajemen tugas mahasiswa.', fileUrl: '' }
  ];
  for (const a of assignments) {
    try {
      const res = await prisma.assignment.create({ data: a });
      console.log(`Success Chapter ${a.chapterId}:`, res.id);
    } catch (err) {
      console.error(`Error Chapter ${a.chapterId}:`, err.message);
    }
  }
  process.exit(0);
}
run();
