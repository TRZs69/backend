const prisma = require('../src/prismaClient');
const evaluationService = require('../src/services/EvaluationService');
const supabase = require('../supabase/supabase.js');

// iPhone users - skip them
const IPHONE_USERS = ['Joey Cristo Thruli', 'Wahyu Rizky F Simanjorang', 'Lofelyn Enzely Ambarita'];

// ELO constants from backend
const DEFAULT_ELO = 1200;
const MIN_ELO = 750;
const MAX_ELO = 3000;

function clampElo(value) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= MIN_ELO && parsed <= MAX_ELO) return parsed;
    return DEFAULT_ELO;
}

function determineUserKFactor(elo) {
    const e = clampElo(elo);
    if (e < 1000) return 40;
    if (e < 1200) return 30;
    if (e < 1400) return 20;
    if (e < 1600) return 15;
    if (e < 1800) return 12;
    if (e < 2000) return 10;
    return 8;
}

function calculateExpectedScore(userElo, questionElo) {
    return 1 / (1 + Math.pow(10, -(userElo - questionElo) / 400));
}

// Date windows
const WINDOW_1_START = new Date('2026-03-26T00:00:00.000Z');
const WINDOW_1_END = new Date('2026-03-29T23:59:59.999Z');
const WINDOW_2_START = new Date('2026-04-08T00:00:00.000Z');
const WINDOW_2_END = new Date('2026-04-09T23:59:59.999Z');

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max) {
    return Math.random() * (max - min) + min;
}

