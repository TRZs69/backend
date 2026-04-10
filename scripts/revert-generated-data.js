const prisma = require('../src/prismaClient');
const evaluationService = require('../src/services/EvaluationService');
const supabase = require('../supabase/supabase.js');

// Students whose data was just generated and needs to be reverted
const STUDENTS_TO_REVERT = [
    'Christo Sadatua Manatap Pasaribu',
    'Andre Christian Saragih',
    'Alberton Napitupulu',
    'Porman Marsaulina Simanjuntak',
    'Stacia Andani Siallagan',
    'Grace Sania Silalahi',
    'Grace Alvani',
];

// Date windows
const WINDOW_1_START = new Date('2026-03-26T00:00:00.000Z');
const WINDOW_1_END = new Date('2026-03-29T23:59:59.999Z');
const WINDOW_2_START = new Date('2026-04-08T00:00:00.000Z');
const WINDOW_2_END = new Date('2026-04-09T23:59:59.999Z');

async function revertGeneratedData() {
    console.log('[Revert] Starting to revert generated data...');

    try {
        const students = await prisma.user.findMany({
            where: {
                role: 'STUDENT',
                name: { in: STUDENTS_TO_REVERT },
            },
            select: { id: true, name: true },
        });

        console.log(`[Revert] Found ${students.length} students to revert`);

        for (const student of students) {
            try {
                console.log(`[Revert] Reverting: ${student.name}`);

                // Delete assessments in the period
                const deletedAssessments = await prisma.assessmentAttempt.deleteMany({
                    where: {
                        userId: student.id,
                        status: 'SUBMITTED',
                        submittedAt: { gte: WINDOW_1_START, lte: WINDOW_2_END },
                    },
                });
                console.log(`  ✓ Deleted ${deletedAssessments.count} assessments`);

                // Delete sessions in the period
                const deletedSessions = await prisma.userSession.deleteMany({
                    where: {
                        userId: student.id,
                        OR: [
                            { loginAt: { gte: WINDOW_1_START, lte: WINDOW_1_END } },
                            { loginAt: { gte: WINDOW_2_START, lte: WINDOW_2_END } },
                        ],
                    },
                });
                console.log(`  ✓ Deleted ${deletedSessions.count} sessions`);

                // Sync empty summary to Supabase
                const { start, end } = evaluationService.toDateRange();
                const summary = await evaluationService.computeSummary(student.id, start, end);
                const payload = evaluationService.toSummaryPayload(student.id, summary);

                const { error } = await supabase
                    .from('student_summaries')
                    .upsert(payload, { onConflict: 'user_id' });

                if (error) {
                    console.error(`[Revert] Error syncing ${student.name}:`, error.message);
                } else {
                    console.log(`[Revert] ✓ Synced empty summary to Supabase: ${student.name}`);
                }
            } catch (err) {
                console.error(`[Revert] Failed for ${student.name}:`, err.message);
            }
        }

        console.log('[Revert] All data reverted successfully!');
    } catch (err) {
        console.error('[Revert] Fatal error:', err.message);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

revertGeneratedData();
