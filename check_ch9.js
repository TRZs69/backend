const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkChapter9() {
  try {
    const chapter = await prisma.chapter.findFirst({
      where: { level: 9, courseId: 1 },
      include: { materials: true, assessments: { include: { questions: true } } }
    });
    console.log("CHAPTER 9 INFO:");
    console.log(JSON.stringify(chapter, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

checkChapter9();
