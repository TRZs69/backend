const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixChapter9Assessment() {
  const chapterId = 137;
  try {
    const assessment = await prisma.assessment.findFirst({
      where: { chapterId }
    });

    if (!assessment) {
      console.log("No assessment found for chapter 137");
      return;
    }

    console.log(`Found assessment ID ${assessment.id}. Cleaning up questions...`);

    
    const deleteCount = await prisma.question.deleteMany({
      where: { assessmentId: assessment.id }
    });
    console.log(`Deleted ${deleteCount.count} old questions.`);

    
    await prisma.assessment.update({
      where: { id: assessment.id },
      data: {
        instruction: "Kerjakan assessment adaptif bab \"Prototyping\" dengan fokus. Kamu akan mengerjakan 6 soal (5 objektif + 1 essay)."
      }
    });
    console.log("Updated assessment instruction.");

    
    
    const attemptCount = await prisma.assessmentAttempt.deleteMany({
      where: { chapterId }
    });
    console.log(`Deleted ${attemptCount.count} old assessment attempts.`);

    console.log("Cleanup complete. The next attempt will trigger correct LLM generation.");

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

fixChapter9Assessment();
