const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function withRetry(operation, retries = 10, delay = 5000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === retries - 1) throw error;
      console.log(`  Database connection failed, retrying in ${delay / 1000}s... (Attempt ${i + 1}/${retries})`);
      await sleep(delay);
    }
  }
}

async function main() {
  const sourceCourseId = 1;
  const targetCourseId = 19;

  const chapterMapping = {
    8: 136,
    10: 138,
    11: 139,
    12: 140,
    13: 141,
    14: 142,
    15: 143,
    16: 144
  };

  console.log(`Migrating content from Course ${sourceCourseId} to Course ${targetCourseId}...`);

  for (const [sourceIdStr, targetId] of Object.entries(chapterMapping)) {
    const sourceId = parseInt(sourceIdStr);
    console.log(`\nMigrating Chapter ${sourceId} -> ${targetId}...`);

    const sourceChapter = await withRetry(async () => {
      return await prisma.chapter.findUnique({
        where: { id: sourceId },
        include: {
          materials: true,
          assessments: {
            include: { questions: true }
          },
          assignments: true
        }
      });
    });

    if (!sourceChapter) {
      console.log(`  Source chapter ${sourceId} not found, skipping.`);
      continue;
    }

    // 1. Update Target Chapter Details
    await withRetry(async () => {
      await prisma.chapter.update({
        where: { id: targetId },
        data: {
          name: sourceChapter.name,
          description: sourceChapter.description
        }
      });
    });
    console.log(`  Updated target chapter name and description.`);

    // 2. Migrate Materials
    // Delete existing materials in target chapter to avoid duplicates
    await withRetry(async () => {
      await prisma.material.deleteMany({ where: { chapterId: targetId } });
    });
    
    for (const material of sourceChapter.materials) {
      await withRetry(async () => {
        await prisma.material.create({
          data: {
            chapterId: targetId,
            name: material.name,
            content: material.content,
            createdAt: material.createdAt,
            updatedAt: material.updatedAt
          }
        });
      });
    }
    console.log(`  Migrated ${sourceChapter.materials.length} materials.`);

    // 3. Migrate Assessments & Questions
    // Delete existing assessments (and cascaded questions) in target chapter
    await withRetry(async () => {
      await prisma.assessment.deleteMany({ where: { chapterId: targetId } });
    });

    for (const assessment of sourceChapter.assessments) {
      const newAssessment = await withRetry(async () => {
        return await prisma.assessment.create({
          data: {
            chapterId: targetId,
            instruction: assessment.instruction,
            createdAt: assessment.createdAt,
            updatedAt: assessment.updatedAt
          }
        });
      });

      // Create questions for the new assessment
      if (assessment.questions.length > 0) {
        const questionsData = assessment.questions.map(q => ({
          assessmentId: newAssessment.id,
          question: q.question,
          type: q.type,
          options: q.options,
          answer: q.answer,
          createdAt: q.createdAt,
          updatedAt: q.updatedAt
        }));
        
        await withRetry(async () => {
          await prisma.question.createMany({
            data: questionsData
          });
        });
      }
      console.log(`  Migrated 1 assessment with ${assessment.questions.length} questions.`);
    }

    // 4. Migrate Assignments
    // Delete existing assignments in target chapter
    await withRetry(async () => {
      await prisma.assignment.deleteMany({ where: { chapterId: targetId } });
    });

    for (const assignment of sourceChapter.assignments) {
      await withRetry(async () => {
        await prisma.assignment.create({
          data: {
            chapterId: targetId,
            instruction: assignment.instruction,
            fileUrl: assignment.fileUrl,
            createdAt: assignment.createdAt,
            updatedAt: assignment.updatedAt
          }
        });
      });
    }
    console.log(`  Migrated ${sourceChapter.assignments.length} assignments.`);
  }

  console.log('\nMigration complete.');
}

main()
  .catch(e => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
