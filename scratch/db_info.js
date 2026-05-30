process.env.DB_CONNECTION_LIMIT = '10';
process.env.DB_POOL_TIMEOUT = '10';
require('dotenv').config();
const prisma = require('../src/prismaClient');

async function main() {
    try {
        const usersCount = await prisma.user.count();
        const chaptersCount = await prisma.chapter.count();
        const coursesCount = await prisma.course.count();
        const userChaptersCount = await prisma.userChapter.count();

        console.log({
            usersCount,
            chaptersCount,
            coursesCount,
            userChaptersCount
        });

        const firstStudent = await prisma.user.findFirst({ where: { role: 'STUDENT' } });
        if (firstStudent) {
            console.log('First student:', firstStudent);
            const totalAvailableChapters = await prisma.chapter.count({
                where: {
                    course: {
                        enrollments: {
                            some: { userId: firstStudent.id },
                        },
                    },
                },
            });
            console.log('totalAvailableChapters by enrollment:', totalAvailableChapters);
            const fallbackCount = await prisma.userChapter.count({
                where: { userId: firstStudent.id },
            });
            console.log('fallbackCount:', fallbackCount);

            // Get a list of user chapters for this user
            const ucs = await prisma.userChapter.findMany({
                where: { userId: firstStudent.id },
                include: { chapter: true }
            });
            console.log(`User Chapters for user ${firstStudent.id}:`, ucs.map(uc => ({
                id: uc.id,
                chapterId: uc.chapterId,
                chapterLevel: uc.chapter.level,
                isCompleted: uc.isCompleted,
                materialDone: uc.materialDone,
                assessmentDone: uc.assessmentDone,
                assignmentDone: uc.assignmentDone
            })));
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
