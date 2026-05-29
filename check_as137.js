const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAssessment137() {
  try {
    const assessment = await prisma.assessment.findFirst({
      where: { chapterId: 137 },
      include: { questions: true }
    });
    console.log("ASSESSMENT FOR CHAPTER 9 (ID 137):");
    console.log(JSON.stringify(assessment, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

checkAssessment137();
