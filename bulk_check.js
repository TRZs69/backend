const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const chapterIds = [138, 139, 140, 141, 142, 144];

async function bulkCheck() {
  for (const id of chapterIds) {
    try {
      const chapter = await prisma.chapter.findUnique({
        where: { id },
        include: { 
          materials: { take: 1 },
          assessments: { include: { questions: { take: 3 } } } 
        }
      });
      
      console.log(`\n--- CHAPTER ${chapter.level} (ID ${id}): ${chapter.name} ---`);
      if (chapter.assessments.length === 0) {
        console.log("ASSESSMENT: [EMPTY]");
      } else {
        const assessment = chapter.assessments[0];
        console.log(`Instruction: ${assessment.instruction}`);
        console.log(`Questions Count: ${assessment.questions.length} (showing first 3)`);
        assessment.questions.forEach((q, i) => {
          console.log(`  ${i+1}. ${q.question} (${q.type})`);
        });
      }
    } catch (err) {
      console.error(`Error checking chapter ${id}:`, err.message);
    }
  }
  await prisma.$disconnect();
}

bulkCheck();
