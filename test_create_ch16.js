const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();
async function run() {
  const content = fs.readFileSync('chapter_16_material.html', 'utf8');
  try {
    const res = await prisma.material.create({
      data: {
        chapterId: 144,
        name: 'Materi UAS',
        content: content
      }
    });
    console.log("Success:", res);
  } catch (err) {
    console.error("Error:", err);
  }
  process.exit(0);
}
run();
