const prisma = require('../prismaClient');
const evaluationService = require('./EvaluationService');
const { GoogleAIClient } = require('./GoogleAIClient');
const {
    clampElo,
    MIN_ELO,
    DEFAULT_ELO,
    ELO_BANDS,
    calculateQuestionDuelElo,
    determineDifficulty,
    determineUserKFactor,
    determineQuestionKFactor,
    resolveBandIndex,
    getBandTraversalOrder,
    sortByDistanceToTarget
} = require('../utils/elo');

const ATTEMPT_STATUS = {
    IN_PROGRESS: 'IN_PROGRESS',
    SUBMITTED: 'SUBMITTED',
    ABANDONED: 'ABANDONED',
};

const ATTEMPT_SOURCE = {
    GENERATED: 'GENERATED',
    FALLBACK_BANK: 'FALLBACK_BANK',
};

const ATTEMPT_POOL_SIZE = 12;
const ATTEMPT_OBJECTIVE_TARGET = 5;
const ATTEMPT_TOTAL_TARGET = 6;
const FIRST_QUESTION_ELO = 800;
const DISPLAY_OBJECTIVE_COMPOSITION = {
    MC: 4,
    TF: 1,
};
const GENERATED_POOL_COMPOSITION = {
    MC: 9,
    TF: 2,
    EY: 0,
};

const ASSESSMENT_GENERATION_CONFIG = (() => {
    const maxOutputTokens = Number(process.env.LEVELY_ASSESSMENT_GEMINI_MAX_OUTPUT_TOKENS || 2048);
    const temperature = Number(process.env.LEVELY_ASSESSMENT_GEMINI_TEMPERATURE || 0.15);
    const topP = Number(process.env.LEVELY_ASSESSMENT_GEMINI_TOP_P || 0.8);

    const config = {};
    if (Number.isFinite(maxOutputTokens) && maxOutputTokens > 0) {
        config.maxOutputTokens = maxOutputTokens;
    }
    if (Number.isFinite(temperature)) {
        config.temperature = temperature;
    }
    if (Number.isFinite(topP) && topP > 0 && topP <= 1) {
        config.topP = topP;
    }

    return config;
})();


const INTERACTIVE_TX_OPTIONS = {
    maxWait: 20000,
    timeout: 45000,
};

const DIFFICULTY_ENUM = {
    BEGINNER: 'BEGINNER',
    BASIC_UNDERSTANDING: 'BASIC_UNDERSTANDING',
    DEVELOPING_LEARNER: 'DEVELOPING_LEARNER',
    INTERMEDIATE: 'INTERMEDIATE',
    PROFICIENT: 'PROFICIENT',
    ADVANCED: 'ADVANCED',
    MASTERY: 'MASTERY',
};

const BAND_NAME_TO_ENUM = {
    'Beginner': 'BEGINNER',
    'Basic Understanding': 'BASIC_UNDERSTANDING',
    'Developing Learner': 'DEVELOPING_LEARNER',
    'Intermediate': 'INTERMEDIATE',
    'Proficient': 'PROFICIENT',
    'Advanced': 'ADVANCED',
    'Mastery': 'MASTERY',
};

const toPrismaDifficulty = (bandNameOrElo) => {
    const raw = String(bandNameOrElo || '').trim();
    if (!raw) {
        return DIFFICULTY_ENUM.BEGINNER;
    }

    if (DIFFICULTY_ENUM[raw]) {
        return DIFFICULTY_ENUM[raw];
    }

    if (BAND_NAME_TO_ENUM[raw]) {
        return BAND_NAME_TO_ENUM[raw];
    }

    const numeric = Number(raw);
    if (Number.isFinite(numeric)) {
        const bandName = determineDifficulty(numeric);
        return BAND_NAME_TO_ENUM[bandName] || DIFFICULTY_ENUM.BEGINNER;
    }

    return DIFFICULTY_ENUM.BEGINNER;
};

const getCorrectnessRatio = (correct, total) => {
    if (!total) {
        return 0;
    }
    return correct / total;
};

const buildFeedback = (grade, correct) => {
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
    const existing = await prisma.userChapter.findFirst({
        where: { userId, chapterId },
    });
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

const ensureUserChapterTx = async (tx, userId, chapterId) => {
    const existing = await tx.userChapter.findFirst({
        where: { userId, chapterId },
    });
    if (existing) {
        return existing;
    }

    return tx.userChapter.create({
        data: {
            userId,
            chapterId,
            isStarted: true,
        },
    });
};

const ensureUserCourse = async (userId, courseId) => {
    const existing = await prisma.userCourse.findFirst({
        where: { userId, courseId },
    });
    if (existing) {
        return existing;
    }

    return prisma.userCourse.create({
        data: {
            userId,
            courseId,
            elo: MIN_ELO,
        },
    });
};

const ensureUserCourseTx = async (tx, userId, courseId) => {
    const existing = await tx.userCourse.findFirst({
        where: { userId, courseId },
    });
    if (existing) {
        return existing;
    }

    return tx.userCourse.create({
        data: {
            userId,
            courseId,
            elo: MIN_ELO,
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

const normalizeTextOptions = (raw) => {
    if (!Array.isArray(raw)) {
        return [];
    }
    return raw
        .map((item) => String(item ?? '').trim())
        .filter((item) => item.length > 0);
};

const isValidTrueFalseStem = (text) => {
    const stem = String(text || '').trim();
    if (!stem) {
        return false;
    }

    const lower = stem.toLowerCase();
    const interrogativePatterns = [
        /\bsiapa\b/,
        /\bkapan\b/,
        /\bdi\s*mana\b/,
        /\bdimana\b/,
        /\bberapa\b/,
        /\bmana\b/,
        /\bmengapa\b/,
        /\bkenapa\b/,
    ];
    if (interrogativePatterns.some((pattern) => pattern.test(lower))) {
        return false;
    }

    if (lower.endsWith('?') || lower.endsWith(':')) {
        return false;
    }

    return true;
};

const isValidObjectiveQuestion = (question) => {
    const type = normaliseAttemptQuestionType(question?.type);
    if (type === 'MC') {
        return true;
    }
    if (type === 'TF') {
        return isValidTrueFalseStem(question?.question);
    }
    return false;
};

const matchOptionCaseInsensitive = (options = [], answer = '') => {
    const normalizedAnswer = String(answer || '').trim().toLowerCase();
    if (!normalizedAnswer) {
        return null;
    }
    const found = options.find((option) => option.toLowerCase() === normalizedAnswer);
    return found || null;
};

const isStudentRole = (role) => String(role || '').toUpperCase() === 'STUDENT';

const createSeededRandom = (seed) => {
    let s = seed + 1831565813;
    return () => {
        s = Math.imul(s ^ (s >>> 15), 1 | s);
        s ^= s + Math.imul(s ^ (s >>> 7), 61 | s);
        return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
    };
};

const shuffleArray = (arr = []) => [...arr].sort(() => Math.random() - 0.5);

const shuffleArraySeeded = (arr = [], seed = 12345) => {
    const random = createSeededRandom(seed);
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]]; // Swap
    }
    return result;
};

const parseJsonPayload = (text) => {
    if (typeof text !== 'string' || !text.trim()) {
        throw new Error('LLM response is empty');
    }

    const stripCodeFences = (value) =>
        String(value || '')
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();

    const extractBalancedJson = (value, openChar, closeChar) => {
        const source = String(value || '');
        const start = source.indexOf(openChar);
        if (start < 0) {
            return null;
        }

        let depth = 0;
        let inString = false;
        let escaped = false;

        for (let index = start; index < source.length; index += 1) {
            const char = source[index];

            if (inString) {
                if (escaped) {
                    escaped = false;
                    continue;
                }
                if (char === '\\') {
                    escaped = true;
                    continue;
                }
                if (char === '"') {
                    inString = false;
                }
                continue;
            }

            if (char === '"') {
                inString = true;
                continue;
            }

            if (char === openChar) {
                depth += 1;
                continue;
            }

            if (char === closeChar) {
                depth -= 1;
                if (depth === 0) {
                    return source.slice(start, index + 1);
                }
            }
        }

        return null;
    };

    const sanitizeLooseJson = (value) =>
        String(value || '')
            .replace(/\u201c|\u201d/g, '"')
            .replace(/\u2018|\u2019/g, "'")
            .replace(/,\s*([}\]])/g, '$1')
            .trim();

    const trimmed = text.trim();
    const directCandidates = [trimmed, stripCodeFences(trimmed)];
    const fragments = [];

    for (const candidate of directCandidates) {
        if (!candidate) {
            continue;
        }
        fragments.push(candidate);

        const objectChunk = extractBalancedJson(candidate, '{', '}');
        if (objectChunk) {
            fragments.push(objectChunk);
        }

        const arrayChunk = extractBalancedJson(candidate, '[', ']');
        if (arrayChunk) {
            fragments.push(arrayChunk);
        }
    }

    const tried = new Set();
    for (const fragment of fragments) {
        if (!fragment || tried.has(fragment)) {
            continue;
        }
        tried.add(fragment);

        const candidates = [fragment, sanitizeLooseJson(fragment)];
        for (const candidate of candidates) {
            if (!candidate || tried.has(`parsed:${candidate}`)) {
                continue;
            }
            tried.add(`parsed:${candidate}`);
            try {
                return JSON.parse(candidate);
            } catch (_error) {
                // continue to next fallback
            }
        }
    }

    throw new Error('Failed to parse JSON payload from LLM response');
};

