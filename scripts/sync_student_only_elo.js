const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = require('../src/prismaClient');

async function main() {
  const nonStudentUsers = await prisma.user.findMany({
    where: { role: { not: 'STUDENT' } },
    select: { id: true },
  });

  const nonStudentIds = nonStudentUsers.map((user) => user.id);

  const [nonStudentPointsReset, studentPointsInitialized, nonStudentChapterDeltaReset] = await prisma.$transaction([
    prisma.user.updateMany({
      where: { role: { not: 'STUDENT' } },
      data: { points: null },
    }),
    prisma.user.updateMany({
      where: {
        role: 'STUDENT',
        OR: [{ points: null }],
      },
      data: { points: 750 },
    }),
    nonStudentIds.length > 0
      ? prisma.userChapter.updateMany({
          where: { userId: { in: nonStudentIds } },
          data: { assessmentEloDelta: 0 },
        })
      : prisma.userChapter.updateMany({
          where: { id: -1 },
          data: { assessmentEloDelta: 0 },
        }),
  ]);

  console.log('Student-only ELO sync completed.');
  console.log(`- Non-student users points reset: ${nonStudentPointsReset.count}`);
  console.log(`- Student users initialized to 750: ${studentPointsInitialized.count}`);
  console.log(`- Non-student user_chapters ELO delta reset: ${nonStudentChapterDeltaReset.count}`);
}

main()
  .catch((error) => {
    console.error('Failed to sync student-only ELO:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
