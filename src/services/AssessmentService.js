const prisma = require('../prismaClient');
const { GoogleAIClient } = require('./GoogleAIClient');

const EASY = 'EASY';
const MEDIUM = 'MEDIUM';
const HARD = 'HARD';

const ATTEMPT_STATUS = {
    IN_PROGRESS: 'IN_PROGRESS',
    SUBMITTED: 'SUBMITTED',
    ABANDONED: 'ABANDONED',
};

const ATTEMPT_SOURCE = {
    GENERATED: 'GENERATED',
    FALLBACK_BANK: 'FALLBACK_BANK',
};

const TARGET_QUESTION_PATTERN = ['MC', 'MC', 'MC', 'MC', 'TF', 'EY'];
const DEFAULT_ELO = 1200;
const MIN_ELO = 750;
const MAX_ELO = 3000;

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

const normaliseAttemptQuestionType = (type) => {
    const upper = String(type || '').trim().toUpperCase();
    if (!upper) {
        return '';
    }
    if (upper === 'PG') {
        return 'MC';
    }
    if (upper === 'TRUE_FALSE' || upper === 'TRUEFALSE') {
        return 'TF';
    }
    if (upper === 'ESSAY') {
        return 'EY';
    }
    return upper;
};

const isObjectiveType = (type) => {
    const normalized = normaliseAttemptQuestionType(type);
    return normalized === 'MC' || normalized === 'TF';
};