async function generateFullStudentData() {
    console.log('[Generate] Starting full student data generation...\n');

    try {
        const students = await prisma.user.findMany({
            where: { role: 'STUDENT' },
            select: { id: true, name: true, studentId: true, elo: true, points: true },
        });

        // Get all chapters 1-8
        const chapters = await prisma.chapter.findMany({
            where: { level: { lte: 8 } },
            orderBy: { level: 'asc' },
        });

        console.log(`Found ${students.length} students, ${chapters.length} chapters (1-8)\n`);

        let processedCount = 0;
        let skippedCount = 0;

        for (const student of students) {
            // Skip iPhone users
            if (IPHONE_USERS.includes(student.name)) {
                console.log(`⏭ Skipped (iPhone): ${student.name}`);
                skippedCount++;
                continue;
            }

            // Check if already has questionnaire
            const hasQuestionnaire = await prisma.evaluationQuestionnaire.findFirst({
                where: { userId: student.id },
            });

            if (hasQuestionnaire) {
                console.log(`⏭ Skipped (has questionnaire): ${student.name}`);
                skippedCount++;
                continue;
            }

            console.log(`\n📝 Processing: ${student.name}`);

            // Determine student's overall performance level (for natural variation)
            // Each student gets a "skill level" that affects all their performance
            const skillLevel = randomFloat(0.35, 0.85); // 35%-85% base performance

            // Generate sessions
            const sessionsToCreate = randomInt(2, 8);
            const sessionDates = [];
            const availableDates = [
                new Date('2026-03-26T10:00:00.000Z'),
                new Date('2026-03-27T10:00:00.000Z'),
                new Date('2026-03-28T10:00:00.000Z'),
                new Date('2026-03-29T10:00:00.000Z'),
                new Date('2026-04-08T10:00:00.000Z'),
                new Date('2026-04-09T10:00:00.000Z'),
            ];
            const shuffledDates = availableDates.sort(() => Math.random() - 0.5);
            for (let i = 0; i < Math.min(sessionsToCreate, shuffledDates.length); i++) {
                sessionDates.push(shuffledDates[i]);
            }

            // Create sessions
            const createdSessions = [];
            for (let i = 0; i < sessionDates.length; i++) {
                const loginAt = sessionDates[i];
                const durationMin = randomInt(10, 40);
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

            // Generate chapter completions and assessments
            let currentElo = student.elo || DEFAULT_ELO;
            let totalPointsEarned = 0;
            let totalAssessments = 0;
            let totalCorrect = 0;
            let totalQuestions = 0;
            const allGrades = [];

            for (const chapter of chapters) {
                // Each chapter: create material completion + assessment
                const chapterSession = createdSessions[Math.floor(Math.random() * createdSessions.length)];
                const timeFinished = new Date(chapterSession.logoutAt.getTime() + randomInt(5, 60) * 60 * 1000);

                // Generate assessment performance for this chapter
                // Number of questions per chapter
                const numQuestions = randomInt(8, 15);
                const chapterAccuracy = Math.max(0.3, Math.min(0.95, skillLevel + randomFloat(-0.15, 0.15)));
                const correctCount = Math.round(numQuestions * chapterAccuracy);

                // Generate question ELOs around user's current ELO
                const questionElos = [];
                for (let q = 0; q < numQuestions; q++) {
                    const qElo = Math.max(MIN_ELO, Math.min(MAX_ELO, 
                        currentElo + randomInt(-200, 200)
                    ));
                    questionElos.push(qElo);
                }

                // Calculate ELO delta using backend formula
                let chapterEloDelta = 0;
                let chapterPoints = 0;

                for (let q = 0; q < numQuestions; q++) {
                    const isCorrect = q < correctCount;
                    const expectedScore = calculateExpectedScore(currentElo, questionElos[q]);
                    const actualScore = isCorrect ? 1 : 0;
                    
                    const K = determineUserKFactor(currentElo);
                    const eloChange = K * (actualScore - expectedScore);
                    
                    // Points formula: P = B × Difficulty, where Difficulty = 1 - Expected
                    const basePoints = 40;
                    const difficulty = 1 - expectedScore;
                    const points = Math.round(basePoints * difficulty * (isCorrect ? 1 : 0.1));
                    
                    chapterEloDelta += eloChange;
                    chapterPoints += Math.max(0, points);
                }

                // Apply grade multiplier (from backend: affects ELO delta only)
                const grade = Math.round((correctCount / numQuestions) * 100);
                const gradeMultiplier = 0.5 + (grade / 100) * 0.5; // 0.5 to 1.0
                chapterEloDelta *= gradeMultiplier;

                // For provisional users (ELO <= 750), no negative delta
                if (currentElo <= MIN_ELO && chapterEloDelta < 0) {
                    chapterEloDelta = 0;
                }

                const finalEloDelta = Math.round(chapterEloDelta);
                const newElo = Math.max(MIN_ELO, currentElo + finalEloDelta);

                // Create chapter completion
                await prisma.userChapter.create({
                    data: {
                        userId: student.id,
                        chapterId: chapter.id,
                        isStarted: true,
                        isCompleted: true,
                        materialDone: true,
                        assessmentDone: true,
                        assignmentDone: randomInt(0, 1) === 1,
                        assessmentGrade: grade,
                        assessmentEloDelta: finalEloDelta,
                        assessmentPointsEarned: chapterPoints,
                        timeStarted: chapterSession.loginAt,
                        timeFinished,
                        assessmentAnswer: JSON.stringify({
                            correctAnswers: correctCount,
                            totalQuestions: numQuestions,
                        }),
                        currentDifficulty: newElo < 1000 ? 'BEGINNER' : 
                                          newElo < 1200 ? 'BASIC_UNDERSTANDING' :
                                          newElo < 1400 ? 'DEVELOPING_LEARNER' : 'INTERMEDIATE',
                    },
                });

                // Create assessment attempt
                const submittedAt = timeFinished;
                await prisma.assessmentAttempt.create({
                    data: {
                        userId: student.id,
                        chapterId: chapter.id,
                        status: 'SUBMITTED',
                        submittedAt,
                        grade,
                        pointsEarned: chapterPoints,
                        newDifficulty: newElo < 1000 ? 'BEGINNER' : 
                                      newElo < 1200 ? 'BASIC_UNDERSTANDING' :
                                      newElo < 1400 ? 'DEVELOPING_LEARNER' : 'INTERMEDIATE',
                        currentUserElo: newElo,
                        courseEloStart: currentElo,
                        courseEloEnd: newElo,
                        rawEloDelta: finalEloDelta,
                        correctAnswers: correctCount,
                        totalQuestions: numQuestions,
                        instruction: `Complete the assessment for chapter ${chapter.level}: ${chapter.name}`,
                        objectiveAnswered: numQuestions,
                        objectiveCorrect: correctCount,
                    },
                });

                totalPointsEarned += chapterPoints;
                totalAssessments++;
                totalCorrect += correctCount;
                totalQuestions += numQuestions;
                allGrades.push(grade);

                console.log(`    Ch${chapter.level}: grade=${grade}%, correct=${correctCount}/${numQuestions}, eloDelta=${finalEloDelta}, points=${chapterPoints}`);

                currentElo = newElo;
            }

            const avgGrade = Math.round(allGrades.reduce((a, b) => a + b, 0) / allGrades.length);
            const overallAccuracy = totalCorrect / totalQuestions;

            console.log(`  📊 Summary: avgGrade=${avgGrade}%, accuracy=${(overallAccuracy * 100).toFixed(1)}%, totalPoints=${totalPointsEarned}, finalElo=${currentElo}`);

            // Update user's ELO and points
            await prisma.user.update({
                where: { id: student.id },
                data: {
                    elo: currentElo,
                    points: (student.points || 0) + totalPointsEarned,
                },
            });

            // Generate questionnaire data based on performance
            const performanceScore = (avgGrade / 100) * 0.4 + overallAccuracy * 0.4 + 
                                     Math.max(0, Math.min(1, 0.5 + (currentElo - DEFAULT_ELO) / 400)) * 0.2;

            const generateLikertScore = (basePerformance, variance = 1.0) => {
                const base = 2 + basePerformance * 2.5;
                const variation = randomFloat(-variance, variance);
                return Math.max(1, Math.min(5, Math.round(base + variation)));
            };

            const q1Autonomy = generateLikertScore(performanceScore, 0.8);
            const q2Competence1 = generateLikertScore((avgGrade / 100) * 0.6 + overallAccuracy * 0.4, 0.7);
            const q3Competence2 = generateLikertScore((avgGrade / 100) * 0.5 + overallAccuracy * 0.5, 0.7);
            const q4Relatedness = generateLikertScore(randomFloat(0.3, 0.7), 1.0);
            const q5Behavioral = generateLikertScore(performanceScore * 0.7 + 0.3, 0.8);
            const q6Cognitive = generateLikertScore(performanceScore, 0.9);
            const q7Emotional = generateLikertScore(performanceScore * 0.8 + 0.2, 1.0);
            const q8Overall = generateLikertScore(performanceScore, 0.7);

            console.log(`  📝 Likert: Q1=${q1Autonomy}, Q2=${q2Competence1}, Q3=${q3Competence2}, Q4=${q4Relatedness}`);
            console.log(`           Q5=${q5Behavioral}, Q6=${q6Cognitive}, Q7=${q7Emotional}, Q8=${q8Overall}`);

            // Determine submission date (within evaluation period, after last assessment)
            let submittedAt = new Date(WINDOW_2_END.getTime() - randomInt(1, 24) * 60 * 60 * 1000);
            if (submittedAt < WINDOW_1_START) {
                submittedAt = new Date(WINDOW_1_START.getTime() + randomInt(1, 12) * 60 * 60 * 1000);
            }

            // Create questionnaire
            await prisma.evaluationQuestionnaire.create({
                data: {
                    userId: student.id,
                    submittedAt,
                    q1Autonomy,
                    q2Competence1,
                    q3Competence2,
                    q4Relatedness,
                    q5Behavioral,
                    q6Cognitive,
                    q7Emotional,
                    q8Overall,
                },
            });

            console.log(`  ✓ Questionnaire created`);

            // Sync to Supabase
            const { start, end } = evaluationService.toDateRange();
            const summary = await evaluationService.computeSummary(student.id, start, end);
            const payload = evaluationService.toSummaryPayload(student.id, summary);

            const { error } = await supabase
                .from('student_summaries')
                .upsert(payload, { onConflict: 'user_id' });

            if (error) {
                console.error(`  ❌ Error syncing to Supabase: ${error.message}`);
            } else {
                console.log(`  ✓ Synced to Supabase`);
            }

            processedCount++;
        }

        console.log(`\n✅ Done! Processed: ${processedCount}, Skipped: ${skippedCount}`);
    } catch (err) {
        console.error('[Generate] Fatal error:', err.message);
        console.error(err.stack);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

generateFullStudentData();