const inferGeneratedType = (questionData) => {
    const declaredType = normaliseAttemptQuestionType(questionData?.type);
    const options = normalizeTextOptions(questionData?.options ?? questionData?.option ?? []);

    if (declaredType === 'MC' && options.length === 2) {
        const normalized = options.map((item) => item.toLowerCase());
        if (normalized.includes('true') && normalized.includes('false')) {
            return 'TF';
        }
    }

    if (declaredType) {
        return declaredType;
    }

    if (options.length > 0) {
        const normalized = options.map((item) => item.toLowerCase());
        const hasTrueFalse = normalized.includes('true') && normalized.includes('false') && options.length <= 2;
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
        correctedAnswer = matchOptionCaseInsensitive(options, correctedAnswer) || options[0];
    } else if (type === 'TF') {
        if (!isValidTrueFalseStem(questionText)) {
            throw new Error(`Soal TF harus berupa pernyataan faktual pada index ${index + 1}`);
        }
        options = ['True', 'False'];
        const normalized = correctedAnswer.toLowerCase();
        if (normalized === 'true') {
            correctedAnswer = 'True';
        } else if (normalized === 'false') {
            correctedAnswer = 'False';
        } else {
            correctedAnswer = 'True';
        }
    } else {
        options = [];
        if (!correctedAnswer) {
            correctedAnswer = 'Jawaban esai berdasarkan materi pada chapter ini.';
        }
    }

    return {
        sourceQuestionId: null,
        question: questionText,
        type,
        options,
        answer: correctedAnswer,
        correctedAnswer,
        elo: clampElo(questionData?.elo),
    };
};

const normalizeStoredQuestion = (question) => {
    let type = normaliseAttemptQuestionType(question.type);
    let options = normalizeTextOptions(question.options || []);
    let correctedAnswer = String(question.correctedAnswer || question.answer || '').trim();

    if (type === 'TF') {
        if (!isValidTrueFalseStem(question.question)) {
            return {
                sourceQuestionId: question.id ?? null,
                question: String(question.question || '').trim(),
                type: 'EY',
                options: [],
                answer: correctedAnswer || null,
                correctedAnswer: correctedAnswer || null,
                elo: clampElo(question.elo),
            };
        }
        options = ['True', 'False'];
        correctedAnswer = correctedAnswer.toLowerCase() === 'false' ? 'False' : 'True';
    } else if (type === 'MC') {
        const normalizedOptions = options.map((item) => item.toLowerCase());
        if (options.length === 2 && normalizedOptions.includes('true') && normalizedOptions.includes('false')) {
            type = 'TF';
            options = ['True', 'False'];
            correctedAnswer = correctedAnswer.toLowerCase() === 'false' ? 'False' : 'True';
        } else {
            if (options.length > 4) {
                options = options.slice(0, 4);
            }
            correctedAnswer = matchOptionCaseInsensitive(options, correctedAnswer) || options[0] || correctedAnswer;
        }
    } else if (type === 'EY' && !correctedAnswer) {
        correctedAnswer = String(question.answer || '').trim();
    }

    return {
        sourceQuestionId: question.id ?? null,
        question: String(question.question || '').trim(),
        type: type || 'MC',
        options,
        answer: correctedAnswer || null,
        correctedAnswer: correctedAnswer || null,
        elo: clampElo(question.elo),
    };
};

const normaliseGeneratedPoolQuestions = (rawQuestions, chapterName = 'chapter', userElo = 1200) => {
    if (!Array.isArray(rawQuestions)) {
        throw new Error('Generated questions payload must be an array');
    }

    if (rawQuestions.length < (ATTEMPT_POOL_SIZE - 1)) {
        throw new Error(`Generated questions must be at least ${ATTEMPT_POOL_SIZE - 1}`);
    }

    const normalizedPool = rawQuestions.map((questionData, index) =>
        normalizeGeneratedQuestion(questionData, index),
    );

    const mc = shuffleArray(normalizedPool.filter((q) => q.type === 'MC'));
    const tf = shuffleArray(normalizedPool.filter((q) => q.type === 'TF'));

    if (mc.length < GENERATED_POOL_COMPOSITION.MC || tf.length < GENERATED_POOL_COMPOSITION.TF) {
        throw new Error('Komposisi soal objektif dari LLM tidak memenuhi 9 MC + 2 TF');
    }

    const staticEssay = {
        sourceQuestionId: null,
        question: `Jelaskan kembali konsep inti pada bab "${chapterName}" dengan bahasamu sendiri sebagai rumusan pemahaman Anda.`,
        type: 'EY',
        options: [],
        answer: 'Feedback esai dari peserta (tidak dinilai dalam sistem Elo).',
        correctedAnswer: 'Feedback esai dari peserta (tidak dinilai dalam sistem Elo).',
        elo: clampElo(userElo),
    };

    const selected = [
        ...mc.slice(0, GENERATED_POOL_COMPOSITION.MC),
        ...tf.slice(0, GENERATED_POOL_COMPOSITION.TF),
        staticEssay,
    ];

    return shuffleArray(selected).slice(0, ATTEMPT_POOL_SIZE);
};

const sortQuestionsByServedThenOrder = (a, b) => {
    const servedA = Number.isInteger(a.servedOrder) ? a.servedOrder : Number.MAX_SAFE_INTEGER;
    const servedB = Number.isInteger(b.servedOrder) ? b.servedOrder : Number.MAX_SAFE_INTEGER;
    if (servedA !== servedB) {
        return servedA - servedB;
    }
    return (a.order || 0) - (b.order || 0);
};

const stripHtml = (content = '') =>
    String(content || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const buildAttemptInstruction = (chapterName) =>
    `Kerjakan assessment adaptif bab "${chapterName}" dengan fokus. Kamu akan mengerjakan 6 soal (5 objektif + 1 essay).`;

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
    const apiKey = (process.env.GOOGLE_AI_API_KEY || '').trim();
    const model = process.env.LEVELY_LLM_MODEL || 'gemma-3-12b-it';
    const baseUrl =
        process.env.LEVELY_GEMINI_BASE_URL ||
        'https://generativelanguage.googleapis.com/v1beta/models';
    const isVertex = baseUrl.includes('aiplatform.googleapis.com');

    if (!apiKey && !isVertex) {
        return null;
    }

    return new GoogleAIClient({ apiKey, model, baseUrl });
};