const evaluateSubmission = (questions = [], answerMap = new Map()) => {
    let correctAnswers = 0;
    let assessableQuestions = 0;
    const evaluations = questions.map((question, index) => {
        const normalizedType = normaliseAttemptQuestionType(question.type);
        const isEssay = normalizedType === 'EY';
        const submitted = (answerMap.get(question.id) || '').trim();
        const correct = (question.answer || question.correctedAnswer || '').trim();
        let isCorrect = false;

        if (!isEssay) {
            assessableQuestions += 1;
            isCorrect = submitted && submitted.toLowerCase() === correct.toLowerCase();
            if (isCorrect) {
                correctAnswers += 1;
            }
        }

        return {
            index,
            questionId: question.id,
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

const ensureGoogleCredentials = () => {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        return;
    }

    const fallbackPath =
        process.env.LEVELY_GOOGLE_APPLICATION_CREDENTIALS ||
        process.env.LEVELY_GOOGLE_APPLICATION_CREDENTIALS_PATH;

    if (fallbackPath) {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = fallbackPath;
    }
};

const buildGoogleAIClient = () => {
    ensureGoogleCredentials();
    const apiKey = process.env.LEVELY_GEMINI_API_KEY;
    const model = process.env.LEVELY_GEMINI_MODEL || 'gemma-3-12b-it';
    const baseUrl =
        process.env.LEVELY_GEMINI_BASE_URL ||
        'https://generativelanguage.googleapis.com/v1beta/models';
    const isVertex = baseUrl.includes('aiplatform.googleapis.com');

    if (!apiKey && !isVertex) {
        return null;
    }

    return new GoogleAIClient({ apiKey, model, baseUrl });
};

const clampElo = (value) => {
    const parsed = parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed >= MIN_ELO && parsed <= MAX_ELO) {
        return parsed;
    }
    return DEFAULT_ELO;
};

const parseJsonPayload = (text) => {
    if (typeof text !== 'string' || !text.trim()) {
        throw new Error('LLM response is empty');
    }

    const trimmed = text.trim();
    const directCandidates = [trimmed, trimmed.replace(/```json|```/gi, '').trim()];

    for (const candidate of directCandidates) {
        if (!candidate) {
            continue;
        }
        try {
            return JSON.parse(candidate);
        } catch (_error) {
            // Ignore and continue fallback parsing.
        }
    }

    const objectMatch = trimmed.match(/\{[\s\S]*\}/);
    if (objectMatch?.[0]) {
        try {
            return JSON.parse(objectMatch[0]);
        } catch (_error) {
            // Ignore and continue fallback parsing.
        }
    }

    const arrayMatch = trimmed.match(/\[[\s\S]*\]/);
    if (arrayMatch?.[0]) {
        return JSON.parse(arrayMatch[0]);
    }

    throw new Error('Failed to parse JSON payload from LLM response');
};

const normalizeTextOptions = (raw) => {
    if (!Array.isArray(raw)) {
        return [];
    }
    return raw
        .map((item) => String(item ?? '').trim())
        .filter((item) => item.length > 0);
};

const matchOptionCaseInsensitive = (options = [], answer = '') => {
    const normalizedAnswer = String(answer || '').trim().toLowerCase();
    if (!normalizedAnswer) {
        return null;
    }
    const found = options.find((option) => option.toLowerCase() === normalizedAnswer);
    return found || null;
};

const inferGeneratedType = (questionData) => {
    const declaredType = normaliseAttemptQuestionType(questionData?.type);
    if (declaredType) {
        return declaredType;
    }

    const options = normalizeTextOptions(questionData?.options ?? questionData?.option ?? []);
    if (options.length > 0) {
        const normalized = options.map((item) => item.toLowerCase());
        const hasTrueFalse =
            normalized.includes('true') &&
            normalized.includes('false') &&
            options.length <= 2;
        return hasTrueFalse ? 'TF' : 'MC';
    }

    return 'EY';
};

const normalizeGeneratedQuestion = (questionData, index) => {
    const type = inferGeneratedType(questionData);
    if (!type) {
        throw new Error(`Question type tidak bisa ditentukan pada index ${index + 1}`);
    }

    const questionText = String(questionData?.question || '').trim();
    if (!questionText) {
        throw new Error(`Question text is required at index ${index + 1}`);
    }

    const rawOptions = questionData?.options ?? questionData?.option ?? [];
    let options = normalizeTextOptions(rawOptions);
    let correctedAnswer = String(questionData?.correctedAnswer ?? questionData?.answer ?? '').trim();

    if (type === 'MC') {
        if (options.length < 2) {
            throw new Error(`MC options minimal 2 pada index ${index + 1}`);
        }
        if (options.length > 4) {
            options = options.slice(0, 4);
        }
        while (options.length < 4) {
            options.add(`Pilihan ${options.length + 1}`);
        }
        const matched = matchOptionCaseInsensitive(options, correctedAnswer);
        correctedAnswer = matched || options.first;
    } else if (type === 'TF') {
        options = ['True', 'False'];
        const normalized = correctedAnswer.toLowerCase();
        if (normalized === 'true') {
            correctedAnswer = 'True';
        } else if (normalized === 'false') {
            correctedAnswer = 'False';
        } else {
            correctedAnswer = 'True';
        }
    } else if (type === 'EY') {
        options = [];
        if (!correctedAnswer) {
            correctedAnswer = 'Jawaban esai berdasarkan materi pada chapter ini.';
        }
    }

    const elo = clampElo(questionData?.elo);

    return {
        question: questionText,
        type,
        options,
        answer: correctedAnswer,
        correctedAnswer,
        elo,
        sourceQuestionId: null,
    };
};

const normaliseGeneratedAttemptQuestions = (rawQuestions) => {
    if (!Array.isArray(rawQuestions)) {
        throw new Error('Generated questions payload must be an array');
    }

    if (rawQuestions.length < TARGET_QUESTION_PATTERN.length) {
        throw new Error(`Generated questions must be at least ${TARGET_QUESTION_PATTERN.length}`);
    }

    const normalizedPool = rawQuestions.map((questionData, index) =>
        normalizeGeneratedQuestion(questionData, index),
    );

    const shuffle = (list) => [...list].sort(() => Math.random() - 0.5);
    const mc = shuffle(normalizedPool.filter((q) => q.type === 'MC'));
    const tf = shuffle(normalizedPool.filter((q) => q.type === 'TF'));
    const ey = shuffle(normalizedPool.filter((q) => q.type === 'EY'));

    if (mc.length < 4 || tf.length < 1 || ey.length < 1) {
        throw new Error('Komposisi soal LLM tidak memenuhi 4 MC + 1 TF + 1 EY');
    }

    return [
        ...mc.slice(0, 4),
        tf[0],
        ey[0],
    ];
};

const stripHtml = (content = '') =>
    String(content || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const buildAttemptInstruction = (chapterName) =>
    `Jawab 6 soal assessment bab "${chapterName}" dengan teliti. Format: 4 MC, 1 TF, dan 1 Essay.`;

const buildGenerationPrompt = ({ chapterName, chapterDescription, materialContent, userElo }) => {
    return `
Anda adalah asisten pengajar untuk aplikasi Levelearn.

Tugas:
- Buat EXACT 6 soal assessment berbahasa Indonesia untuk satu chapter.
- Urutan WAJIB: 1) MC, 2) MC, 3) MC, 4) MC, 5) TF, 6) EY.
- Untuk MC: opsi harus tepat 4 item dan correctedAnswer harus salah satu opsi.
- Untuk TF: options harus ["True","False"] dan correctedAnswer harus True/False.
- Untuk EY: wajib ada correctedAnswer (jawaban referensi).
- Setiap soal harus punya elo (bilangan bulat 750-3000), sesuaikan dengan target Elo siswa.

Konteks chapter:
- Nama: ${chapterName}
- Deskripsi: ${chapterDescription || '-'}
- Target Elo siswa saat ini: ${userElo}
- Ringkasan materi:
${materialContent || '-'}

Kembalikan JSON valid SAJA (tanpa markdown/code fence) dengan struktur persis:
{
  "instruction": "string",
  "questions": [
    {
      "question": "string",
      "type": "MC|TF|EY",
      "options": ["string"],
      "correctedAnswer": "string",
      "elo": 1200
    }
  ]
}
`.trim();
};

const generateAttemptQuestionsWithLLM = async ({ chapter, material, userElo }) => {
    const llmClient = buildGoogleAIClient();
    if (!llmClient) {
        throw new Error('LLM client is not configured');
    }

    const prompt = buildGenerationPrompt({
        chapterName: chapter?.name || `Chapter ${chapter?.id || ''}`.trim(),
        chapterDescription: chapter?.description || '',
        materialContent: stripHtml(material?.content || ''),
        userElo,
    });

    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
        try {
            const raw = await llmClient.complete({
                messages: [{ role: 'user', content: prompt }],
            });

            const parsed = parseJsonPayload(raw);
            const payload = Array.isArray(parsed) ? { questions: parsed } : parsed;
            const instruction = String(payload?.instruction || '').trim() || buildAttemptInstruction(chapter?.name || 'Assessment');
            const questions = normaliseGeneratedAttemptQuestions(payload?.questions);

            return { instruction, questions };
        } catch (error) {
            lastError = error;
            console.error(`LLM attempt generation failed at try ${attempt}:`, error.message);
        }
    }

    throw lastError || new Error('LLM generation failed');
};

const normalizeStoredQuestion = (question) => {
    const type = normaliseAttemptQuestionType(question.type);
    let options = normalizeTextOptions(question.options || []);
    let correctedAnswer = String(question.correctedAnswer || question.answer || '').trim();

    if (type === 'TF') {
        options = ['True', 'False'];
        correctedAnswer = correctedAnswer.toLowerCase() === 'false' ? 'False' : 'True';
    }

    if (type === 'MC') {
        const matched = matchOptionCaseInsensitive(options, correctedAnswer);
        if (matched) {
            correctedAnswer = matched;
        } else if (options.length > 0) {
            correctedAnswer = options[0];
        }
    }

    if (type === 'EY' && !correctedAnswer) {
        correctedAnswer = String(question.answer || '').trim();
    }

    return {
        sourceQuestionId: question.id,
        question: String(question.question || '').trim(),
        type: type || 'MC',
        options,
        answer: correctedAnswer || null,
        correctedAnswer: correctedAnswer || null,
        elo: clampElo(question.elo),
    };
};

const reorderQuestionsByPattern = (questions) => {
    const pool = [...questions];
    const usedIndexes = new Set();
    const ordered = [];

    for (const expectedType of TARGET_QUESTION_PATTERN) {
        let pickedIndex = pool.findIndex((q, idx) =>
            !usedIndexes.has(idx) && normaliseAttemptQuestionType(q.type) === expectedType,
        );

        if (pickedIndex < 0) {
            pickedIndex = pool.findIndex((_, idx) => !usedIndexes.has(idx));
        }

        if (pickedIndex < 0) {
            break;
        }

        usedIndexes.add(pickedIndex);
        ordered.push(pool[pickedIndex]);
    }

    return ordered.slice(0, TARGET_QUESTION_PATTERN.length);
};

const buildFallbackQuestionsFromBank = (questions = [], userElo = MIN_ELO) => {
    if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('Fallback bank kosong');
    }

    const sortedByDistance = [...questions].sort((a, b) => {
        const eloA = clampElo(a.elo);
        const eloB = clampElo(b.elo);
        const diffA = Math.abs(eloA - userElo);
        const diffB = Math.abs(eloB - userElo);
        return diffA - diffB;
    });

    const used = new Set();
    const pickBy = (predicate, count) => {
        const picked = [];
        while (picked.length < count) {
            const candidates = [];
            for (let idx = 0; idx < sortedByDistance.length; idx += 1) {
                if (used.has(idx)) {
                    continue;
                }
                const item = sortedByDistance[idx];
                if (predicate(item)) {
                    candidates.push(idx);
                }
            }
            if (candidates.length === 0) {
                break;
            }

            const sampledPool = candidates.slice(0, Math.min(5, candidates.length));
            const selectedIndex = sampledPool[Math.floor(Math.random() * sampledPool.length)];
            used.add(selectedIndex);
            picked.push(sortedByDistance[selectedIndex]);
        }
        return picked;
    };

    const isMC = (q) => normaliseAttemptQuestionType(q.type) === 'MC';
    const isTF = (q) => normaliseAttemptQuestionType(q.type) === 'TF';
    const isEY = (q) => normaliseAttemptQuestionType(q.type) === 'EY';

    const selected = [
        ...pickBy(isMC, 4),
        ...pickBy(isTF, 1),
        ...pickBy(isEY, 1),
    ];

    if (selected.length < TARGET_QUESTION_PATTERN.length) {
        for (let idx = 0; idx < sortedByDistance.length && selected.length < TARGET_QUESTION_PATTERN.length; idx += 1) {
            if (used.has(idx)) {
                continue;
            }
            used.add(idx);
            selected.push(sortedByDistance[idx]);
        }
    }

    if (selected.length < TARGET_QUESTION_PATTERN.length) {
        throw new Error('Fallback bank tidak memiliki minimal 6 soal');
    }

    const ordered = reorderQuestionsByPattern(selected);
    if (ordered.length < TARGET_QUESTION_PATTERN.length) {
        throw new Error('Fallback bank gagal membentuk 6 soal');
    }

    return ordered.map((q) => normalizeStoredQuestion(q));
};

const formatAttemptResponse = (attempt, resumed = false) => {
    if (!attempt) {
        return null;
    }

    const questions = (attempt.questions || [])
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((q) => ({
            id: q.id,
            sourceQuestionId: q.sourceQuestionId ?? null,
            question: q.question,
            type: normaliseAttemptQuestionType(q.type) || 'MC',
            options: Array.isArray(q.options) ? q.options : [],
            answer: q.answer,
            correctedAnswer: q.correctedAnswer || q.answer || '',
            elo: clampElo(q.elo),
            submittedAnswer: q.submittedAnswer ?? '',
            isCorrect: q.isCorrect ?? false,
            score: q.score ?? 0,
            order: q.order,
        }));

    return {
        attemptId: attempt.id,
        chapterId: attempt.chapterId,
        instruction: attempt.instruction,
        questions,
        resumed,
        source: attempt.source,
        status: attempt.status,
        submittedAt: attempt.submittedAt,
    };
};

const buildAnswerMap = (answers = []) => {
    const answerMap = new Map();
    answers.forEach((entry) => {
        const questionId = Number(entry?.questionId);
        if (Number.isInteger(questionId)) {
            answerMap.set(questionId, typeof entry.answer === 'string' ? entry.answer : '');
        }
    });
    return answerMap;
};

const calculateEloOutcome = ({
    questions,
    evaluations,
    grade,
    totalQuestions,
    userElo,
}) => {
    let normalizedUserElo = userElo || MIN_ELO;
    if (normalizedUserElo < MIN_ELO) {
        normalizedUserElo = MIN_ELO;
    }

    const isProvisional = normalizedUserElo <= MIN_ELO;
    const K_USER = isProvisional ? 80 : 30;
    const K_QUESTION = 15;

    let totalUserEloEarned = 0;
    const questionUpdates = [];

    for (const evaluation of evaluations) {
        const question = questions[evaluation.index];
        if (!question || !isObjectiveType(question.type)) {
            continue;
        }

        const questionElo = clampElo(question.elo);
        const expectedProbUser = 1 / (1 + Math.pow(10, (questionElo - normalizedUserElo) / 400));
        const actualUserScore = evaluation.isCorrect ? 1 : 0;
        const actualQuestionScore = evaluation.isCorrect ? 0 : 1;

        let userEloChange = K_USER * (actualUserScore - expectedProbUser);
        const questionEloChange = K_QUESTION * (actualQuestionScore - (1 - expectedProbUser));

        if (isProvisional && evaluation.isCorrect) {
            userEloChange += (100 / totalQuestions) * 0.5;
        }

        totalUserEloEarned += userEloChange;
        questionUpdates.push({
            questionId: question.id,
            newElo: Math.round(questionElo + questionEloChange),
        });
    }

    let totalEloChangeRaw = totalUserEloEarned;

    if (grade >= 79.5) {
        totalEloChangeRaw *= 1.5;
    } else if (grade >= 72) {
        totalEloChangeRaw *= 1.25;
    } else if (grade >= 64.5) {
        totalEloChangeRaw *= 1.1;
    } else if (grade >= 57) {
        totalEloChangeRaw *= 1.0;
    } else if (grade >= 49.5) {
        totalEloChangeRaw *= 0.5;
    } else if (grade >= 34) {
        totalEloChangeRaw *= 1.5;
    } else {
        totalEloChangeRaw *= 2.0;
    }

    if (isProvisional && totalEloChangeRaw < 0) {
        totalEloChangeRaw = 0;
    }

    return {
        pointsEarned: Math.round(totalEloChangeRaw),
        questionUpdates,
    };
};

const ensureQuestionsElo = async (questionsData) => {
    const parsed = normaliseQuestions(questionsData);
    if (!parsed || parsed.length === 0) {
        return [];
    }

    const llmClient = buildGoogleAIClient();
    if (!llmClient) {
        return parsed.map((q) => ({
            ...q,
            elo: clampElo(q.elo),
        }));
    }

    for (const q of parsed) {
        if (!q.elo) {
            try {
                const prompt = `Anda adalah seorang ahli pendidikan dan spesialis desain kurikulum. Berdasarkan pertanyaan kuis berikut, tentukan tingkat kesulitannya dalam bentuk rating score ELO (dari 750 hingga 2000). Hanya jawab dengan SATU ANGKA BULAT saja, tanpa tambahan kata lain.\n\nAturan Rating:\n- 750-1000: Beginner (Pemahaman dasar / mudah)\n- 1000-1200: Basic Understanding (Penerapan awal)\n- 1200-1400: Developing Learner (Analisis menengah)\n- 1400-1600: Intermediate (Evaluasi)\n- 1600-1800: Proficient (Cukup rumit, butuh pemikiran dan konteks lanjut)\n- 1800-2000+: Advanced / Mastery (Sangat rumit, membingungkan, soal tingkat ahli tingkat tinggi dan teoritis)\n\nPertanyaan: ${q.question}\nTipe Soal: ${q.type}\nOpsi: ${q.options ? q.options.join(', ') : 'N/A'}\nJawaban Benar: ${q.answer || q.correctedAnswer}`;
                const response = await llmClient.complete({
                    messages: [{ role: 'user', content: prompt }],
                });
                q.elo = clampElo(response.replace(/\D/g, '').trim());
            } catch (err) {
                console.error('Failed LLM Elo generation for question, defaulting to 1200', err.message);
                q.elo = DEFAULT_ELO;
            }
        } else {
            q.elo = clampElo(q.elo);
        }
    }
    return parsed;
};

const getAssessmentAndUserContext = async (userId, chapterId) => {
    const [assessment, userChapter] = await Promise.all([
        prisma.assessment.findFirst({
            where: { chapterId },
            include: { questions: true },
        }),
        ensureUserChapter(userId, chapterId).then(async (chapter) => {
            const user = await prisma.user.findUnique({ where: { id: userId } });
            return { ...chapter, user };
        }),
    ]);
    return { assessment, userChapter };
};

const buildSubmissionSummary = ({
    questions,
    answerMap,
    userChapter,
    grade,
    correctAnswers,
    totalQuestions,
}) => {
    const isExcellent = grade >= 75;
    const newDifficulty = determineDifficulty(userChapter.currentDifficulty, grade);
    const aiFeedback = buildFeedback(grade, correctAnswers, totalQuestions);
    const orderedAnswers = questions.map((q) => answerMap.get(q.id) || '');

    return {
        isExcellent,
        newDifficulty,
        aiFeedback,
        orderedAnswers,
    };
};

const processLegacySubmission = async (userId, chapterId, answers = []) => {
    const answerMap = buildAnswerMap(answers);
    const { assessment, userChapter } = await getAssessmentAndUserContext(userId, chapterId);
    const questions = assessment?.questions || [];

    if (!assessment || questions.length === 0) {
        throw new Error('Assessment untuk chapter ini belum tersedia.');
    }

    const { evaluations, correctAnswers, assessableQuestions } = evaluateSubmission(questions, answerMap);
    const totalQuestions = assessableQuestions > 0 ? assessableQuestions : 1;
    const grade = Math.round(getCorrectnessRatio(correctAnswers, totalQuestions) * 100);

    const { pointsEarned, questionUpdates } = calculateEloOutcome({
        questions,
        evaluations,
        grade,
        totalQuestions,
        userElo: userChapter.user?.points || MIN_ELO,
    });

    const summary = buildSubmissionSummary({
        questions,
        answerMap,
        userChapter,
        grade,
        correctAnswers,
        totalQuestions,
    });

    const [updatedChapter] = await prisma.$transaction([
        prisma.userChapter.update({
            where: { id: userChapter.id },
            data: {
                isStarted: true,
                assessmentDone: true,
                assessmentGrade: grade,
                assessmentEloDelta: pointsEarned,
                assessmentAnswer: summary.orderedAnswers,
                currentDifficulty: summary.newDifficulty,
                lastAiFeedback: summary.aiFeedback,
                correctStreak: summary.isExcellent ? ((userChapter.correctStreak || 0) + 1) : 0,
                wrongStreak: summary.isExcellent ? 0 : ((userChapter.wrongStreak || 0) + 1),
                timeFinished: new Date(),
            },
        }),
        prisma.user.update({
            where: { id: userId },
            data: { points: { increment: pointsEarned } },
        }),
        ...questionUpdates.map((q) =>
            prisma.question.update({
                where: { id: q.questionId },
                data: { elo: Math.max(MIN_ELO, q.newElo) },
            }),
        ),
    ]);

    return {
        grade,
        pointsEarned,
        correctAnswers,
        totalQuestions,
        newDifficulty: summary.newDifficulty,
        aiFeedback: summary.aiFeedback,
        evaluations,
        userChapter: updatedChapter,
    };
};

const processAttemptSubmission = async (userId, chapterId, attemptId, answers = []) => {
    const normalizedAttemptId = Number(attemptId);
    if (!Number.isInteger(normalizedAttemptId)) {
        throw new Error('attemptId harus berupa angka');
    }

    const answerMap = buildAnswerMap(answers);
    const [attempt, userChapter] = await Promise.all([
        prisma.assessmentAttempt.findFirst({
            where: {
                id: normalizedAttemptId,
                userId,
                chapterId,
            },
            include: {
                questions: {
                    orderBy: { order: 'asc' },
                },
            },
        }),
        ensureUserChapter(userId, chapterId).then(async (chapter) => {
            const user = await prisma.user.findUnique({ where: { id: userId } });
            return { ...chapter, user };
        }),
    ]);

    if (!attempt) {
        throw new Error('Assessment attempt tidak ditemukan');
    }

    if (attempt.status !== ATTEMPT_STATUS.IN_PROGRESS) {
        throw new Error('Assessment attempt sudah disubmit atau tidak aktif');
    }

    const questions = attempt.questions || [];
    if (questions.length === 0) {
        throw new Error('Assessment attempt tidak memiliki soal');
    }

    const { evaluations, correctAnswers, assessableQuestions } = evaluateSubmission(questions, answerMap);
    const totalQuestions = assessableQuestions > 0 ? assessableQuestions : 1;
    const grade = Math.round(getCorrectnessRatio(correctAnswers, totalQuestions) * 100);

    const { pointsEarned, questionUpdates } = calculateEloOutcome({
        questions,
        evaluations,
        grade,
        totalQuestions,
        userElo: userChapter.user?.points || MIN_ELO,
    });

    const summary = buildSubmissionSummary({
        questions,
        answerMap,
        userChapter,
        grade,
        correctAnswers,
        totalQuestions,
    });

    const objectiveQuestionScore = Math.ceil(100 / totalQuestions);
    const evaluationByQuestionId = new Map(evaluations.map((evaluation) => [evaluation.questionId, evaluation]));
    const eloByQuestionId = new Map(questionUpdates.map((update) => [update.questionId, update.newElo]));

    const sourceQuestionUpdates = new Map();
    for (const question of questions) {
        const nextElo = eloByQuestionId.get(question.id);
        if (!Number.isFinite(nextElo)) {
            continue;
        }
        if (Number.isInteger(question.sourceQuestionId)) {
            sourceQuestionUpdates.set(question.sourceQuestionId, nextElo);
        }
    }

    const transactionOperations = [
        prisma.userChapter.update({
            where: { id: userChapter.id },
            data: {
                isStarted: true,
                assessmentDone: true,
                assessmentGrade: grade,
                assessmentEloDelta: pointsEarned,
                assessmentAnswer: summary.orderedAnswers,
                currentDifficulty: summary.newDifficulty,
                lastAiFeedback: summary.aiFeedback,
                correctStreak: summary.isExcellent ? ((userChapter.correctStreak || 0) + 1) : 0,
                wrongStreak: summary.isExcellent ? 0 : ((userChapter.wrongStreak || 0) + 1),
                timeFinished: new Date(),
            },
        }),
        prisma.user.update({
            where: { id: userId },
            data: { points: { increment: pointsEarned } },
        }),
        prisma.assessmentAttempt.update({
            where: { id: attempt.id },
            data: {
                status: ATTEMPT_STATUS.SUBMITTED,
                grade,
                pointsEarned,
                correctAnswers,
                totalQuestions,
                newDifficulty: summary.newDifficulty,
                aiFeedback: summary.aiFeedback,
                submittedAt: new Date(),
            },
        }),
        ...questions.map((question) => {
            const evaluation = evaluationByQuestionId.get(question.id);
            const isEssay = normaliseAttemptQuestionType(question.type) === 'EY';
            const currentAnswer = answerMap.get(question.id) || '';
            const nextElo = eloByQuestionId.get(question.id);

            return prisma.assessmentAttemptQuestion.update({
                where: { id: question.id },
                data: {
                    submittedAnswer: currentAnswer,
                    isCorrect: isEssay ? false : (evaluation?.isCorrect || false),
                    score: isEssay ? 0 : ((evaluation?.isCorrect || false) ? objectiveQuestionScore : 0),
                    elo: Math.max(MIN_ELO, Number.isFinite(nextElo) ? nextElo : clampElo(question.elo)),
                },
            });
        }),
        ...Array.from(sourceQuestionUpdates.entries()).map(([sourceQuestionId, nextElo]) =>
            prisma.question.update({
                where: { id: sourceQuestionId },
                data: { elo: Math.max(MIN_ELO, nextElo) },
            }),
        ),
    ];

    const [updatedChapter] = await prisma.$transaction(transactionOperations);

    return {
        attemptId: attempt.id,
        grade,
        pointsEarned,
        correctAnswers,
        totalQuestions,
        newDifficulty: summary.newDifficulty,
        aiFeedback: summary.aiFeedback,
        evaluations,
        userChapter: updatedChapter,
    };
};

exports.getAllAssessments = async () => {
    try {
        return await prisma.assessment.findMany({
            include: { questions: true },
        });
    } catch (error) {
        throw new Error(error.message);
    }
};

exports.getAssessmentById = async (id) => {
    try {
        return await prisma.assessment.findUnique({
            where: { id },
            include: { questions: true },
        });
    } catch (error) {
        throw new Error(error.message);
    }
};

exports.createAssessment = async (newData) => {
    try {
        let questionsToCreate = [];
        if (newData.questions) {
            questionsToCreate = await ensureQuestionsElo(newData.questions);
            delete newData.questions;
        }

        return await prisma.assessment.create({
            data: {
                ...newData,
                questions: {
                    create: questionsToCreate.map((q) => ({
                        question: q.question || '',
                        type: normaliseAttemptQuestionType(q.type || 'MC') || 'MC',
                        options: q.options || [],
                        answer: q.answer || null,
                        correctedAnswer: q.correctedAnswer || null,
                        elo: clampElo(q.elo),
                    })),
                },
            },
            include: { questions: true },
        });
    } catch (error) {
        throw new Error(error.message);
    }
};

exports.updateAssessment = async (id, updateData) => {
    try {
        if (updateData.questions) {
            const questionsToCreate = await ensureQuestionsElo(updateData.questions);
            delete updateData.questions;

            await prisma.question.deleteMany({ where: { assessmentId: id } });

            return await prisma.assessment.update({
                where: { id },
                data: {
                    ...updateData,
                    questions: {
                        create: questionsToCreate.map((q) => ({
                            question: q.question || '',
                            type: normaliseAttemptQuestionType(q.type || 'MC') || 'MC',
                            options: q.options || [],
                            answer: q.answer || null,
                            correctedAnswer: q.correctedAnswer || null,
                            elo: clampElo(q.elo),
                        })),
                    },
                },
                include: { questions: true },
            });
        }

        return await prisma.assessment.update({
            where: { id },
            data: updateData,
            include: { questions: true },
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

exports.startAttempt = async (userId, chapterId, forceNew = false) => {
    if (!userId || !chapterId) {
        throw new Error('userId dan chapterId wajib diisi');
    }

    const normalizedUserId = Number(userId);
    const normalizedChapterId = Number(chapterId);
    if (!Number.isInteger(normalizedUserId) || !Number.isInteger(normalizedChapterId)) {
        throw new Error('userId dan chapterId harus berupa angka');
    }

    const existingAttempt = await prisma.assessmentAttempt.findFirst({
        where: {
            userId: normalizedUserId,
            chapterId: normalizedChapterId,
            status: ATTEMPT_STATUS.IN_PROGRESS,
        },
        include: {
            questions: { orderBy: { order: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
    });

    if (existingAttempt && !forceNew) {
        return formatAttemptResponse(existingAttempt, true);
    }

    if (existingAttempt && forceNew) {
        await prisma.assessmentAttempt.updateMany({
            where: {
                userId: normalizedUserId,
                chapterId: normalizedChapterId,
                status: ATTEMPT_STATUS.IN_PROGRESS,
            },
            data: { status: ATTEMPT_STATUS.ABANDONED },
        });
    }

    const [user, chapter, assessment] = await Promise.all([
        prisma.user.findUnique({ where: { id: normalizedUserId } }),
        prisma.chapter.findUnique({
            where: { id: normalizedChapterId },
            include: {
                materials: {
                    take: 1,
                    orderBy: { id: 'asc' },
                },
            },
        }),
        prisma.assessment.findFirst({
            where: { chapterId: normalizedChapterId },
            include: { questions: true },
        }),
    ]);

    if (!chapter) {
        throw new Error('Chapter tidak ditemukan');
    }

    await ensureUserChapter(normalizedUserId, normalizedChapterId);

    const userElo = Math.max(MIN_ELO, user?.points || MIN_ELO);
    let source = ATTEMPT_SOURCE.GENERATED;
    let instruction = buildAttemptInstruction(chapter.name);
    let questionsForAttempt = [];

    try {
        const generated = await generateAttemptQuestionsWithLLM({
            chapter,
            material: chapter.materials?.[0] || null,
            userElo,
        });
        instruction = generated.instruction;
        questionsForAttempt = generated.questions;
    } catch (error) {
        console.error('LLM generation failed, fallback to bank:', error.message);
        source = ATTEMPT_SOURCE.FALLBACK_BANK;
        if (!assessment || !assessment.questions || assessment.questions.length === 0) {
            throw new Error('LLM gagal dan bank soal fallback tidak tersedia.');
        }
        questionsForAttempt = buildFallbackQuestionsFromBank(assessment.questions, userElo);
    }

    if (!questionsForAttempt.length) {
        throw new Error('Gagal membangun soal assessment untuk attempt baru.');
    }

    const createdAttempt = await prisma.assessmentAttempt.create({
        data: {
            userId: normalizedUserId,
            chapterId: normalizedChapterId,
            assessmentId: assessment?.id || null,
            status: ATTEMPT_STATUS.IN_PROGRESS,
            source,
            instruction,
            questions: {
                create: questionsForAttempt.map((q, index) => ({
                    sourceQuestionId: Number.isInteger(q.sourceQuestionId) ? q.sourceQuestionId : null,
                    question: q.question,
                    type: normaliseAttemptQuestionType(q.type) || 'MC',
                    options: q.options || [],
                    answer: q.answer || null,
                    correctedAnswer: q.correctedAnswer || null,
                    elo: clampElo(q.elo),
                    order: index + 1,
                })),
            },
        },
        include: {
            questions: {
                orderBy: { order: 'asc' },
            },
        },
    });

    return formatAttemptResponse(createdAttempt, false);
};

exports.getCurrentAttempt = async (userId, chapterId) => {
    if (!userId || !chapterId) {
        throw new Error('userId dan chapterId wajib diisi');
    }

    const normalizedUserId = Number(userId);
    const normalizedChapterId = Number(chapterId);
    if (!Number.isInteger(normalizedUserId) || !Number.isInteger(normalizedChapterId)) {
        throw new Error('userId dan chapterId harus berupa angka');
    }

    const attempt = await prisma.assessmentAttempt.findFirst({
        where: {
            userId: normalizedUserId,
            chapterId: normalizedChapterId,
            status: ATTEMPT_STATUS.IN_PROGRESS,
        },
        include: {
            questions: {
                orderBy: { order: 'asc' },
            },
        },
        orderBy: { createdAt: 'desc' },
    });

    return formatAttemptResponse(attempt, true);
};

exports.getLatestAttempt = async (userId, chapterId) => {
    if (!userId || !chapterId) {
        throw new Error('userId dan chapterId wajib diisi');
    }

    const normalizedUserId = Number(userId);
    const normalizedChapterId = Number(chapterId);
    if (!Number.isInteger(normalizedUserId) || !Number.isInteger(normalizedChapterId)) {
        throw new Error('userId dan chapterId harus berupa angka');
    }

    const attempt = await prisma.assessmentAttempt.findFirst({
        where: {
            userId: normalizedUserId,
            chapterId: normalizedChapterId,
            status: ATTEMPT_STATUS.SUBMITTED,
        },
        include: {
            questions: {
                orderBy: { order: 'asc' },
            },
        },
        orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return formatAttemptResponse(attempt, false);
};

exports.processSubmission = async (userId, chapterId, answers = [], attemptId = null) => {
    if (!userId || !chapterId) {
        throw new Error('userId and chapterId are required');
    }

    const normalizedUserId = Number(userId);
    const normalizedChapterId = Number(chapterId);
    if (!Number.isInteger(normalizedUserId) || !Number.isInteger(normalizedChapterId)) {
        throw new Error('userId and chapterId must be numeric');
    }

    if (attemptId !== null && attemptId !== undefined) {
        return processAttemptSubmission(normalizedUserId, normalizedChapterId, attemptId, answers);
    }

    return processLegacySubmission(normalizedUserId, normalizedChapterId, answers);
};
