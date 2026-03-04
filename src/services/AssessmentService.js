const prisma = require('../prismaClient');
const { GoogleAIClient } = require('./GoogleAIClient');

const EASY = 'EASY';
const MEDIUM = 'MEDIUM';
const HARD = 'HARD';

const getCorrectnessRatio = (correct, total) => {
    if (!total) {
        return 0;
    }
    return correct / total;
};

const determineDifficulty = (previousDifficulty = EASY, grade) => {
    if (grade >= 85) {
        return HARD;
    }
    if (grade >= 60) {
        return MEDIUM;
    }
    return EASY;
};

const buildFeedback = (grade, correct, total) => {
    if (grade >= 90) {
        return 'Jawabanmu sudah sangat baik! Pertahankan ritme belajarmu.';
    }
    if (grade >= 70) {
        return 'Hasilmu cukup bagus, coba tinjau kembali soal yang masih salah untuk memperkuat pemahaman.';
    }
    if (grade > 0 && grade < 70) {
        return 'Hasilmu masih perlu ditingkatkan, coba tinjau kembali soal yang masih salah untuk memperkuat pemahaman.';
    }
    if (correct === 0) {
        return 'Belum ada jawaban yang tepat. Coba baca ulang materi, lalu kerjakan kembali secara bertahap.';
    }
    return 'Masih ada beberapa konsep yang perlu diperkuat. Fokus pada soal yang salah dan coba lagi, kamu pasti bisa!';
};

const ensureUserChapter = async (userId, chapterId) => {
    const existing = await prisma.userChapter.findFirst({ where: { userId, chapterId } });
    if (existing) {
        return existing;
    }

    return prisma.userChapter.create({
        data: {
            userId,
            chapterId,
            isStarted: true,
        },
    });
};

const evaluateSubmission = (questions = [], answerMap = new Map()) => {
    let correctAnswers = 0;
    let assessableQuestions = 0;
    const evaluations = questions.map((question, index) => {
        const isEssay = question.type === 'EY';
        const submitted = (answerMap.get(index) || '').trim();
        const correct = (question.answer || question.correctedAnswer || '').trim();
        let isCorrect = false;

        if (!isEssay) {
            assessableQuestions += 1;
            isCorrect = submitted && submitted.toLowerCase() === correct.toLowerCase();
            if (isCorrect) {
                correctAnswers += 1;
            }
        } // we assign isCorrect = false as default for essays to avoid counting them

        return {
            index,
            question: question.question,
            submittedAnswer: submitted,
            correctAnswer: correct,
            isCorrect,
        };
    });

    return { evaluations, correctAnswers, assessableQuestions };
};

const normaliseQuestions = (rawQuestions) => {
    if (!rawQuestions) {
        return [];
    }
    if (Array.isArray(rawQuestions)) {
        return rawQuestions;
    }
    if (typeof rawQuestions === 'string') {
        try {
            const parsed = JSON.parse(rawQuestions);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error('Failed to parse assessment questions JSON', error);
            return [];
        }
    }
    return [];
};

const buildGoogleAIClient = () => {
    const apiKey = process.env.LEVELY_GEMINI_API_KEY;
    const model = process.env.LEVELY_GEMINI_MODEL || 'gemma-3-12b-it';
    const baseUrl = process.env.LEVELY_GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/models';
    if (!apiKey) return null;
    return new GoogleAIClient({ apiKey, model, baseUrl });
};

