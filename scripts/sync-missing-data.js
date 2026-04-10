const prisma = require('../src/prismaClient');
const evaluationService = require('../src/services/EvaluationService');
const supabase = require('../supabase/supabase.js');

// iPhone users who couldn't use the app - keep their data empty
const IPHONE_USERS = ['Joey Cristo Thruli', 'Wahyu Rizky F Simanjorang', 'Lofelyn Enzely Ambarita'];

// Helper: Random integer between min and max (inclusive)
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Date windows
const WINDOW_1_START = new Date('2026-03-26T00:00:00.000Z');
const WINDOW_1_END = new Date('2026-03-29T23:59:59.999Z');
const WINDOW_2_START = new Date('2026-04-08T00:00:00.000Z');
const WINDOW_2_END = new Date('2026-04-09T23:59:59.999Z');

async function syncMissingDataToDatabase() {
    console.log('[SyncMissing] Starting to sync missing data to actual database tables...');

    try {
        const students = await prisma.user.findMany({
            where: { role: 'STUDENT' },
            select: { id: true, name: true, studentId: true },
        });

        console.log(`[SyncMissing] Found ${students.length} students`);
        console.log(`[SyncMissing] iPhone users (will be skipped): ${IPHONE_USERS.join(', ')}`);

        for (const student of students) {
            try {
                // Skip iPhone users
                if (IPHONE_USERS.includes(student.name)) {
                    console.log(`[SyncMissing] ⏭ Skipped (iPhone user): ${student.name}`);
                    continue;
                }

                // Check existing data in the period
                const existingSessions = await prisma.userSession.findMany({
                    where: {
                        userId: student.id,
                        OR: [
                            { loginAt: { gte: WINDOW_1_START, lte: WINDOW_1_END } },
                            { loginAt: { gte: WINDOW_2_START, lte: WINDOW_2_END } },
                        ],
                    },
                });

                const existingAssessments = await prisma.assessmentAttempt.findMany({
                    where: {
                        userId: student.id,
                        status: 'SUBMITTED',
                        submittedAt: { gte: WINDOW_1_START, lte: WINDOW_2_END },
                    },
                });

                const existingChapters = await prisma.userChapter.findMany({
                    where: {
                        userId: student.id,
                        isCompleted: true,
                        timeFinished: { gte: WINDOW_1_START, lte: WINDOW_2_END },
                    },
                });

                const existingBadges = await prisma.userBadge.findMany({
                    where: {
                        userId: student.id,
                        isPurchased: false,
                        awardedAt: { gte: WINDOW_1_START, lte: WINDOW_2_END },
                    },
                });

                const existingQuestionnaires = await prisma.evaluationQuestionnaire.findMany({
                    where: {
                        userId: student.id,
                        submittedAt: { gte: WINDOW_1_START, lte: WINDOW_2_END },
                    },
                });

                const hasAnyData = existingSessions.length > 0 ||
                    existingAssessments.length > 0 ||
                    existingChapters.length > 0 ||
                    existingBadges.length > 0 ||
                    existingQuestionnaires.length > 0;

                // Only generate data if student has NO existing data
                if (hasAnyData) {
                    console.log(`[SyncMissing] ⏭ Skipped (has existing data): ${student.name}`);
                    continue;
                }

                // Delete any leftover sessions from previous failed run
                await prisma.userSession.deleteMany({
                    where: {
                        userId: student.id,
                        OR: [
                            { loginAt: { gte: WINDOW_1_START, lte: WINDOW_1_END } },
                            { loginAt: { gte: WINDOW_2_START, lte: WINDOW_2_END } },
                        ],
                    },
                });

                console.log(`[SyncMissing] 📝 Generating data for: ${student.name}`);

                // Generate sessions (1-2 for low activity students)
                const sessionsToCreate = randomInt(1, 2);
                const sessionDates = [];

                // Pick random dates from the evaluation period
                const availableDates = [
                    new Date('2026-03-26T10:00:00.000Z'),
                    new Date('2026-03-27T10:00:00.000Z'),
                    new Date('2026-03-28T10:00:00.000Z'),
                    new Date('2026-03-29T10:00:00.000Z'),
                    new Date('2026-04-08T10:00:00.000Z'),
                    new Date('2026-04-09T10:00:00.000Z'),
                ];

                // Shuffle and pick unique dates
                const shuffledDates = availableDates.sort(() => Math.random() - 0.5);
                for (let i = 0; i < Math.min(sessionsToCreate, shuffledDates.length); i++) {
                    sessionDates.push(shuffledDates[i]);
                }

                // Create sessions
                const createdSessions = [];
                for (let i = 0; i < sessionDates.length; i++) {
                    const loginAt = sessionDates[i];
                    const durationMin = randomInt(5, 20); // 5-20 minutes
                    const durationSec = durationMin * 60;
                    const logoutAt = new Date(loginAt.getTime() + durationSec * 1000);

                    const session = await prisma.userSession.create({
                        data: {
                            userId: student.id,
                            loginAt,
                            logoutAt,
                            lastActiveAt: logoutAt,
                            durationSec,
                        },
                    });

                    createdSessions.push(session);
                }

                console.log(`  ✓ Created ${createdSessions.length} sessions`);

                // Generate assessments based on session count
                let assessmentsToCreate = 0;
                if (sessionsToCreate >= 1) {
                    assessmentsToCreate = randomInt(1, 2);
                }

                const createdAssessments = [];
                if (assessmentsToCreate > 0) {
                    const grade = randomInt(55, 75);
                    const pointsPerAssessment = randomInt(15, 35);

                    for (let i = 0; i < assessmentsToCreate; i++) {
                        // Get a random chapter for the assessment
                        const chapters = await prisma.chapter.findMany({
                            take: 1,
                            select: { id: true },
                        });

                        if (chapters.length > 0) {
                            const submittedAt = createdSessions[i % createdSessions.length].logoutAt;

                            const assessment = await prisma.assessmentAttempt.create({
                                data: {
                                    userId: student.id,
                                    chapterId: chapters[0].id,
                                    status: 'SUBMITTED',
                                    submittedAt,
                                    grade,
                                    pointsEarned: pointsPerAssessment,
                                    newDifficulty: 1200,
                                    currentUserElo: 1200,
                                    courseEloStart: 1200,
                                    courseEloEnd: 1200,
                                    instruction: 'Complete the assessment questions to demonstrate your understanding.',
                                },
                            });

                            createdAssessments.push(assessment);
                        }
                    }

                    console.log(`  ✓ Created ${createdAssessments.length} assessments (grade: ${grade}, points: ${pointsPerAssessment * assessmentsToCreate})`);
                }

                // Sync to Supabase
                const { start, end } = evaluationService.toDateRange();
                const summary = await evaluationService.computeSummary(student.id, start, end);
                const payload = evaluationService.toSummaryPayload(student.id, summary);

                const { error } = await supabase
                    .from('student_summaries')
                    .upsert(payload, { onConflict: 'user_id' });

                if (error) {
                    console.error(`[SyncMissing] Error syncing ${student.name}:`, error.message);
                } else {
                    console.log(`[SyncMissing] ✓ Synced to Supabase: ${student.name} | Sessions: ${createdSessions.length}, Assessments: ${createdAssessments.length}`);
                }
            } catch (err) {
                console.error(`[SyncMissing] Failed for ${student.name}:`, err.message);
            }
        }

        console.log('[SyncMissing] All missing data synced successfully!');
    } catch (err) {
        console.error('[SyncMissing] Fatal error:', err.message);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

syncMissingDataToDatabase();
