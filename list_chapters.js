const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listChapters() {
  try {
    const chapters = await prisma.chapter.findMany({
      select: { id: true, name: true, level: true, courseId: true }
    });
    console.log(JSON.stringify(chapters, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

listChapters();
