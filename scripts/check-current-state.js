const prisma = require('../src/prismaClient');

async function checkCurrentState() {
    console.log('[Check] Checking current chapter completion state...\n');

    try {
        const students = await prisma.user.findMany({
            where: { role: 'STUDENT' },
            select: { id: true, name: true },
        });

        const chapter8 = await prisma.chapter.findFirst({
            where: { level: 8 },
            select: { id: true, name: true },
        });

        console.log(`Total students: ${students.length}`);
        console.log(`Chapter 8 ID: ${chapter8.id}\n`);

        for (const student of students) {
            const userChapter = await prisma.userChapter.findFirst({
                where: {
                    userId: student.id,
                    chapterId: chapter8.id,
                },
            });

            const questionnaire = await prisma.evaluationQuestionnaire.findFirst({
                where: { userId: student.id },
            });

            if (userChapter) {
                const status = userChapter.isCompleted ? '✅' : '❌';
                const assessStatus = userChapter.assessmentDone ? '✅' : '❌';
                const hasQuestionnaire = questionnaire ? '✅' : '❌';
                
                if (userChapter.assessmentDone && userChapter.assessmentGrade > 0 && !userChapter.isCompleted) {
                    console.log(`${student.name}: Chapter8 [${status}] Assessment[${assessStatus}] Grade[${userChapter.assessmentGrade}] Questionnaire[${hasQuestionnaire}] ⚠️ BROKEN`);
                } else if (userChapter.assessmentDone && userChapter.assessmentGrade > 0) {
                    console.log(`${student.name}: Chapter8 [${status}] Assessment[${assessStatus}] Grade[${userChapter.assessmentGrade}] Questionnaire[${hasQuestionnaire}] ✓ OK`);
                }
            }
        }
    } catch (err) {
        console.error('[Check] Error:', err.message);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

checkCurrentState();