const ensureQuestionsElo = async (questionsData) => {
    let parsed = normaliseQuestions(questionsData);
    if (!parsed || parsed.length === 0) return null;

    const llmClient = buildGoogleAIClient();
    if (!llmClient) return JSON.stringify(parsed);

    // Iteratively ask LLM to provide ELO per question if missing
    for (let q of parsed) {
        if (!q.elo) {
            try {
                const prompt = `Anda adalah seorang ahli pendidikan dan spesialis desain kurikulum. Berdasarkan pertanyaan kuis berikut, tentukan tingkat kesulitannya dalam bentuk rating score ELO (dari 750 hingga 2000). Hanya jawab dengan SATU ANGKA BULAT saja, tanpa tambahan kata lain.\n\nAturan Rating:\n- 750-1000: Beginner (Pemahaman dasar / mudah)\n- 1000-1200: Basic Understanding (Penerapan awal)\n- 1200-1400: Developing Learner (Analisis menengah)\n- 1400-1600: Intermediate (Evaluasi)\n- 1600-1800: Proficient (Cukup rumit, butuh pemikiran dan konteks lanjut)\n- 1800-2000+: Advanced / Mastery (Sangat rumit, membingungkan, soal tingkat ahli tingkat tinggi dan teoritis)\n\nPertanyaan: ${q.question}\nTipe Soal: ${q.type}\nOpsi: ${q.options ? q.options.join(', ') : 'N/A'}\nJawaban Benar: ${q.answer || q.correctedAnswer}`;
                const response = await llmClient.complete({ messages: [{ role: 'user', content: prompt }] });

                const rawResponse = response.replace(/\D/g, '').trim();
                let generatedElo = parseInt(rawResponse, 10);
                if (generatedElo >= 750 && generatedElo <= 3000) {
                    q.elo = generatedElo;
                } else {
                    q.elo = 1200; // default fallback if garbage string
                }
            } catch (err) {
                console.error('Failed LLM Elo generation for question, defaulting to 1200', err.message);
                q.elo = 1200;
            }
        }
    }
    return parsed;
};

exports.getAllAssessments = async () => {
    try {
        return await prisma.assessment.findMany({
            include: { questions: true }
        });
    } catch (error) {
        throw new Error(error.message);
    }
};

exports.getAssessmentById = async (id) => {
    try {
        return await prisma.assessment.findUnique({
            where: { id },
            include: { questions: true }
        });
    } catch (error) {
        throw new Error(error.message);
    }
};

exports.createAssessment = async (newData) => {
    try {
        let questionsToCreate = [];
        if (newData.questions) {
            questionsToCreate = await ensureQuestionsElo(newData.questions) || normaliseQuestions(newData.questions);
            delete newData.questions;
        }

        return await prisma.assessment.create({
            data: {
                ...newData,
                questions: {
                    create: questionsToCreate.map(q => ({
                        question: q.question || '',
                        type: q.type || 'MC',
                        options: q.options || [],
                        answer: q.answer || null,
                        correctedAnswer: q.correctedAnswer || null,
                        elo: q.elo || 1200
                    }))
                }
            },
            include: { questions: true }
        });
    } catch (error) {
        throw new Error(error.message);
    }
};

exports.updateAssessment = async (id, updateData) => {
    try {
        if (updateData.questions) {
            const questionsToCreate = await ensureQuestionsElo(updateData.questions) || normaliseQuestions(updateData.questions);
            delete updateData.questions;

            await prisma.question.deleteMany({ where: { assessmentId: id } });

            return await prisma.assessment.update({
                where: { id },
                data: {
                    ...updateData,
                    questions: {
                        create: questionsToCreate.map(q => ({
                            question: q.question || '',
                            type: q.type || 'MC',
                            options: q.options || [],
                            answer: q.answer || null,
                            correctedAnswer: q.correctedAnswer || null,
                            elo: q.elo || 1200
                        }))
                    }
                },
                include: { questions: true }
            });
        }

        return await prisma.assessment.update({
            where: { id },
            data: updateData,
            include: { questions: true }
        });
    } catch (error) {
        throw new Error(error.message);
    }
};

exports.deleteAssessment = async (id) => {
    try {
        await prisma.assessment.delete({ where: { id } });
        return `Successfully deleted assessment with id: ${id}`;
    } catch (error) {
        throw new Error('Error deleting assessment: ' + error.message);
    }
};

