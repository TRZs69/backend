const prisma = require('../prismaClient');

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
    const evaluations = questions.map((question, index) => {
        const submitted = (answerMap.get(index) || '').trim();
        const correct = (question.correctedAnswer || '').trim();
        const isCorrect = submitted && submitted.toLowerCase() === correct.toLowerCase();
        if (isCorrect) {
            correctAnswers += 1;
        }
        return {
            index,
            question: question.question,
            submittedAnswer: submitted,
            correctAnswer: question.correctedAnswer,
            isCorrect,
        };
    });

    return { evaluations, correctAnswers };
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

exports.getAllAssessments = async () => {
    try {
        return await prisma.assessment.findMany();
    } catch (error) {
        throw new Error(error.message);
    }
};

exports.getAssessmentById = async (id) => {
    try {
        return await prisma.assessment.findUnique({ where: { id } });
    } catch (error) {
        throw new Error(error.message);
    }
};

exports.createAssessment = async (newData) => {
    try {
        return await prisma.assessment.create({ data: newData });
    } catch (error) {
        throw new Error(error.message);
    }
};

exports.updateAssessment = async (id, updateData) => {
    try {
        return await prisma.assessment.update({ where: { id }, data: updateData });
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
        prisma.assessment.findFirst({ where: { chapterId } }),
        ensureUserChapter(userId, chapterId).then(async (chapter) => {
            // Also fetch the user to get their base points (Elo rating)
            const user = await prisma.user.findUnique({ where: { id: userId } });
            return { ...chapter, user };
        }),
    ]);

    const questions = normaliseQuestions(assessment?.questions);

    if (!assessment || questions.length === 0) {
        throw new Error('Assessment untuk chapter ini belum tersedia.');
    }

    const { evaluations, correctAnswers } = evaluateSubmission(questions, answerMap);
    const totalQuestions = questions.length;
    const grade = Math.round(getCorrectnessRatio(correctAnswers, totalQuestions) * 100);

    // Fixed-Penalty Elo Scoring Logic (Vermeiren et al., 2025)
    let userElo = userChapter.user?.points || 1000;
    if (userElo < 1000) userElo = 1000; // Base floor

    let itemDifficultyElo;
    switch (userChapter.currentDifficulty) {
        case EASY:
            itemDifficultyElo = 800;
            break;
        case MEDIUM:
            itemDifficultyElo = 1200;
            break;
        case HARD:
            itemDifficultyElo = 1600;
            break;
        default:
            itemDifficultyElo = 1200;
    }

    // 1. Expected Probability
    const expectedProb = 1 / (1 + Math.pow(10, (itemDifficultyElo - userElo) / 400));

    // 2. Actual Score (Win/Loss/Partial) - mapped from 0.0 to 1.0 based on correctness
    const actualScore = getCorrectnessRatio(correctAnswers, totalQuestions);

    // 3. Dynamic Points Calculation
    const K_FACTOR = 30;
    let eloChange = Math.round(K_FACTOR * (actualScore - expectedProb));

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