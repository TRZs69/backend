const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixChapter12Assessment() {
  const chapterId = 140; 
  try {
    const assessment = await prisma.assessment.findFirst({
      where: { chapterId }
    });

    if (!assessment) {
      console.log("No assessment found for chapter 140");
      return;
    }

    console.log(`Found assessment ID ${assessment.id} for Chapter 12. Cleaning up questions...`);

    
    const deleteCount = await prisma.question.deleteMany({
      where: { assessmentId: assessment.id }
    });
    console.log(`Deleted ${deleteCount.count} old questions (Emotional Design).`);

    
    await prisma.assessment.update({
      where: { id: assessment.id },
      data: {
        instruction: "Kerjakan kuis tentang GenderMag dan Inklusivitas Desain dengan teliti."
      }
    });
    console.log("Updated assessment instruction.");

    
    const attemptCount = await prisma.assessmentAttempt.deleteMany({
      where: { chapterId }
    });
    console.log(`Deleted ${attemptCount.count} old assessment attempts.`);

    console.log("Cleanup complete. Correct GenderMag questions will be generated on next attempt.");

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

fixChapter12Assessment();