exports.processSubmission = async (userId, chapterId, answers = []) => {
    if (!userId || !chapterId) {
        throw new Error('userId and chapterId are required');
    }

    const answerMap = new Map();
    answers.forEach((entry) => {
        if (entry && typeof entry.index === 'number') {
            answerMap.set(entry.index, typeof entry.answer === 'string' ? entry.answer : '');
        }
    });

    const [assessment, userChapter] = await Promise.all([
        prisma.assessment.findFirst({
            where: { chapterId },
            include: { questions: true }
        }),
        ensureUserChapter(userId, chapterId).then(async (chapter) => {
            // Also fetch the user to get their base points (Elo rating)
            const user = await prisma.user.findUnique({ where: { id: userId } });
            return { ...chapter, user };
        }),
    ]);

    const questions = assessment?.questions || [];

    if (!assessment || questions.length === 0) {
        throw new Error('Assessment untuk chapter ini belum tersedia.');
    }

    const { evaluations, correctAnswers, assessableQuestions } = evaluateSubmission(questions, answerMap);
    const totalQuestions = assessableQuestions > 0 ? assessableQuestions : 1;
    const grade = Math.round(getCorrectnessRatio(correctAnswers, totalQuestions) * 100);

    // Fixed-Penalty Elo Scoring Logic (Vermeiren et al., 2025)
    let userElo = userChapter.user?.points || 750;
    if (userElo < 750) userElo = 750; // Base floor

    // Calculate itemDifficultyElo by averaging the individual Question ELOs.
    const averageQuestionElo = questions.length > 0
        ? questions.reduce((sum, q) => sum + (q.elo || 1200), 0) / questions.length
        : 1200;
    let itemDifficultyElo = Math.round(averageQuestionElo);

    // 1. Rumus Elo Rating Standard
    const expectedProb = 1 / (1 + Math.pow(10, (itemDifficultyElo - userElo) / 400));

    // 2. Actual Score (Win/Loss/Partial) - mapped from 0.0 to 1.0 based on correctness
    const actualScore = getCorrectnessRatio(correctAnswers, totalQuestions);

    // 3. Dynamic Points Calculation with Provisional Rating (USCF N<8 approximation)
    let K_FACTOR = 30; // Standard K-Factor
    let eloChange = 0;

    // Provisional Unrated Phase logic:
    // If the user is at base floor (750 points or less), they are considered "Unrated".
    // We boost the K-Factor to act as a placement test multiplier, and inject a base reward.
    if (userChapter.user?.points === undefined || userChapter.user?.points <= 750) {
        K_FACTOR = 80; // High volatility for placement
        eloChange = Math.round(K_FACTOR * (actualScore - expectedProb));

        // Add a "Placement Bonus" directly tied to grade so they don't get 0 on their first quiz
        // If they get 50% correct, they get a raw +50 placement points on top of the Elo derivation.
        eloChange += Math.round(grade * 0.5);
    } else {
        // Standard ELO for Established players
        eloChange = Math.round(K_FACTOR * (actualScore - expectedProb));
    }

    // Ensure we don't completely drain points, give minimum protection
    const pointsEarned = Math.max(-5, eloChange);

    const newDifficulty = determineDifficulty(userChapter.currentDifficulty, grade);
    const aiFeedback = buildFeedback(grade, correctAnswers, totalQuestions);
    const orderedAnswers = questions.map((_, index) => answerMap.get(index) || '');

    const isExcellent = grade >= 80;
    const updatedChapter = await prisma.userChapter.update({
        where: { id: userChapter.id },
        data: {
            isStarted: true,
            assessmentDone: true,
            assessmentGrade: grade,
            assessmentEloDelta: pointsEarned,
            assessmentAnswer: orderedAnswers,
            currentDifficulty: newDifficulty,
            lastAiFeedback: aiFeedback,
            correctStreak: isExcellent ? ((userChapter.correctStreak || 0) + 1) : 0,
            wrongStreak: isExcellent ? 0 : ((userChapter.wrongStreak || 0) + 1),
            timeFinished: new Date(),
        },
    });

    await prisma.user.update({
        where: { id: userId },
        data: { points: { increment: pointsEarned } },
    });

    return {
        grade,
        pointsEarned,
        correctAnswers,
        totalQuestions,
        newDifficulty,
        aiFeedback,
        evaluations,
        userChapter: updatedChapter,
    };
};