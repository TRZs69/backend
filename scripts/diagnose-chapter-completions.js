const prisma = require('../src/prismaClient');

async function diagnoseChapterCompletions() {
    console.log('[Diagnose] Starting chapter completion diagnosis...\n');

    try {
        // Find chapter 8
        const chapter8 = await prisma.chapter.findFirst({
            where: { level: 8 },
            select: { id: true, name: true, level: true },
        });

        if (!chapter8) {
            console.error('[Diagnose] Chapter 8 not found!');
            return;
        }

        console.log(`Chapter 8: ${chapter8.name} (ID: ${chapter8.id}, Level: ${chapter8.level})\n`);

        // Get all students who completed questionnaire
        const questionnaireUsers = await prisma.evaluationQuestionnaire.findMany({
            select: { userId: true },
        });

        console.log(`Found ${questionnaireUsers.length} students who submitted questionnaire\n`);

        // Get all chapters
        const allChapters = await prisma.chapter.findMany({
            orderBy: { level: 'asc' },
            select: { id: true, name: true, level: true },
        });

        console.log(`Total chapters: ${allChapters.length}\n`);

        for (const qUser of questionnaireUsers) {
            const userId = qUser.userId;

            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { name: true, studentId: true },
            });

            if (!user) continue;

            console.log(`\n${'='.repeat(80)}`);
            console.log(`Student: ${user.name} (ID: ${userId})`);
            console.log(`${'='.repeat(80)}`);

            // Get all user chapter completions
            const userChapters = await prisma.userChapter.findMany({
                where: { userId },
                include: { chapter: { select: { name: true, level: true } } },
                orderBy: { chapter: { level: 'asc' } },
            });

            console.log(`\n  Total chapter records: ${userChapters.length}`);
            console.log(`  Completed chapters: ${userChapters.filter(c => c.isCompleted).length}`);

            console.log(`\n  Chapter Progress:`);
            for (const uc of userChapters) {
                const completed = uc.isCompleted ? '✅' : '❌';
                const material = uc.materialDone ? '✅' : '❌';
                const assessment = uc.assessmentDone ? '✅' : '❌';
                const assignment = uc.assignmentDone ? '✅' : '❌';
                
                console.log(`    Ch ${uc.chapter.level} (${uc.chapter.name}): ${completed} (M:${material} A:${assessment} Asgn:${assignment})`);
            }

            // Check chapter 8 specifically
            const chapter8Record = userChapters.find(uc => uc.chapterId === chapter8.id);
            
            if (chapter8Record) {
                console.log(`\n  Chapter 8 Status:`);
                console.log(`    isCompleted: ${chapter8Record.isCompleted}`);
                console.log(`    assessmentDone: ${chapter8Record.assessmentDone}`);
                console.log(`    assessmentGrade: ${chapter8Record.assessmentGrade}`);
                console.log(`    assessmentEloDelta: ${chapter8Record.assessmentEloDelta}`);
                console.log(`    assessmentPointsEarned: ${chapter8Record.assessmentPointsEarned}`);
                console.log(`    timeFinished: ${chapter8Record.timeFinished}`);
            } else {
                console.log(`\n  ⚠️  Chapter 8 record NOT FOUND for this student!`);
            }

            // Get assessments for this student
            const assessments = await prisma.assessmentAttempt.findMany({
                where: { userId, status: 'SUBMITTED' },
                select: { chapterId: true, grade: true, pointsEarned: true, submittedAt: true },
                orderBy: { submittedAt: 'asc' },
            });

            console.log(`\n  Assessments: ${assessments.length}`);
            if (assessments.length > 0) {
                assessments.slice(0, 5).forEach(a => {
                    console.log(`    - Ch ${a.chapterId}: grade=${a.grade}, points=${a.pointsEarned}, date=${a.submittedAt.toISOString().split('T')[0]}`);
                });
                if (assessments.length > 5) {
                    console.log(`    ... and ${assessments.length - 5} more`);
                }
            }
        }
    } catch (err) {
        console.error('[Diagnose] Error:', err.message);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

diagnoseChapterCompletions();
