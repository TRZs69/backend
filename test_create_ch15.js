const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();
async function run() {
  const content = fs.readFileSync('chapter_15_material.html', 'utf8');
  try {
    const res = await prisma.material.create({
      data: {
        chapterId: 143,
        name: 'Materi Chapter 15',
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
