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
        // Compare dynamically via question.id instead of index
        const submitted = (answerMap.get(question.id) || '').trim();
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
            index, // store current loop index for the mobile app layout logic
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
        if (entry && typeof entry.questionId === 'number') {
            answerMap.set(entry.questionId, typeof entry.answer === 'string' ? entry.answer : '');
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

    // Dynamic Matchmaking Elo Logic (Per-Question Basis)
    let userElo = userChapter.user?.points || 750;
    if (userElo < 750) userElo = 750; // Base floor

    let isProvisional = userElo <= 750;
    let K_USER = isProvisional ? 80 : 30; // Volatilitas User
    let K_QUESTION = 15; // Volatilitas soal biasanya lebih rendah agar tidak ekstrem

    let totalUserEloEarned = 0;
    let questionsToUpdate = [];

    // Loop setiap soal layaknya sebuah pertandingan (User vs Question)
    for (const evaluation of evaluations) {
        const question = questions[evaluation.index];
        const isEssay = question.type === 'EY';
        // Lewati jika tipe essay (belum dinilai eksak)
        if (isEssay) continue;

        let questionElo = question.elo || 1200;

        // Hitung Ekspektasi (Probabilitas User Menang terhadap Soal ini)
        const expectedProbUser = 1 / (1 + Math.pow(10, (questionElo - userElo) / 400));

        // Hasil Pertandingan (1 = User Benar/Menang, 0 = User Salah/Kalah)
        const actualUserScore = evaluation.isCorrect ? 1 : 0;
        const actualQuestionScore = evaluation.isCorrect ? 0 : 1;

        // Perubahan Elo
        let userEloChange = K_USER * (actualUserScore - expectedProbUser);
        let questionEloChange = K_QUESTION * (actualQuestionScore - (1 - expectedProbUser));

        // Kalau user provisional & dia benar, tambahkan bonus placement
        if (isProvisional && evaluation.isCorrect) {
            userEloChange += (100 / totalQuestions) * 0.5; // Distribusi flat bonus per soal yang relevan
        }

        totalUserEloEarned += userEloChange;

        // Rekam update untuk soalnya agar nanti di save ke DB
        questionsToUpdate.push({
            id: question.id,
            newElo: Math.round(questionElo + questionEloChange)
        });
    }

    // 4. Terapkan multiplier berdasarkan Skala Nilai Kampus (A, AB, B, BC, C, D, E)
    // Tidak ada nilai yang dijamin — hasil tetap dari rumus Elo, hanya skalanya yang dikalikan.
    // Grade lulus → amplifikasi keuntungan | Grade gagal → amplifikasi kerugian
    let totalEloChangeRaw = totalUserEloEarned;
    let rank = '';
    let gpa = 0.0;

    if (grade >= 79.5) {
        rank = 'A'; gpa = 4.0;
        totalEloChangeRaw *= 1.5;   // Bonus 50% dari hasil murni rumus
    } else if (grade >= 72) {
        rank = 'AB'; gpa = 3.5;
        totalEloChangeRaw *= 1.25;  // Bonus 25%
    } else if (grade >= 64.5) {
        rank = 'B'; gpa = 3.0;
        totalEloChangeRaw *= 1.1;   // Bonus 10%
    } else if (grade >= 57) {
        rank = 'BC'; gpa = 2.5;
        totalEloChangeRaw *= 1.0;   // Hasil murni tanpa modifikasi
    } else if (grade >= 49.5) {
        rank = 'C'; gpa = 2.0;
        totalEloChangeRaw *= 0.5;   // Reduksi 50% — efek hampir stagnan
    } else if (grade >= 34) {
        rank = 'D'; gpa = 1.0;
        totalEloChangeRaw *= 1.5;   // Amplifikasi kerugian 50% (jika rumus sudah minus, makin minus)
    } else {
        rank = 'E'; gpa = 0.0;
        totalEloChangeRaw *= 2.0;   // Amplifikasi kerugian 2x penuh
    }

    // Safety net: User Provisional tidak boleh turun di bawah titik awal (750)
    if (isProvisional && totalEloChangeRaw < 0) {
        totalEloChangeRaw = 0;
    }

    const pointsEarned = Math.round(totalEloChangeRaw);
    const isExcellent = grade >= 75;

    const newDifficulty = determineDifficulty(userChapter.currentDifficulty, grade);
    const aiFeedback = buildFeedback(grade, correctAnswers, totalQuestions);
    const orderedAnswers = questions.map((_, index) => answerMap.get(index) || '');

    const [updatedChapter] = await prisma.$transaction([
        prisma.userChapter.update({
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
        }),
        prisma.user.update({
            where: { id: userId },
            data: { points: { increment: pointsEarned } },
        }),
        ...questionsToUpdate.map(q =>
            prisma.question.update({
                where: { id: q.id },
                data: { elo: Math.max(750, q.newElo) } // Batas minimum rating soal
            })
        )
    ]);

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