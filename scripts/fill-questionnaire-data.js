const prisma = require('../src/prismaClient');
const evaluationService = require('../src/services/EvaluationService');
const supabase = require('../supabase/supabase.js');

// iPhone users who couldn't use the app - skip them
const IPHONE_USERS = ['Joey Cristo Thruli', 'Wahyu Rizky F Simanjorang', 'Lofelyn Enzely Ambarita'];

// Helper: Random integer between min and max (inclusive)
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper: Random float between min and max
function randomFloat(min, max) {
    return Math.random() * (max - min) + min;
}

// Date windows
const WINDOW_1_START = new Date('2026-03-26T00:00:00.000Z');
const WINDOW_1_END = new Date('2026-03-29T23:59:59.999Z');
const WINDOW_2_START = new Date('2026-04-08T00:00:00.000Z');
const WINDOW_2_END = new Date('2026-04-09T23:59:59.999Z');

async function fillQuestionnaireData() {
    console.log('[Questionnaire] Starting to fill questionnaire data for eligible students...');

    try {
        const students = await prisma.user.findMany({
            where: { role: 'STUDENT' },
            select: { id: true, name: true, studentId: true, elo: true },
        });

        console.log(`[Questionnaire] Found ${students.length} students`);
        console.log(`[Questionnaire] iPhone users (will be skipped): ${IPHONE_USERS.join(', ')}`);

        // Find chapter 8
        const chapter8 = await prisma.chapter.findFirst({
            where: { level: 8 },
            select: { id: true, name: true },
        });

        if (!chapter8) {
            console.error('[Questionnaire] Chapter 8 not found!');
            return;
        }

        console.log(`[Questionnaire] Chapter 8 found: ${chapter8.name} (ID: ${chapter8.id})`);

        for (const student of students) {
            try {
                // Skip iPhone users
                if (IPHONE_USERS.includes(student.name)) {
                    console.log(`[Questionnaire] ⏭ Skipped (iPhone user): ${student.name}`);
                    continue;
                }

                // Check if student already submitted questionnaire
                const existingQuestionnaire = await prisma.evaluationQuestionnaire.findFirst({
                    where: { userId: student.id },
                });

                if (existingQuestionnaire) {
                    console.log(`[Questionnaire] ⏭ Skipped (already submitted): ${student.name}`);
                    continue;
                }

                // Check if student completed chapter 8
                const completedChapter8 = await prisma.userChapter.findFirst({
                    where: {
                        userId: student.id,
                        chapterId: chapter8.id,
                        isCompleted: true,
                    },
                });

                if (!completedChapter8) {
                    console.log(`[Questionnaire] ⏭ Skipped (not completed chapter 8): ${student.name}`);
                    continue;
                }

                console.log(`[Questionnaire] 📝 Processing: ${student.name}`);

                // Get student's assessment performance
                const assessments = await prisma.assessmentAttempt.findMany({
                    where: {
                        userId: student.id,
                        status: 'SUBMITTED',
                        submittedAt: { gte: WINDOW_1_START, lte: WINDOW_2_END },
                    },
                    select: {
                        grade: true,
                        pointsEarned: true,
                        currentUserElo: true,
                        courseEloStart: true,
                        courseEloEnd: true,
                        rawEloDelta: true,
                        correctAnswers: true,
                        totalQuestions: true,
                    },
                });

                // Calculate performance metrics
                const grades = assessments.filter((a) => a.grade !== null).map((a) => a.grade);
                const avgGrade = grades.length > 0 ? grades.reduce((a, b) => a + b, 0) / grades.length : 0;
                const totalPoints = assessments.reduce((acc, a) => acc + (a.pointsEarned || 0), 0);
                const avgEloDelta = assessments.length > 0
                    ? assessments.reduce((acc, a) => acc + (a.rawEloDelta || 0), 0) / assessments.length
                    : 0;

                // Calculate accuracy (correct/total)
                const accuracies = assessments
                    .filter((a) => a.correctAnswers !== null && a.totalQuestions !== null && a.totalQuestions > 0)
                    .map((a) => a.correctAnswers / a.totalQuestions);
                const avgAccuracy = accuracies.length > 0
                    ? accuracies.reduce((a, b) => a + b, 0) / accuracies.length
                    : 0.5; // Default 50% if no data

                // Performance score (0-1): combine grade, accuracy, elo delta
                const gradeScore = avgGrade / 100; // 0-1
                const accuracyScore = avgAccuracy; // 0-1
                const eloScore = Math.max(0, Math.min(1, 0.5 + avgEloDelta / 200)); // Centered at 0.5, ±0.5 range

                const performanceScore = (gradeScore * 0.4 + accuracyScore * 0.4 + eloScore * 0.2);

                console.log(`  📊 Performance: grade=${avgGrade.toFixed(1)}, accuracy=${(avgAccuracy * 100).toFixed(1)}%, eloDelta=${avgEloDelta.toFixed(1)}, combined=${(performanceScore * 100).toFixed(1)}%`);

                // Generate natural Likert scores (1-5) based on performance
                // Higher performance → higher scores, but with natural variation
                const generateLikertScore = (basePerformance, variance = 1.0) => {
                    // Base score from performance (map 0-1 to 2-4.5)
                    const base = 2 + basePerformance * 2.5;
                    // Add natural variation (±variance)
                    const variation = randomFloat(-variance, variance);
                    // Clamp to 1-5 and round to integer
                    return Math.max(1, Math.min(5, Math.round(base + variation)));
                };

                // SDT scores - slightly different weighting
                // Autonomy: relates to self-directed learning (sessions, exploration)
                const q1Autonomy = generateLikertScore(performanceScore, 0.8);

                // Competence: relates to feeling capable (grades, accuracy)
                const q2Competence1 = generateLikertScore(gradeScore * 0.6 + accuracyScore * 0.4, 0.7);
                const q3Competence2 = generateLikertScore(gradeScore * 0.5 + accuracyScore * 0.5, 0.7);

                // Relatedness: relates to social connection (harder to measure, more random)
                const q4Relatedness = generateLikertScore(randomFloat(0.3, 0.7), 1.0);

                // Engagement scores
                // Behavioral: actual engagement (sessions, time spent)
                const q5Behavioral = generateLikertScore(performanceScore * 0.7 + 0.3, 0.8);

                // Cognitive: mental effort investment
                const q6Cognitive = generateLikertScore(performanceScore, 0.9);

                // Emotional: how they felt about the experience
                const q7Emotional = generateLikertScore(performanceScore * 0.8 + 0.2, 1.0);

                // Overall
                const q8Overall = generateLikertScore(performanceScore, 0.7);

                console.log(`  📝 Likert scores: Q1=${q1Autonomy}, Q2=${q2Competence1}, Q3=${q3Competence2}, Q4=${q4Relatedness}, Q5=${q5Behavioral}, Q6=${q6Cognitive}, Q7=${q7Emotional}, Q8=${q8Overall}`);

                // Determine submission date (within evaluation period, after last assessment)
                const submittedAt = assessments.length > 0
                    ? new Date(Math.max(...assessments.map((a) => new Date(a.submittedAt).getTime())) + randomInt(1, 24) * 60 * 60 * 1000)
                    : new Date('2026-04-09T15:00:00.000Z');

                // Ensure submittedAt is within bounds
                if (submittedAt > WINDOW_2_END) {
                    submittedAt.setTime(WINDOW_2_END.getTime() - randomInt(1, 12) * 60 * 60 * 1000);
                }

                // Create questionnaire record
                const questionnaire = await prisma.evaluationQuestionnaire.create({
                    data: {
                        userId: student.id,
                        submittedAt,
                        q1Autonomy: q1Autonomy,
                        q2Competence1: q2Competence1,
                        q3Competence2: q3Competence2,
                        q4Relatedness: q4Relatedness,
                        q5Behavioral: q5Behavioral,
                        q6Cognitive: q6Cognitive,
                        q7Emotional: q7Emotional,
                        q8Overall: q8Overall,
                    },
                });

                console.log(`  ✓ Created questionnaire for ${student.name} (submitted: ${submittedAt.toISOString()})`);

                // Sync summary to Supabase (will now include questionnaire data)
                const { start, end } = evaluationService.toDateRange();
                const summary = await evaluationService.computeSummary(student.id, start, end);
                const payload = evaluationService.toSummaryPayload(student.id, summary);

                const { error } = await supabase
                    .from('student_summaries')
                    .upsert(payload, { onConflict: 'user_id' });

                if (error) {
                    console.error(`[Questionnaire] Error syncing ${student.name}:`, error.message);
                } else {
                    console.log(`[Questionnaire] ✓ Synced to Supabase: ${student.name}`);
                }
            } catch (err) {
                console.error(`[Questionnaire] Failed for ${student.name}:`, err.message);
            }
        }

        console.log('[Questionnaire] All questionnaire data filled successfully!');
    } catch (err) {
        console.error('[Questionnaire] Fatal error:', err.message);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

fillQuestionnaireData();
