const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAssessment138() {
  try {
    const assessment = await prisma.assessment.findFirst({
      where: { chapterId: 138 },
      include: { questions: true }
    });
    console.log("ASSESSMENT FOR CHAPTER 10 (ID 138):");
    console.log(JSON.stringify(assessment, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

checkAssessment138();