const buildGenerationPrompt = ({ chapterName, chapterDescription, materialContent, userElo }) => {
    return `
Anda adalah asisten pengajar profesional di aplikasi Levelearn.

Tugas:
- Buat EXACT 11 soal objektif berbahasa Indonesia untuk materi chapter ini.
- Komposisi WAJIB: 9 soal Multiple Choice (MC) dan 2 soal True/False (TF).
- ATURAN KETAT Multiple Choice (MC):
  1. WAJIB memiliki tepat 4 opsi jawaban (options) yang unik dan beralasan.
  2. TIDAK BOLEH ada opsi seperti "Semua jawaban benar" atau "Tidak ada jawaban yang benar".
  3. "correctedAnswer" WAJIB sama persis (huruf per huruf) dengan salah satu opsi di dalam array "options".
  4. Properti "type" wajib bernilai "MC".
- ATURAN KETAT True/False (TF):
  1. Soal WAJIB berupa pernyataan faktual yang bisa dinilai kebenarannya (BUKAN kalimat tanya, TIDAK memakai kata "siapa/kapan/dimana/berapa", dan BUKAN diakhiri tanda "?").
  2. Properti "options" WAJIB hanya berisi tepat 2 elemen berupa string literal: ["True", "False"].
  3. "correctedAnswer" WAJIB bernilai "True" atau "False".
  4. Properti "type" wajib bernilai "TF".
- Setiap soal wajib memiliki properti "elo" berupa bilangan bulat antara 750 hingga 3000.
- Sesuaikan tingkat kompleksitas/kesulitan soal dengan target Elo siswa saat ini.

Konteks chapter:
- Nama: ${chapterName}
- Deskripsi: ${chapterDescription || '-'}
- Target Elo siswa saat ini: ${userElo}
- Ringkasan materi:
"""
${materialContent || '-'}
"""

Kembalikan respon HANYA dalam format JSON teks murni (tanpa markdown fence \`\`\`json). Format skema JSON yang diwajibkan:
{
  "instruction": "Instruksi pengerjaan",
  "questions": [
    {
      "question": "teks pernyataan atau pertanyaan",
      "type": "format (MC atau TF)",
      "options": ["opsi1", "opsi2", "opsi3", "opsi4"],
      "correctedAnswer": "opsi jawaban yang benar",
      "elo": 1200
    }
  ]
}
PENTING:
- Seluruh output WAJIB valid JSON (RFC 8259) dan bisa diparse langsung dengan JSON.parse.
- Jika ada tanda kutip ganda di dalam nilai string, WAJIB di-escape menjadi \\".
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
                generationConfig: ASSESSMENT_GENERATION_CONFIG,
            });

            const parsed = parseJsonPayload(raw);
            const payload = Array.isArray(parsed) ? { questions: parsed } : parsed;
            const instruction =
                String(payload?.instruction || '').trim() ||
                buildAttemptInstruction(chapter?.name || 'Assessment');
            const questions = normaliseGeneratedPoolQuestions(payload?.questions, chapter?.name || 'chapter', userElo);

            return { instruction, questions };
        } catch (error) {
            lastError = error;
            console.error(`LLM attempt generation failed at try ${attempt}:`, error.message);
        }
    }

    throw lastError || new Error('LLM generation failed');
};

const buildFallbackPoolFromBank = (questions = [], userElo = MIN_ELO, chapterName = 'chapter', seedParams = {}) => {
    if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('Fallback bank kosong');
    }

    // Buat seed deterministik berdasarkan userId, chapterId, dan userElo
    const seedString = `${seedParams.userId || 0}_${seedParams.chapterId || 0}_${userElo}_${chapterName.length}`;
    let seedNumber = 0;
    for (let i = 0; i < seedString.length; i++) {
        seedNumber = (seedNumber * 31 + seedString.charCodeAt(i)) | 0;
    }

    const normalized = questions.map((q) => normalizeStoredQuestion(q)).filter((q) => q.question.length > 0);
    const objective = normalized.filter((q) => isValidObjectiveQuestion(q));
    const essays = normalized.filter((q) => normaliseAttemptQuestionType(q.type) === 'EY');

    if (objective.length === 0) {
        throw new Error('Fallback bank tidak memiliki soal objektif.');
    }

    const sortByDistance = (list) =>
        [...list].sort((a, b) => {
            const diffA = Math.abs(clampElo(a.elo) - userElo);
            const diffB = Math.abs(clampElo(b.elo) - userElo);
            if (diffA !== diffB) return diffA - diffB;
            return clampElo(a.elo) - clampElo(b.elo); // tie-breaker
        });

    const objectiveSorted = sortByDistance(objective);
    // Potong 3x pool size sebagai kandidat
    const objectivePool = objectiveSorted.slice(0, Math.max(ATTEMPT_POOL_SIZE * 3, objectiveSorted.length));

    // Ganti pengacakan pool lokal dengan seeded shuffle
    const shuffledObjectivePool = shuffleArraySeeded(objectivePool, seedNumber);

    const selectedObjective = [];
    for (const item of shuffledObjectivePool) {
        if (selectedObjective.length >= ATTEMPT_POOL_SIZE - 1) {
            break;
        }
        selectedObjective.push({ ...item, options: shuffleArraySeeded([...(item.options || [])], seedNumber + item.sourceQuestionId + 1) });
    }

    let cursor = 0;
    while (selectedObjective.length < ATTEMPT_POOL_SIZE - 1) {
        const source = objectiveSorted[cursor % objectiveSorted.length];
        selectedObjective.push({ ...source, options: [...(source.options || [])] });
        cursor += 1;
    }

    const pickedEssay = essays.length > 0
        ? sortByDistance(essays)[0]
        : {
            sourceQuestionId: null,
            question: `Jelaskan kembali konsep inti pada bab "${chapterName}" dengan bahasamu sendiri.`,
            type: 'EY',
            options: [],
            answer: 'Jawaban esai bersifat terbuka sesuai isi materi bab ini.',
            correctedAnswer: 'Jawaban esai bersifat terbuka sesuai isi materi bab ini.',
            elo: clampElo(userElo),
        };

    const finalPool = [
        ...selectedObjective.slice(0, ATTEMPT_POOL_SIZE - 1),
        { ...pickedEssay, options: [...(pickedEssay.options || [])] },
    ];

    // Gunakan seeded random agar hasil set pool akhir stabil pada reset ke berapa pun
    return shuffleArraySeeded(finalPool, seedNumber + 999).slice(0, ATTEMPT_POOL_SIZE);
};

const buildSimplePoolFromBank = (questions = [], userElo = MIN_ELO, chapterName = 'chapter') => {
    if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('Bank soal kosong');
    }

    const normalized = questions
        .map((q) => normalizeStoredQuestion(q))
        .filter((q) => q.question.length > 0);

    if (normalized.length === 0) {
        throw new Error('Bank soal tidak memiliki soal valid');
    }

    const withDistance = (list) =>
        [...list]
            .sort((a, b) => {
                const diffA = Math.abs(clampElo(a.elo) - userElo);
                const diffB = Math.abs(clampElo(b.elo) - userElo);
                if (diffA !== diffB) {
                    return diffA - diffB;
                }
                return clampElo(a.elo) - clampElo(b.elo);
            })
            .map((item) => ({
                ...item,
                options: [...(item.options || [])],
            }));

    const mc = withDistance(normalized.filter((q) => q.type === 'MC'));
    const tf = withDistance(normalized.filter((q) => q.type === 'TF'));
    const ey = withDistance(normalized.filter((q) => q.type === 'EY'));

    const selected = [];
    const selectedKeys = new Set();

    const keyOf = (item) => {
        if (Number.isInteger(item.sourceQuestionId)) {
            return `source:${item.sourceQuestionId}`;
        }
        return `text:${item.type}:${item.question}`;
    };

    const takeFrom = (list, count) => {
        for (const item of list) {
            if (selected.length >= ATTEMPT_POOL_SIZE) {
                break;
            }
            if (count <= 0) {
                break;
            }

            const key = keyOf(item);
            if (selectedKeys.has(key)) {
                continue;
            }

            selected.push(item);
            selectedKeys.add(key);
            count -= 1;
        }
        return count;
    };

    let remainingMc = takeFrom(mc, GENERATED_POOL_COMPOSITION.MC);
    let remainingTf = takeFrom(tf, GENERATED_POOL_COMPOSITION.TF);

    // If MC/TF stock is uneven, fill objective quota from any objective type.
    const objectiveQuota = ATTEMPT_POOL_SIZE - GENERATED_POOL_COMPOSITION.EY;
    if (remainingMc > 0 || remainingTf > 0 || selected.length < objectiveQuota) {
        const objectiveCombined = withDistance([...mc, ...tf]);
        let remainingObjective = objectiveQuota - selected.length;
        takeFrom(objectiveCombined, remainingObjective);
        remainingObjective = objectiveQuota - selected.length;

        // Last safety net: allow duplicates when bank objective stock is very small.
        if (remainingObjective > 0 && objectiveCombined.length > 0) {
            let cursor = 0;
            while (remainingObjective > 0) {
                const src = objectiveCombined[cursor % objectiveCombined.length];
                selected.push({ ...src, options: [...(src.options || [])] });
                remainingObjective -= 1;
                cursor += 1;
            }
        }
    }

    const pickedEssay = ey[0]
        ? { ...ey[0], options: [...(ey[0].options || [])] }
        : {
            sourceQuestionId: null,
            question: `Jelaskan kembali konsep inti pada bab "${chapterName}" dengan bahasamu sendiri.`,
            type: 'EY',
            options: [],
            answer: 'Jawaban esai bersifat terbuka sesuai isi materi bab ini.',
            correctedAnswer: 'Jawaban esai bersifat terbuka sesuai isi materi bab ini.',
            elo: clampElo(userElo),
        };

    const poolWithEssay = [...selected.slice(0, ATTEMPT_POOL_SIZE - 1), pickedEssay];
    return shuffleArray(poolWithEssay).slice(0, ATTEMPT_POOL_SIZE);
};

const ensureAssessmentBankForChapter = async (chapterId, chapterName = 'Assessment') => {
    const existing = await prisma.assessment.findFirst({
        where: { chapterId },
        include: { questions: true },
        orderBy: { id: 'asc' },
    });

    if (existing) {
        return existing;
    }

    return prisma.assessment.create({
        data: {
            chapterId,
            instruction: buildAttemptInstruction(chapterName),
        },
        include: { questions: true },
    });
};

const saveGeneratedQuestionsToBank = async (assessmentId, generatedQuestions = []) => {
    if (!Number.isInteger(assessmentId) || !Array.isArray(generatedQuestions) || generatedQuestions.length === 0) {
        return [];
    }

    const created = [];
    for (const item of generatedQuestions) {
        const row = await prisma.question.create({
            data: {
                assessmentId,
                question: item.question || '',
                type: normaliseAttemptQuestionType(item.type || 'MC') || 'MC',
                options: item.options || [],
                answer: item.answer || null,
                correctedAnswer: item.correctedAnswer || null,
                elo: clampElo(item.elo),
            },
        });
        created.push(row);
    }

    return created;
};

const findActiveQuestion = (questions = []) => {
    const sorted = [...questions].sort(sortQuestionsByServedThenOrder);
    return sorted.find((q) => Number.isInteger(q.servedOrder) && !q.answeredAt) || null;
};

const getServedObjectiveTypeCounts = (questions = []) => {
    let mcServed = 0;
    let tfServed = 0;

    for (const q of questions) {
        if (!Number.isInteger(q.servedOrder) || !isValidObjectiveQuestion(q)) {
            continue;
        }
        const type = normaliseAttemptQuestionType(q.type);
        if (type === 'MC') {
            mcServed += 1;
        } else if (type === 'TF') {
            tfServed += 1;
        }
    }

    return {
        mcServed,
        tfServed,
        totalServed: mcServed + tfServed,
    };
};

const getPreferredObjectiveTypes = (questions = [], objectiveTarget = ATTEMPT_OBJECTIVE_TARGET) => {
    const served = getServedObjectiveTypeCounts(questions);
    const remainingSlots = Math.max(0, objectiveTarget - served.totalServed);
    const remainingMc = Math.max(0, DISPLAY_OBJECTIVE_COMPOSITION.MC - served.mcServed);
    const remainingTf = Math.max(0, DISPLAY_OBJECTIVE_COMPOSITION.TF - served.tfServed);

    const preferred = new Set();

    if (remainingSlots <= remainingTf && remainingTf > 0) {
        preferred.add('TF');
    }
    if (remainingSlots <= remainingMc && remainingMc > 0) {
        preferred.add('MC');
    }

    if (preferred.size === 0) {
        if (remainingMc > 0) {
            preferred.add('MC');
        }
        if (remainingTf > 0) {
            preferred.add('TF');
        }
    }

    if (preferred.size === 0) {
        preferred.add('MC');
        preferred.add('TF');
    }

    return preferred;
};

const pickFirstObjectiveQuestion = (questions = []) => {
    const unansweredObjective = questions.filter((q) => isValidObjectiveQuestion(q) && !q.answeredAt);
    if (unansweredObjective.length === 0) {
        return null;
    }

    const mcObjective = unansweredObjective.filter((q) => normaliseAttemptQuestionType(q.type) === 'MC');
    const tfObjective = unansweredObjective.filter((q) => normaliseAttemptQuestionType(q.type) === 'TF');
    const candidatePool = mcObjective.length > 0 ? mcObjective : tfObjective;

    const exact800 = candidatePool.find((q) => clampElo(q.elo) === FIRST_QUESTION_ELO);
    if (exact800) {
        return exact800;
    }

    return sortByDistanceToTarget(candidatePool, FIRST_QUESTION_ELO)[0] || null;
};

const pickNextObjectiveQuestion = (
    questions = [],
    targetElo = MIN_ELO,
    objectiveTarget = ATTEMPT_OBJECTIVE_TARGET,
) => {
    const unansweredObjective = questions.filter((q) => isValidObjectiveQuestion(q) && !q.answeredAt);
    if (unansweredObjective.length === 0) {
        return null;
    }

    const preferredTypes = getPreferredObjectiveTypes(questions, objectiveTarget);
    const constrainedByType = unansweredObjective.filter((q) =>
        preferredTypes.has(normaliseAttemptQuestionType(q.type)),
    );
    const candidatePool = constrainedByType.length > 0 ? constrainedByType : unansweredObjective;

    const bandIndex = resolveBandIndex(targetElo);
    const bandOrder = getBandTraversalOrder(bandIndex);

    for (const idx of bandOrder) {
        const band = ELO_BANDS[idx];
        const inBand = candidatePool.filter((q) => {
            const elo = clampElo(q.elo);
            return elo >= band.min && elo <= band.max;
        });
        if (inBand.length > 0) {
            return sortByDistanceToTarget(inBand, targetElo)[0];
        }
    }

    return sortByDistanceToTarget(candidatePool, targetElo)[0];
};

const pickEssayQuestion = (questions = []) => {
    const essays = questions.filter((q) => normaliseAttemptQuestionType(q.type) === 'EY' && !q.answeredAt);
    if (essays.length === 0) {
        return null;
    }
    const unservedEssay = essays.find((q) => !Number.isInteger(q.servedOrder));
    if (unservedEssay) {
        return unservedEssay;
    }
    return essays.sort(sortQuestionsByServedThenOrder)[0];
};

const buildAttemptProgress = (attempt, questions = []) => {
    const servedQuestions = questions.filter((q) => Number.isInteger(q.servedOrder));
    const answeredQuestions = servedQuestions.filter((q) => q.answeredAt);
    return {
        poolSize: attempt.poolSize || ATTEMPT_POOL_SIZE,
        objectiveTarget: attempt.objectiveTarget || ATTEMPT_OBJECTIVE_TARGET,
        totalTarget: attempt.totalTarget || ATTEMPT_TOTAL_TARGET,
        objectiveAnswered: attempt.objectiveAnswered || 0,
        objectiveCorrect: attempt.objectiveCorrect || 0,
        servedCount: servedQuestions.length,
        answeredCount: answeredQuestions.length,
        completed: attempt.status === ATTEMPT_STATUS.SUBMITTED,
    };
};

const toPublicQuestion = (question, includeCorrect = false) => {
    const payload = {
        id: question.id,
        sourceQuestionId: question.sourceQuestionId ?? null,
        question: question.question,
        type: normaliseAttemptQuestionType(question.type) || 'MC',
        options: Array.isArray(question.options) ? question.options : [],
        elo: clampElo(question.elo),
        order: question.order,
        servedOrder: question.servedOrder ?? null,
        submittedAnswer: question.submittedAnswer ?? '',
        isCorrect: question.isCorrect ?? false,
        score: question.score ?? 0,
        answeredAt: question.answeredAt ?? null,
    };

    if (includeCorrect) {
        payload.answer = question.answer ?? '';
        payload.correctedAnswer = question.correctedAnswer || question.answer || '';
    }

    return payload;
};

const formatAttemptResponse = (attempt, resumed = false) => {
    if (!attempt) {
        return null;
    }

    const sortedQuestions = [...(attempt.questions || [])].sort(sortQuestionsByServedThenOrder);
    let visibleQuestions = sortedQuestions.filter((q) => Number.isInteger(q.servedOrder));
    if (visibleQuestions.length === 0 && attempt.status === ATTEMPT_STATUS.SUBMITTED) {
        visibleQuestions = sortedQuestions;
    }
    const includeCorrect = attempt.status === ATTEMPT_STATUS.SUBMITTED;
    const activeQuestion = findActiveQuestion(sortedQuestions);

    return {
        attemptId: attempt.id,
        chapterId: attempt.chapterId,
        instruction: attempt.instruction,
        resumed,
        source: attempt.source,
        status: attempt.status,
        submittedAt: attempt.submittedAt,
        progress: buildAttemptProgress(attempt, sortedQuestions),
        currentQuestion: activeQuestion ? toPublicQuestion(activeQuestion, false) : null,
        questions: visibleQuestions.map((q) => toPublicQuestion(q, includeCorrect)),
    };
};

const getGradeMultiplier = (grade) => {
    // Multiplier ini HANYA dipakai untuk delta Elo, BUKAN untuk poin gamifikasi.
    // Poin gamifikasi menggunakan rumus murni: base × (1 - E), tanpa multiplier.
    if (grade >= 79.5) {
        return 1.5;
    }
    if (grade >= 72) {
        return 1.25;
    }
    if (grade >= 64.5) {
        return 1.1;
    }
    if (grade >= 57) {
        return 1.0;
    }
    if (grade >= 42) {
        return 0.9;
    }
    if (grade >= 28) {
        return 0.8;
    }
    return 0.7;
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
            type: normalizedType,
        };
    });

    return { evaluations, correctAnswers, assessableQuestions };
};

const calculateEloOutcome = ({
    questions,
    evaluations,
    grade,
    totalQuestions,
    userElo,
}) => {
    let runningUserElo = Math.max(MIN_ELO, userElo || MIN_ELO);
    const isProvisional = runningUserElo <= MIN_ELO;

    let totalUserEloEarned = 0;
    const questionUpdates = [];
    let totalPointsEarned = 0; // Poin murni: sum per soal, tanpa multiplier

    for (const evaluation of evaluations) {
        const question = questions[evaluation.index];
        if (!question || !isObjectiveType(question.type)) {
            continue;
        }

        // Gunakan elo soal SEBELUM duel (original elo dari pool).
        // question.elo sudah diupdate per-duel, tapi untuk kalkulasi finalisasi
        // kita rekonstruksi dari userEloDeltaRaw & questionEloDeltaRaw jika tersedia.
        const questionEloAfterDuel = clampElo(question.elo);
        const questionEloDelta = Number(question.questionEloDeltaRaw || 0);
        const questionEloBeforeDuel = Number.isFinite(questionEloDelta)
            ? Math.max(MIN_ELO, questionEloAfterDuel - questionEloDelta)
            : questionEloAfterDuel;

        const K_USER = determineUserKFactor(runningUserElo);
        const K_QUESTION = determineQuestionKFactor(questionEloBeforeDuel);

        // P_s,i = 1 / (1 + 10^(-(R_s - D_i) / 400))
        const expectedProbUser = 1 / (1 + Math.pow(10, -(runningUserElo - questionEloBeforeDuel) / 400));
        const actualUserScore = evaluation.isCorrect ? 1 : 0;

        // R_s^baru = R_s + K_s(S - P_s,i)
        let userEloChange = K_USER * (actualUserScore - expectedProbUser);

        // D_i^baru = D_i + K_i(P_s,i - S)
        const questionEloChange = K_QUESTION * (expectedProbUser - actualUserScore);

        if (isProvisional && evaluation.isCorrect) {
            userEloChange += (100 / totalQuestions) * 0.5;
        }

        // --- POIN GAMIFIKASI ---
        // Rumus: Poin = B × Difficulty, di mana Difficulty = 1 - E (E = probabilitas ekspektasi Elo)
        // B (Base Poin) = 10, jika benar; 0 jika salah.
        // TIDAK ada grade multiplier pada poin — hanya murni kesulitan soal.
        if (evaluation.isCorrect) {
            const difficulty = 1 - expectedProbUser; // Difficulty = 1 - P
            const dynamicPoints = 10 * difficulty;   // Base (B) = 10
            totalPointsEarned += dynamicPoints;
        }

        // Update running user elo untuk soal berikutnya (agar konsisten dengan preview)
        runningUserElo = Math.max(MIN_ELO, runningUserElo + userEloChange);
        totalUserEloEarned += userEloChange;

        questionUpdates.push({
            questionId: question.id,
            newElo: Math.round(questionEloBeforeDuel + questionEloChange),
        });
    }

    // Grade multiplier HANYA dipakai untuk delta Elo, bukan poin.
    let totalEloChangeRaw = totalUserEloEarned * getGradeMultiplier(grade);
    if (isProvisional && totalEloChangeRaw < 0) {
        totalEloChangeRaw = 0;
    }

    return {
        pointsEarned: Math.round(totalPointsEarned), // Tanpa multiplier, sesuai rumus asli
        eloDeltaRaw: totalEloChangeRaw,
        questionUpdates,
    };
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
    const newDifficulty = toPrismaDifficulty(determineDifficulty(userChapter.user?.points ?? MIN_ELO));
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

    const { pointsEarned, eloDeltaRaw, questionUpdates } = calculateEloOutcome({
        questions,
        evaluations,
        grade,
        totalQuestions,
        userElo: userChapter.user?.elo || MIN_ELO,
    });
    const isStudent = isStudentRole(userChapter.user?.role);
    const eloDeltaSigned = isStudent ? Math.round(eloDeltaRaw) : 0;
    const userPointsEarned = isStudent ? Math.max(0, pointsEarned) : 0;
    const effectiveQuestionUpdates = isStudent ? questionUpdates : [];

    const summary = buildSubmissionSummary({
        questions,
        answerMap,
        userChapter,
        grade,
        correctAnswers,
        totalQuestions,
    });

    const isCompleted = userChapter.materialDone === true;

    const transactionOperations = [
        prisma.userChapter.update({
            where: { id: userChapter.id },
            data: {
                isStarted: true,
                assessmentDone: true,
                isCompleted: isCompleted,
                assessmentGrade: grade,
                assessmentEloDelta: eloDeltaSigned,
                assessmentPointsEarned: { increment: userPointsEarned },
                assessmentAnswer: summary.orderedAnswers,
                currentDifficulty: summary.newDifficulty,
                lastAiFeedback: summary.aiFeedback,
                correctStreak: summary.isExcellent ? ((userChapter.correctStreak || 0) + 1) : 0,
                wrongStreak: summary.isExcellent ? 0 : ((userChapter.wrongStreak || 0) + 1),
                timeFinished: new Date(),
            },
        }),
        ...effectiveQuestionUpdates.map((q) =>
            prisma.question.update({
                where: { id: q.questionId },
                data: { elo: Math.max(MIN_ELO, q.newElo) },
            }),
        ),
    ];

    if (isStudent) {
        transactionOperations.splice(1, 0,
            prisma.user.update({
                where: { id: userId },
                data: {
                    points: { increment: userPointsEarned },
                    elo: clampElo((userChapter.user?.elo || MIN_ELO) + eloDeltaSigned),
                },
            }),
        );
    }

    const [updatedChapter] = await prisma.$transaction(transactionOperations);

    // Sync to Supabase Live
    await evaluationService.syncSummaryToSupabase(userId);

    return {
        grade,
        pointsEarned: userPointsEarned,
        eloDelta: eloDeltaSigned,
        correctAnswers,
        totalQuestions,
        newDifficulty: summary.newDifficulty,
        aiFeedback: summary.aiFeedback,
        evaluations,
        userChapter: updatedChapter,
    };
};

const getAttemptByIdTx = (tx, attemptId) =>
    tx.assessmentAttempt.findUnique({
        where: { id: attemptId },
        include: { questions: true },
    });

const getCurrentAttemptTx = (tx, userId, chapterId) =>
    tx.assessmentAttempt.findFirst({
        where: {
            userId,
            chapterId,
            status: ATTEMPT_STATUS.IN_PROGRESS,
        },
        include: { questions: true },
        orderBy: { createdAt: 'desc' },
    });

const ensureCurrentQuestionServedTx = async (tx, attemptOrId) => {
    let attempt = null;
    if (typeof attemptOrId === 'number') {
        attempt = await getAttemptByIdTx(tx, attemptOrId);
    } else {
        attempt = attemptOrId;
    }

    if (!attempt || attempt.status !== ATTEMPT_STATUS.IN_PROGRESS) {
        return attempt;
    }

    const questions = [...(attempt.questions || [])].sort(sortQuestionsByServedThenOrder);
    const activeQuestion = findActiveQuestion(questions);
    if (activeQuestion) {
        return attempt;
    }

    const nextServedOrder = questions.reduce((acc, q) => {
        if (!Number.isInteger(q.servedOrder)) {
            return acc;
        }
        return Math.max(acc, q.servedOrder);
    }, 0) + 1;

    const objectiveAnswered = attempt.objectiveAnswered || 0;
    const objectiveTarget = attempt.objectiveTarget || ATTEMPT_OBJECTIVE_TARGET;
    const servedObjectiveCount = questions.filter(
        (q) => Number.isInteger(q.servedOrder) && isObjectiveType(q.type),
    ).length;
    let nextQuestion = null;

    if (objectiveAnswered >= objectiveTarget) {
        nextQuestion = pickEssayQuestion(questions);
    } else if (servedObjectiveCount === 0) {
        nextQuestion = pickFirstObjectiveQuestion(questions);
    } else {
        nextQuestion = pickNextObjectiveQuestion(
            questions,
            attempt.currentUserElo || MIN_ELO,
            objectiveTarget,
        );
    }

    if (!nextQuestion) {
        return attempt;
    }

    if (!Number.isInteger(nextQuestion.servedOrder)) {
        const shouldForceFirstQuestionElo = objectiveAnswered === 0 && servedObjectiveCount === 0;
        await tx.assessmentAttemptQuestion.update({
            where: { id: nextQuestion.id },
            data: {
                servedOrder: nextServedOrder,
                ...(shouldForceFirstQuestionElo ? { elo: FIRST_QUESTION_ELO } : {}),
            },
        });
        return getAttemptByIdTx(tx, attempt.id);
    }

    return attempt;
};

const finalizeAttemptInTransaction = async (tx, attempt, userId, chapterId, isStudentParam = null) => {
    const refreshedAttempt = await getAttemptByIdTx(tx, attempt.id);
    if (!refreshedAttempt) {
        throw new Error('Assessment attempt tidak ditemukan');
    }

    const servedQuestions = [...(refreshedAttempt.questions || [])]
        .filter((q) => Number.isInteger(q.servedOrder))
        .sort(sortQuestionsByServedThenOrder);

    const objectiveQuestions = servedQuestions.filter((q) => isObjectiveType(q.type));
    const objectiveTarget = refreshedAttempt.objectiveTarget || ATTEMPT_OBJECTIVE_TARGET;
    const correctAnswers = objectiveQuestions.filter((q) => q.isCorrect === true).length;
    const grade = Math.round(getCorrectnessRatio(correctAnswers, Math.max(1, objectiveTarget)) * 100);

    const chapter = await tx.chapter.findUnique({
        where: { id: chapterId },
        select: { courseId: true },
    });
    if (!chapter) {
        throw new Error('Chapter tidak ditemukan untuk finalisasi attempt');
    }

    const user = isStudentParam === null
        ? await tx.user.findUnique({ where: { id: userId }, select: { role: true } })
        : null;
    const isStudent = isStudentParam === null ? isStudentRole(user?.role) : isStudentParam;

    const userChapter = await ensureUserChapterTx(tx, userId, chapterId);
    const userCourse = await ensureUserCourseTx(tx, userId, chapter.courseId);
    const courseEloStart = refreshedAttempt.courseEloStart || userCourse.elo || MIN_ELO;
    const courseEloEnd = refreshedAttempt.currentUserElo || courseEloStart;
    const effectiveCourseEloEnd = isStudent ? courseEloEnd : courseEloStart;
    const eloDeltaSigned = isStudent ? Math.round(courseEloEnd - courseEloStart) : 0;

    const evaluationsForPoints = servedQuestions.map((q, index) => ({
        index,
        questionId: q.id,
        isCorrect: q.isCorrect === true,
        type: normaliseAttemptQuestionType(q.type)
    }));

    const { pointsEarned: dynamicPointsEarned } = calculateEloOutcome({
        questions: servedQuestions,
        evaluations: evaluationsForPoints,
        grade,
        totalQuestions: Math.max(1, objectiveTarget),
        userElo: courseEloStart
    });

    const pointsEarned = isStudent ? dynamicPointsEarned : 0;

    // Calculate Gamification Points using "High Score" method
    let globalPointsToAward = 0;
    let localPointsToRecord = 0;

    if (isStudent) {
        if (userChapter.assessmentDone) {
            const previousEarned = userChapter.assessmentPointsEarned || 0;
            const newEarned = Math.max(0, Math.round(pointsEarned));

            if (newEarned > previousEarned) {
                globalPointsToAward = newEarned - previousEarned;
                localPointsToRecord = newEarned;
            } else {
                localPointsToRecord = previousEarned;
            }
        } else {
            globalPointsToAward = Math.max(0, Math.round(pointsEarned));
            localPointsToRecord = globalPointsToAward;
        }
    }

    const isExcellent = grade >= 75;
    const newDifficulty = toPrismaDifficulty(determineDifficulty(courseEloEnd));
    const aiFeedback = buildFeedback(grade, correctAnswers);
    const orderedAnswers = servedQuestions.map((q) => q.submittedAnswer || '');

    // A chapter is completed if both material and assessment are done
    const isCompleted = userChapter.materialDone === true;

    const updatedChapter = await tx.userChapter.update({
        where: { id: userChapter.id },
        data: {
            isStarted: true,
            assessmentDone: true,
            isCompleted: isCompleted,
            assessmentGrade: grade,
            assessmentEloDelta: eloDeltaSigned,
            assessmentPointsEarned: localPointsToRecord,
            assessmentAnswer: orderedAnswers,
            currentDifficulty: newDifficulty,
            lastAiFeedback: aiFeedback,
            correctStreak: isExcellent ? ((userChapter.correctStreak || 0) + 1) : 0,
            wrongStreak: isExcellent ? 0 : ((userChapter.wrongStreak || 0) + 1),
            timeFinished: new Date(),
        },
    });

    await tx.userCourse.update({
        where: { id: userCourse.id },
        data: { elo: effectiveCourseEloEnd },
    });

    if (isStudent) {
        await tx.user.update({
            where: { id: userId },
            data: {
                ...(globalPointsToAward > 0 ? { points: { increment: globalPointsToAward } } : {}),
                elo: clampElo((refreshedAttempt.courseEloStart || MIN_ELO) + eloDeltaSigned),
            },
        });
    }

    await tx.assessmentAttempt.update({
        where: { id: refreshedAttempt.id },
        data: {
            status: ATTEMPT_STATUS.SUBMITTED,
            grade,
            pointsEarned: localPointsToRecord,
            correctAnswers,
            totalQuestions: objectiveTarget,
            courseEloEnd: effectiveCourseEloEnd,
            newDifficulty,
            aiFeedback,
            submittedAt: new Date(),
        },
    });

    const sourceQuestionUpdates = new Map();
    for (const question of objectiveQuestions) {
        if (!Number.isInteger(question.sourceQuestionId)) {
            continue;
        }
        sourceQuestionUpdates.set(question.sourceQuestionId, Math.max(MIN_ELO, clampElo(question.elo)));
    }

    if (isStudent) {
        for (const [sourceQuestionId, nextElo] of sourceQuestionUpdates.entries()) {
            await tx.question.update({
                where: { id: sourceQuestionId },
                data: { elo: nextElo },
            });
        }
    }

    const evaluations = servedQuestions.map((q, index) => ({
        index,
        questionId: q.id,
        question: q.question,
        submittedAnswer: q.submittedAnswer || '',
        correctAnswer: q.correctedAnswer || q.answer || '',
        isCorrect: q.isCorrect === true,
        type: normaliseAttemptQuestionType(q.type),
    }));

    return {
        attemptId: refreshedAttempt.id,
        grade,
        pointsEarned: localPointsToRecord,
        courseEloStart,
        courseEloEnd: effectiveCourseEloEnd,
        eloDelta: eloDeltaSigned,
        correctAnswers,
        totalQuestions: objectiveTarget,
        newDifficulty,
        aiFeedback,
        evaluations,
        userChapter: updatedChapter,
    };
};

const createOrResumeAttempt = async (
    userId,
    chapterId,
    forceNew = false,
    { allowCreateWhenSubmitted = true } = {},
) => {
    if (!userId || !chapterId) {
        throw new Error('userId dan chapterId wajib diisi');
    }

    const normalizedUserId = Number(userId);
    const normalizedChapterId = Number(chapterId);
    if (!Number.isInteger(normalizedUserId) || !Number.isInteger(normalizedChapterId)) {
        throw new Error('userId dan chapterId harus berupa angka');
    }

    if (forceNew) {
        await prisma.assessmentAttempt.updateMany({
            where: {
                userId: normalizedUserId,
                chapterId: normalizedChapterId,
                status: ATTEMPT_STATUS.IN_PROGRESS,
            },
            data: { status: ATTEMPT_STATUS.ABANDONED },
        });
    } else {
        const existingAttempt = await prisma.$transaction(async (tx) => {
            const current = await getCurrentAttemptTx(tx, normalizedUserId, normalizedChapterId);
            if (!current) {
                return null;
            }
            return ensureCurrentQuestionServedTx(tx, current);
        }, INTERACTIVE_TX_OPTIONS);
        if (existingAttempt) {
            return { attempt: existingAttempt, resumed: true };
        }

        if (!allowCreateWhenSubmitted) {
            const latestSubmitted = await prisma.assessmentAttempt.findFirst({
                where: {
                    userId: normalizedUserId,
                    chapterId: normalizedChapterId,
                    status: ATTEMPT_STATUS.SUBMITTED,
                },
                select: { id: true },
            });
            if (latestSubmitted) {
                return { attempt: null, resumed: false, skipped: true };
            }
        }
    }

    const chapter = await prisma.chapter.findUnique({
        where: { id: normalizedChapterId },
        include: {
            materials: {
                take: 1,
                orderBy: { id: 'asc' },
            },
        },
    });

    if (!chapter) {
        throw new Error('Chapter tidak ditemukan');
    }

    const assessment = await ensureAssessmentBankForChapter(normalizedChapterId, chapter.name);

    await ensureUserChapter(normalizedUserId, normalizedChapterId);
    const userCourse = await ensureUserCourse(normalizedUserId, chapter.courseId);

    // If re-attempting, use the Elo from the VERY FIRST attempt of this chapter.
    let userElo = Math.max(MIN_ELO, userCourse.elo || MIN_ELO);
    const firstAttempt = await prisma.assessmentAttempt.findFirst({
        where: {
            userId: normalizedUserId,
            chapterId: normalizedChapterId,
            status: ATTEMPT_STATUS.SUBMITTED,
        },
        orderBy: { createdAt: 'asc' },
        select: { courseEloStart: true }
    });
    if (firstAttempt && typeof firstAttempt.courseEloStart === 'number') {
        userElo = Math.max(MIN_ELO, firstAttempt.courseEloStart);
    }

    let source = ATTEMPT_SOURCE.FALLBACK_BANK;
    let instruction =
        String(assessment.instruction || '').trim() || buildAttemptInstruction(chapter.name);
    let bankQuestions = Array.isArray(assessment.questions) ? assessment.questions : [];

    const minimumBankSize = ATTEMPT_POOL_SIZE;
    if (bankQuestions.length < minimumBankSize) {
        try {
            const generated = await generateAttemptQuestionsWithLLM({
                chapter,
                material: chapter.materials?.[0] || null,
                userElo,
            });

            const createdBankRows = await saveGeneratedQuestionsToBank(assessment.id, generated.questions);
            bankQuestions = [...bankQuestions, ...createdBankRows];
            source = ATTEMPT_SOURCE.GENERATED;

            const generatedInstruction = String(generated.instruction || '').trim();
            if (generatedInstruction) {
                instruction = generatedInstruction;
                if (!String(assessment.instruction || '').trim()) {
                    await prisma.assessment.update({
                        where: { id: assessment.id },
                        data: { instruction: generatedInstruction },
                    });
                }
            }
        } catch (error) {
            console.error('LLM generation failed, fallback to bank:', error.message);
            source = ATTEMPT_SOURCE.FALLBACK_BANK;
            if (!bankQuestions.length) {
                throw new Error('LLM gagal dan bank soal fallback tidak tersedia.');
            }
        }
    }

    let questionPool = [];
    try {
        questionPool = buildSimplePoolFromBank(bankQuestions, userElo, chapter.name);
    } catch (error) {
        if (!bankQuestions.length) {
            throw error;
        }
        questionPool = buildFallbackPoolFromBank(bankQuestions, userElo, chapter.name);
    }

    if (!questionPool.length) {
        throw new Error('Gagal membangun pool assessment attempt.');
    }

    const createdAttempt = await prisma.assessmentAttempt.create({
        data: {
            userId: normalizedUserId,
            chapterId: normalizedChapterId,
            assessmentId: assessment?.id || null,
            status: ATTEMPT_STATUS.IN_PROGRESS,
            source,
            instruction,
            poolSize: ATTEMPT_POOL_SIZE,
            objectiveTarget: ATTEMPT_OBJECTIVE_TARGET,
            totalTarget: ATTEMPT_TOTAL_TARGET,
            currentUserElo: userElo,
            courseEloStart: userElo,
            courseEloEnd: userElo,
            rawEloDelta: 0,
            objectiveAnswered: 0,
            objectiveCorrect: 0,
            questions: {
                create: questionPool.map((q, index) => ({
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
    });

    const attemptWithServed = await prisma.$transaction(async (tx) => {
        return ensureCurrentQuestionServedTx(tx, createdAttempt.id);
    }, INTERACTIVE_TX_OPTIONS);

    return { attempt: attemptWithServed, resumed: false };
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
                questions: true,
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

    const servedQuestions = (attempt.questions || []).filter((q) => Number.isInteger(q.servedOrder));
    const questions = servedQuestions.length > 0 ? servedQuestions : (attempt.questions || []);
    if (questions.length === 0) {
        throw new Error('Assessment attempt tidak memiliki soal');
    }

    const { evaluations, correctAnswers, assessableQuestions } = evaluateSubmission(questions, answerMap);
    const objectiveTarget = attempt.objectiveTarget || ATTEMPT_OBJECTIVE_TARGET;
    const totalQuestions = servedQuestions.length > 0
        ? Math.max(1, objectiveTarget)
        : (assessableQuestions > 0 ? assessableQuestions : 1);
    const grade = Math.round(getCorrectnessRatio(correctAnswers, totalQuestions) * 100);

    const { pointsEarned, eloDeltaRaw, questionUpdates } = calculateEloOutcome({
        questions,
        evaluations,
        grade,
        totalQuestions,
        userElo: userChapter.user?.elo || MIN_ELO,
    });
    const isStudent = isStudentRole(userChapter.user?.role);
    const eloDeltaSigned = isStudent ? Math.round(eloDeltaRaw) : 0;

    // Calculate Gamification Points using "High Score" method
    let globalPointsToAward = 0;
    let localPointsToRecord = 0;

    if (isStudent) {
        if (userChapter.assessmentDone) {
            // Re-attempt: Only award points if the new positive delta is higher than the previously earned points
            const previousEarned = userChapter.assessmentPointsEarned || 0;
            const newEarned = Math.max(0, pointsEarned);

            if (newEarned > previousEarned) {
                globalPointsToAward = newEarned - previousEarned;
                localPointsToRecord = newEarned; // For the local chapter, we just set it to the new high score
            } else {
                localPointsToRecord = previousEarned; // Keep the existing high score
            }
        } else {
            // First time: Award all positive points
            globalPointsToAward = Math.max(0, pointsEarned);
            localPointsToRecord = globalPointsToAward;
        }
    }

    const effectiveQuestionUpdates = isStudent ? questionUpdates : [];

    const summary = buildSubmissionSummary({
        questions,
        answerMap,
        userChapter,
        grade,
        correctAnswers,
        totalQuestions,
    });

    const objectiveQuestionScore = Math.ceil(100 / Math.max(1, totalQuestions));
    const evaluationByQuestionId = new Map(evaluations.map((evaluation) => [evaluation.questionId, evaluation]));
    const eloByQuestionId = new Map(effectiveQuestionUpdates.map((update) => [update.questionId, update.newElo]));

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

    const isCompleted = userChapter.materialDone === true;

    const transactionOperations = [
        prisma.userChapter.update({
            where: { id: userChapter.id },
            data: {
                isStarted: true,
                assessmentDone: true,
                isCompleted: isCompleted,
                assessmentGrade: grade,
                assessmentEloDelta: eloDeltaSigned,
                assessmentPointsEarned: localPointsToRecord,
                assessmentAnswer: summary.orderedAnswers,
                currentDifficulty: summary.newDifficulty,
                lastAiFeedback: summary.aiFeedback,
                correctStreak: summary.isExcellent ? ((userChapter.correctStreak || 0) + 1) : 0,
                wrongStreak: summary.isExcellent ? 0 : ((userChapter.wrongStreak || 0) + 1),
                timeFinished: new Date(),
            },
        }),
        prisma.assessmentAttempt.update({
            where: { id: attempt.id },
            data: {
                status: ATTEMPT_STATUS.SUBMITTED,
                grade,
                pointsEarned: localPointsToRecord,
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
                    answeredAt: new Date(),
                    elo: isStudent
                        ? Math.max(MIN_ELO, Number.isFinite(nextElo) ? nextElo : clampElo(question.elo))
                        : clampElo(question.elo),
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

    if (isStudent) {
        transactionOperations.splice(1, 0,
            prisma.user.update({
                where: { id: userId },
                data: {
                    ...(globalPointsToAward > 0 ? { points: { increment: globalPointsToAward } } : {}),
                    // Global Elo: Recalculate correctly using Start Elo + New Delta
                    elo: clampElo((attempt.courseEloStart || MIN_ELO) + eloDeltaSigned),
                },
            }),
        );
    }

    const [updatedChapter] = await prisma.$transaction(transactionOperations);

    // Sync to Supabase Live
    await evaluationService.syncSummaryToSupabase(userId);

    return {
        attemptId: refreshedAttempt.id,
        grade,
        pointsEarned: localPointsToRecord, // Show the final high score of points for this chapter
        eloDelta: eloDeltaSigned,
        correctAnswers,
        totalQuestions,
        newDifficulty: summary.newDifficulty,
        aiFeedback: summary.aiFeedback,
        evaluations,
        userChapter: updatedChapter,
    };
};

exports.answerAttemptQuestion = async (userId, chapterId, attemptId, questionId, answer) => {
    const normalizedUserId = Number(userId);
    const normalizedChapterId = Number(chapterId);
    const normalizedAttemptId = Number(attemptId);
    const normalizedQuestionId = Number(questionId);

    if (!Number.isInteger(normalizedUserId) || !Number.isInteger(normalizedChapterId)) {
        throw new Error('userId dan chapterId harus berupa angka');
    }
    if (!Number.isInteger(normalizedAttemptId) || !Number.isInteger(normalizedQuestionId)) {
        throw new Error('attemptId dan questionId harus berupa angka');
    }

    const submittedAnswer = String(answer ?? '').trim();
    if (!submittedAnswer) {
        throw new Error('Jawaban tidak boleh kosong');
    }

    // --- Pre-fetch di luar transaksi agar transaksi sesingkat mungkin ---
    // Read user role & attempt sekarang supaya koneksi TX tidak dipakai untuk operasi read awal.
    const [userPreFetch, attemptPreFetch] = await Promise.all([
        prisma.user.findUnique({
            where: { id: normalizedUserId },
            select: { role: true },
        }),
        prisma.assessmentAttempt.findFirst({
            where: {
                id: normalizedAttemptId,
                userId: normalizedUserId,
                chapterId: normalizedChapterId,
                status: ATTEMPT_STATUS.IN_PROGRESS,
            },
            include: { questions: true },
        }),
    ]);

    // Validasi awal sebelum masuk transaksi
    if (!attemptPreFetch) {
        throw new Error('Assessment attempt tidak ditemukan atau sudah selesai');
    }

    const isStudent = isStudentRole(userPreFetch?.role);

    return prisma.$transaction(async (tx) => {
        // Reload attempt di dalam TX untuk memastikan data konsisten (row lock)
        let attempt = await tx.assessmentAttempt.findFirst({
            where: {
                id: normalizedAttemptId,
                userId: normalizedUserId,
                chapterId: normalizedChapterId,
                status: ATTEMPT_STATUS.IN_PROGRESS,
            },
            include: { questions: true },
        });

        if (!attempt) {
            throw new Error('Assessment attempt tidak ditemukan atau sudah selesai');
        }

        attempt = await ensureCurrentQuestionServedTx(tx, attempt);
        const questions = [...(attempt.questions || [])].sort(sortQuestionsByServedThenOrder);
        const activeQuestion = findActiveQuestion(questions);

        if (!activeQuestion) {
            const result = await finalizeAttemptInTransaction(
                tx,
                attempt,
                normalizedUserId,
                normalizedChapterId,
                isStudent,
            );
            return {
                completed: true,
                result,
            };
        }

        if (activeQuestion.id !== normalizedQuestionId) {
            throw new Error('Jawaban harus dikirim untuk soal aktif saat ini.');
        }

        if (activeQuestion.answeredAt) {
            throw new Error('Soal ini sudah dijawab.');
        }

        const normalizedType = normaliseAttemptQuestionType(activeQuestion.type);
        const isObjective = isObjectiveType(normalizedType);
        const objectiveTarget = attempt.objectiveTarget || ATTEMPT_OBJECTIVE_TARGET;
        const objectiveScore = Math.ceil(100 / Math.max(1, objectiveTarget));

        let isCorrect = false;
        let userDeltaRaw = 0;
        let questionDeltaRaw = 0;
        let nextUserEloPreview = Math.max(MIN_ELO, attempt.currentUserElo || MIN_ELO);
        let nextQuestionElo = clampElo(activeQuestion.elo);

        let nextObjectiveAnswered = attempt.objectiveAnswered || 0;
        let nextObjectiveCorrect = attempt.objectiveCorrect || 0;
        let nextRawEloDelta = Number(attempt.rawEloDelta || 0);
        const courseEloBefore = Math.max(MIN_ELO, attempt.currentUserElo || MIN_ELO);
        const courseEloStart = Math.max(MIN_ELO, attempt.courseEloStart || courseEloBefore);
        let targetNextQuestionElo = courseEloBefore;

        if (isObjective) {
            const correctAnswer = String(activeQuestion.answer || activeQuestion.correctedAnswer || '').trim().toLowerCase();
            isCorrect = submittedAnswer.toLowerCase() === correctAnswer;
            if (isStudent) {
                const duel = calculateQuestionDuelElo({
                    userElo: nextUserEloPreview,
                    questionElo: activeQuestion.elo,
                    isCorrect,
                });
                userDeltaRaw = duel.userDeltaRaw;
                questionDeltaRaw = duel.questionDeltaRaw;
                nextUserEloPreview = duel.nextUserElo;
                nextQuestionElo = duel.nextQuestionElo;
                nextRawEloDelta += userDeltaRaw;
                targetNextQuestionElo = Math.max(
                    MIN_ELO,
                    nextUserEloPreview + (isCorrect ? 50 : -50),
                );
            }
            nextObjectiveAnswered += 1;
            if (isCorrect) {
                nextObjectiveCorrect += 1;
            }
        }

        await tx.assessmentAttemptQuestion.update({
            where: { id: activeQuestion.id },
            data: {
                submittedAnswer,
                isCorrect: isObjective ? isCorrect : false,
                score: isObjective ? (isCorrect ? objectiveScore : 0) : 0,
                answeredAt: new Date(),
                userEloDeltaRaw: isObjective && isStudent ? (Number.isNaN(userDeltaRaw) ? 0 : userDeltaRaw) : null,
                questionEloDeltaRaw: isObjective && isStudent ? (Number.isNaN(questionDeltaRaw) ? 0 : questionDeltaRaw) : null,
                elo: isObjective && isStudent
                    ? (Number.isNaN(nextQuestionElo) ? 1200 : nextQuestionElo)
                    : clampElo(activeQuestion.elo),
            },
        });

        await tx.assessmentAttempt.update({
            where: { id: attempt.id },
            data: {
                currentUserElo: Number.isNaN(nextUserEloPreview) ? 750 : nextUserEloPreview,
                courseEloEnd: Number.isNaN(nextUserEloPreview) ? 750 : nextUserEloPreview,
                rawEloDelta: Number.isNaN(nextRawEloDelta) ? 0 : nextRawEloDelta,
                objectiveAnswered: nextObjectiveAnswered,
                objectiveCorrect: nextObjectiveCorrect,
            },
        });

        if (isStudent && isObjective && Number.isInteger(activeQuestion.sourceQuestionId)) {
            await tx.question.update({
                where: { id: activeQuestion.sourceQuestionId },
                data: { elo: Number.isNaN(nextQuestionElo) ? 1200 : nextQuestionElo },
            });
        }

        let updatedAttempt = await getAttemptByIdTx(tx, attempt.id);
        let updatedQuestions = [...(updatedAttempt.questions || [])].sort(sortQuestionsByServedThenOrder);

        const currentObjectiveAnswered = updatedAttempt.objectiveAnswered || 0;
        const currentObjectiveTarget = updatedAttempt.objectiveTarget || ATTEMPT_OBJECTIVE_TARGET;
        const nextServedOrder = updatedQuestions.reduce((acc, q) => {
            if (!Number.isInteger(q.servedOrder)) {
                return acc;
            }
            return Math.max(acc, q.servedOrder);
        }, 0) + 1;

        let nextQuestion = null;
        if (currentObjectiveAnswered >= currentObjectiveTarget) {
            nextQuestion = pickEssayQuestion(updatedQuestions);
        } else {
            nextQuestion = pickNextObjectiveQuestion(
                updatedQuestions,
                targetNextQuestionElo,
                currentObjectiveTarget,
            );
        }

        if (nextQuestion && !Number.isInteger(nextQuestion.servedOrder)) {
            await tx.assessmentAttemptQuestion.update({
                where: { id: nextQuestion.id },
                data: { servedOrder: nextServedOrder },
            });
            updatedAttempt = await getAttemptByIdTx(tx, attempt.id);
            updatedQuestions = [...(updatedAttempt.questions || [])].sort(sortQuestionsByServedThenOrder);
        }

        const activeAfterAnswer = findActiveQuestion(updatedQuestions);
        const essayAnswered = updatedQuestions.some(
            (q) => normaliseAttemptQuestionType(q.type) === 'EY' && q.answeredAt,
        );
        const objectiveCompleted =
            (updatedAttempt.objectiveAnswered || 0) >= (updatedAttempt.objectiveTarget || ATTEMPT_OBJECTIVE_TARGET);

        if ((objectiveCompleted && essayAnswered) || !activeAfterAnswer) {
            const result = await finalizeAttemptInTransaction(
                tx,
                updatedAttempt,
                normalizedUserId,
                normalizedChapterId,
                isStudent,
            );
            return {
                completed: true,
                result,
            };
        }

        let dynamicPointsEarnedThisQuestion = 0;
        if (isObjective && isStudent && isCorrect) {
            const expectedProbUser = 1 / (1 + Math.pow(10, -(courseEloBefore - clampElo(activeQuestion.elo)) / 400));
            // Rumus: Poin = B × (1 - P), di mana B = 10 (base poin)
            dynamicPointsEarnedThisQuestion = Math.round(10 * (1 - expectedProbUser));
        }

        return {
            attemptId: updatedAttempt.id,
            completed: false,
            isCorrect: isObjective ? isCorrect : false,
            questionEloDelta: Math.round(questionDeltaRaw),
            eloDeltaQuestion: Number(userDeltaRaw.toFixed(2)),
            courseEloBefore,
            courseEloAfter: updatedAttempt.currentUserElo || MIN_ELO,
            targetNextQuestionElo,
            pointsAwardedPreview: dynamicPointsEarnedThisQuestion,
            userEloPreview: updatedAttempt.currentUserElo || MIN_ELO,
            nextQuestion: activeAfterAnswer ? toPublicQuestion(activeAfterAnswer, false) : null,
            progress: buildAttemptProgress(updatedAttempt, updatedQuestions),
        };
    }, INTERACTIVE_TX_OPTIONS);
};

exports.prefetchAttempt = async (userId, chapterId) => {
    const { attempt, resumed } = await createOrResumeAttempt(userId, chapterId, false, {
        allowCreateWhenSubmitted: false,
    });
    if (!attempt) {
        return null;
    }
    return formatAttemptResponse(attempt, resumed);
};

exports.startAttempt = async (userId, chapterId, forceNew = false) => {
    const { attempt, resumed } = await createOrResumeAttempt(userId, chapterId, forceNew === true, {
        allowCreateWhenSubmitted: true,
    });
    return formatAttemptResponse(attempt, resumed);
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

    const attempt = await prisma.$transaction(async (tx) => {
        const current = await getCurrentAttemptTx(tx, normalizedUserId, normalizedChapterId);
        if (!current) {
            return null;
        }
        return ensureCurrentQuestionServedTx(tx, current);
    }, INTERACTIVE_TX_OPTIONS);

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
        include: { questions: true },
        orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
    });

    if (attempt) {
        return formatAttemptResponse(attempt, false);
    }
    const [userChapter, assessment] = await Promise.all([
        prisma.userChapter.findFirst({
            where: { userId: normalizedUserId, chapterId: normalizedChapterId, assessmentDone: true },
        }),
        prisma.assessment.findFirst({
            where: { chapterId: normalizedChapterId },
            include: { questions: true },
        }),
    ]);

    if (!userChapter?.assessmentDone || !assessment?.questions?.length) {
        return null;
    }

    const storedAnswers = Array.isArray(userChapter.assessmentAnswer) ? userChapter.assessmentAnswer : [];
    const objectiveTotal = assessment.questions.filter(
        (q) => normaliseAttemptQuestionType(q.type) !== 'EY'
    ).length || 1;

    const syntheticQuestions = assessment.questions.map((q, index) => {
        const submittedAnswer = (storedAnswers[index] ?? '').toString();
        const correctAnswer = (q.correctedAnswer || q.answer || '').toString();
        const normalizedType = normaliseAttemptQuestionType(q.type);
        const isEssay = normalizedType === 'EY';
        const isCorrect =
            !isEssay &&
            submittedAnswer.trim().length > 0 &&
            submittedAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
        const score = isCorrect ? Math.ceil(100 / objectiveTotal) : 0;

        return {
            id: q.id,
            question: q.question,
            type: normalizedType,
            options: Array.isArray(q.options) ? q.options : [],
            elo: clampElo(q.elo),
            order: index,
            servedOrder: index,
            submittedAnswer,
            isCorrect,
            score,
            correctedAnswer: correctAnswer,
            answer: correctAnswer,
            answeredAt: userChapter.updatedAt || new Date(),
        };
    });

    const objectiveCorrect = syntheticQuestions.filter((q) => q.isCorrect).length;
    const syntheticAttempt = {
        id: null,
        userId: normalizedUserId,
        chapterId: normalizedChapterId,
        assessmentId: assessment.id,
        status: ATTEMPT_STATUS.SUBMITTED,
        source: 'LEGACY',
        instruction: assessment.instruction || '',
        poolSize: syntheticQuestions.length,
        objectiveTarget: objectiveTotal,
        totalTarget: syntheticQuestions.length,
        objectiveAnswered: objectiveTotal,
        objectiveCorrect,
        submittedAt: userChapter.updatedAt,
        questions: syntheticQuestions,
    };

    return formatAttemptResponse(syntheticAttempt, false);
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
        throw new Error(`Error deleting assessment: ${error.message}`);
    }
};
