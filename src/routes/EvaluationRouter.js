const express = require('express');
const prisma = require('../prismaClient.js');
const authMiddleware = require('../middlewares/AuthMiddleware.js');
const supabase = require('../../supabase/supabase.js');

const router = express.Router();

// ─── helpers ────────────────────────────────────────────────────────────────

function toDateRange(startDate, endDate) {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);
    return { start, end };
}

function groupByDay(rows, dateField) {
    const map = {};
    for (const row of rows) {
        const day = new Date(row[dateField]).toISOString().slice(0, 10);
        map[day] = (map[day] || 0) + 1;
    }
    return Object.entries(map).map(([date, count]) => ({ date, count }));
}

function round2(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
    return parseFloat(Number(value).toFixed(2));
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function toSummaryPayload(userId, summary) {
    const periodDays = summary?.period?.totalDays || 1;
    const sessionsTotal = summary?.sessions?.total || 0;
    const returnRatePct = summary?.sessions?.returnRatePct || 0;
    const avgDurationSec = summary?.sessions?.avgDurationSec || 0;
    const avgGrade = summary?.assessments?.avgGrade || 0;
    const totalPointsEarned = summary?.assessments?.totalPointsEarned || 0;
    const chaptersCompleted = summary?.chapters?.totalCompleted || 0;
    const chatUserMessages = summary?.chat?.userMessages || 0;
    const qScores = summary?.questionnaire?.latest || null;

    // Behavioral proxies
    const sessionsPerDayPct = clamp(Math.round((sessionsTotal / periodDays) * 100), 0, 100);
    const durationPct = clamp(Math.round((avgDurationSec / 1800) * 100), 0, 100);
    const autonomyScore = Math.round((returnRatePct + sessionsPerDayPct + durationPct) / 3);

    const chapterPct = clamp(Math.round((chaptersCompleted / periodDays) * 100), 0, 100);
    const pointsPct = clamp(totalPointsEarned, 0, 100);
    const competenceScore = Math.round((avgGrade + chapterPct + pointsPct) / 3);

    const chatPerDayPct = clamp(Math.round((chatUserMessages / periodDays) * 20), 0, 100);
    const relatednessScore = chatPerDayPct;

    return {
        user_id: userId,
        student_id: summary?.user?.studentId || null,
        student_name: summary?.user?.name || null,
        period_start: summary?.period?.start,
        period_end: summary?.period?.end,
        sessions_total: sessionsTotal,
        active_days: summary?.sessions?.activeDays || 0,
        return_rate_pct: returnRatePct,
        avg_session_duration_sec: avgDurationSec,
        assessments_submitted: summary?.assessments?.totalSubmitted || 0,
        avg_grade: avgGrade,
        total_points_earned: totalPointsEarned,
        badges_earned: summary?.badges?.totalEarned || 0,
        chapters_completed: chaptersCompleted,
        chat_sessions: summary?.chat?.totalSessions || 0,
        chat_messages: summary?.chat?.totalMessages || 0,
        chat_user_messages: chatUserMessages,
        sdt_autonomy_score: autonomyScore,
        sdt_competence_score: competenceScore,
        sdt_relatedness_score: relatednessScore,
        sdt_autonomy_likert: qScores?.q1Autonomy ?? null,
        sdt_competence_likert: qScores ? round2((qScores.q2Competence1 + qScores.q3Competence2) / 2) : null,
        sdt_relatedness_likert: qScores?.q4Relatedness ?? null,
        sdt_overall_likert: qScores ? round2((qScores.q1Autonomy + qScores.q2Competence1 + qScores.q3Competence2 + qScores.q4Relatedness) / 4) : null,
        engagement_behavioral_likert: qScores?.q5Behavioral ?? null,
        engagement_cognitive_likert: qScores?.q6Cognitive ?? null,
        engagement_emotional_likert: qScores?.q7Emotional ?? null,
        engagement_overall_likert: qScores ? round2((qScores.q5Behavioral + qScores.q6Cognitive + qScores.q7Emotional) / 3) : null,
        global_overall_likert: qScores?.q8Overall ?? null,
        updated_at: new Date().toISOString(),
    };
}

async function syncSummaryToSupabase(userId, start, end) {
    try {
        const summary = await computeSummary(userId, start, end);
        const payload = toSummaryPayload(userId, summary);

        const { error } = await supabase
            .from('student_summaries')
            .upsert(payload, { onConflict: 'user_id' });

        if (error) throw error;
        return { ok: true };
    } catch (err) {
        console.error('[EvaluationRouter] syncSummaryToSupabase:', err.message);
        return { ok: false, error: err.message };
    }
}

async function getChatStats(userId, start, end) {
    try {
        const { data: sessions, error: sessErr } = await supabase
            .from('chat_sessions')
            .select('id, created_at')
            .eq('user_id', userId)
            .gte('created_at', start.toISOString())
            .lte('created_at', end.toISOString());

        if (sessErr || !sessions || sessions.length === 0) {
            return { totalSessions: 0, totalMessages: 0, userMessages: 0, perDay: [] };
        }

        const sessionIds = sessions.map((s) => s.id);

        const { data: messages, error: msgErr } = await supabase
            .from('chat_messages')
            .select('id, role, created_at')
            .in('session_id', sessionIds);

        if (msgErr || !messages) {
            return { totalSessions: sessions.length, totalMessages: 0, userMessages: 0, perDay: [] };
        }

        const userMessages = messages.filter((m) => m.role === 'user');
        const perDay = groupByDay(userMessages, 'created_at');

        return {
            totalSessions: sessions.length,
            totalMessages: messages.length,
            userMessages: userMessages.length,
            perDay,
        };
    } catch {
        return { totalSessions: 0, totalMessages: 0, userMessages: 0, perDay: [] };
    }
}

router.post('/evaluation/session/end', authMiddleware, async (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ message: 'sessionId required' });

    try {
        const session = await prisma.userSession.findUnique({ where: { id: Number(sessionId) } });
        if (!session || session.userId !== req.user.id) {
            return res.status(404).json({ message: 'Session not found' });
        }
        if (session.logoutAt) {
            return res.json({ message: 'Already ended' });
        }

        const logoutAt = new Date();
        const durationSec = Math.round((logoutAt - session.loginAt) / 1000);

        await prisma.userSession.update({
            where: { id: session.id },
            data: { logoutAt, durationSec },
        });

        // Sync to Supabase in background
        const { start, end } = toDateRange(); 
        syncSummaryToSupabase(req.user.id, start, end);

        res.json({ durationSec });
    } catch (err) {
        console.error('[EvaluationRouter] session/end:', err.message);
        res.sendStatus(503);
    }
});

router.get('/evaluation/summary', authMiddleware, async (req, res) => {
    const { role: callerRole } = req.user;
    if (callerRole !== 'INSTRUCTOR' && callerRole !== 'ADMIN') {
        return res.status(403).json({ message: 'Forbidden' });
    }

    const targetUserId = Number(req.query.userId);
    if (!targetUserId) return res.status(400).json({ message: 'userId required' });

    const { start, end } = toDateRange(req.query.startDate, req.query.endDate);
    return buildSummary(targetUserId, start, end, res);
});

router.get('/evaluation/summary/me', authMiddleware, async (req, res) => {
    const { start, end } = toDateRange(req.query.startDate, req.query.endDate);
    return buildSummary(req.user.id, start, end, res);
});

router.get('/evaluation/summary/all', authMiddleware, async (req, res) => {
    const { role: callerRole } = req.user;
    if (callerRole !== 'INSTRUCTOR' && callerRole !== 'ADMIN') {
        return res.status(403).json({ message: 'Forbidden' });
    }

    const { start, end } = toDateRange(req.query.startDate, req.query.endDate);

    try {
        const { data: storedSummaries } = await supabase
            .from('student_summaries')
            .select('*');

        if (storedSummaries && storedSummaries.length > 0) {
            return res.json({ source: 'supabase', summaries: storedSummaries });
        }

        // Fallback to compute
        const students = await prisma.user.findMany({
            where: { role: 'STUDENT' },
            select: { id: true, name: true, studentId: true },
        });

        const results = await Promise.all(
            students.map(async (s) => {
                const summary = await computeSummary(s.id, start, end);
                return { userId: s.id, name: s.name, studentId: s.studentId, ...summary };
            })
        );

        res.json({ source: 'computed', period: { start, end }, students: results });
    } catch (err) {
        console.error('[EvaluationRouter] summary/all:', err.message);
        res.sendStatus(503);
    }
});

// ─── core logic ─────────────────────────────────────────────────────────────

async function computeSummary(userId, start, end) {
    const [
        sessionsRaw,
        assessmentsRaw,
        badgesRaw,
        chaptersRaw,
        user,
        chatStats,
        questionnairesRaw,
    ] = await Promise.all([
        prisma.userSession.findMany({
            where: { userId, loginAt: { gte: start, lte: end } },
            select: { id: true, loginAt: true, logoutAt: true, durationSec: true },
            orderBy: { loginAt: 'asc' },
        }),
        prisma.assessmentAttempt.findMany({
            where: {
                userId,
                status: 'SUBMITTED',
                submittedAt: { gte: start, lte: end },
            },
            select: {
                id: true, submittedAt: true, grade: true,
                pointsEarned: true, newDifficulty: true,
                currentUserElo: true, courseEloStart: true, courseEloEnd: true,
            },
            orderBy: { submittedAt: 'asc' },
        }),
        prisma.userBadge.findMany({
            where: {
                userId,
                isPurchased: false,
                awardedAt: { gte: start, lte: end },
            },
            select: {
                id: true, awardedAt: true,
                badge: { select: { name: true, type: true } },
            },
            orderBy: { awardedAt: 'asc' },
        }),
        prisma.userChapter.findMany({
            where: {
                userId,
                isCompleted: true,
                timeFinished: { gte: start, lte: end },
            },
            select: {
                id: true, timeFinished: true, currentDifficulty: true,
                assessmentGrade: true, assessmentPointsEarned: true,
                chapter: { select: { name: true, level: true } },
            },
            orderBy: { timeFinished: 'asc' },
        }),
        prisma.user.findUnique({
            where: { id: userId },
            select: { points: true, badges: true, elo: true, name: true, studentId: true },
        }),
        getChatStats(userId, start, end),
        prisma.evaluationQuestionnaire.findMany({
            where: {
                userId,
                submittedAt: { gte: start, lte: end },
            },
            select: {
                id: true,
                submittedAt: true,
                q1Autonomy: true,
                q2Competence1: true,
                q3Competence2: true,
                q4Relatedness: true,
                q5Behavioral: true,
                q6Cognitive: true,
                q7Emotional: true,
                q8Overall: true,
            },
            orderBy: { submittedAt: 'asc' },
        }),
    ]);

    const completedSessions = sessionsRaw.filter((s) => s.durationSec !== null);
    const avgDuration =
        completedSessions.length > 0
            ? Math.round(completedSessions.reduce((acc, s) => acc + s.durationSec, 0) / completedSessions.length)
            : null;
    const sessionsPerDay = groupByDay(sessionsRaw, 'loginAt');

    const grades = assessmentsRaw.filter((a) => a.grade !== null).map((a) => a.grade);
    const avgGrade = grades.length > 0 ? Math.round(grades.reduce((a, b) => a + b, 0) / grades.length) : null;
    const totalPointsEarned = assessmentsRaw.reduce((acc, a) => acc + (a.pointsEarned || 0), 0);
    const assessmentsPerDay = groupByDay(assessmentsRaw, 'submittedAt');

    const periodDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
    const activeDays = new Set(sessionsRaw.map((s) => s.loginAt.toISOString().slice(0, 10))).size;
    const returnRate = Math.round((activeDays / periodDays) * 100);

    const latestQuestionnaire = questionnairesRaw.length > 0 ? questionnairesRaw[questionnairesRaw.length - 1] : null;
    const avgQuestionnaire = questionnairesRaw.length > 0
        ? {
            q1Autonomy: round2(questionnairesRaw.reduce((acc, r) => acc + r.q1Autonomy, 0) / questionnairesRaw.length),
            q2Competence1: round2(questionnairesRaw.reduce((acc, r) => acc + r.q2Competence1, 0) / questionnairesRaw.length),
            q3Competence2: round2(questionnairesRaw.reduce((acc, r) => acc + r.q3Competence2, 0) / questionnairesRaw.length),
            q4Relatedness: round2(questionnairesRaw.reduce((acc, r) => acc + r.q4Relatedness, 0) / questionnairesRaw.length),
            q5Behavioral: round2(questionnairesRaw.reduce((acc, r) => acc + r.q5Behavioral, 0) / questionnairesRaw.length),
            q6Cognitive: round2(questionnairesRaw.reduce((acc, r) => acc + r.q6Cognitive, 0) / questionnairesRaw.length),
            q7Emotional: round2(questionnairesRaw.reduce((acc, r) => acc + r.q7Emotional, 0) / questionnairesRaw.length),
            q8Overall: round2(questionnairesRaw.reduce((acc, r) => acc + r.q8Overall, 0) / questionnairesRaw.length),
        }
        : null;

    const latestSdt = latestQuestionnaire
        ? {
            autonomy: latestQuestionnaire.q1Autonomy,
            competence: round2((latestQuestionnaire.q2Competence1 + latestQuestionnaire.q3Competence2) / 2),
            relatedness: latestQuestionnaire.q4Relatedness,
            overall: round2((
                latestQuestionnaire.q1Autonomy +
                latestQuestionnaire.q2Competence1 +
                latestQuestionnaire.q3Competence2 +
                latestQuestionnaire.q4Relatedness
            ) / 4),
        }
        : null;

    const latestEngagement = latestQuestionnaire
        ? {
            behavioral: latestQuestionnaire.q5Behavioral,
            cognitive: latestQuestionnaire.q6Cognitive,
            emotional: latestQuestionnaire.q7Emotional,
            overall: round2((
                latestQuestionnaire.q5Behavioral +
                latestQuestionnaire.q6Cognitive +
                latestQuestionnaire.q7Emotional
            ) / 3),
            global: latestQuestionnaire.q8Overall,
        }
        : null;

    return {
        period: { start, end, totalDays: periodDays },
        user: user || {},
        sessions: {
            total: sessionsRaw.length,
            activeDays,
            returnRatePct: returnRate,
            avgDurationSec: avgDuration,
            perDay: sessionsPerDay,
            raw: sessionsRaw,
        },
        assessments: {
            totalSubmitted: assessmentsRaw.length,
            avgGrade,
            totalPointsEarned,
            perDay: assessmentsPerDay,
        },
        badges: {
            totalEarned: badgesRaw.length,
            list: badgesRaw,
        },
        chapters: {
            totalCompleted: chaptersRaw.length,
            list: chaptersRaw,
        },
        chat: chatStats,
        questionnaire: {
            totalSubmitted: questionnairesRaw.length,
            latest: latestQuestionnaire,
            averages: avgQuestionnaire,
            sdt: latestSdt,
            engagement: latestEngagement,
            raw: questionnairesRaw,
        },
    };
}

async function buildSummary(userId, start, end, res) {
    try {
        const { data: storedSummary } = await supabase
            .from('student_summaries')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (storedSummary) {
            return res.json({ source: 'supabase', userId, ...storedSummary });
        }

        const summary = await computeSummary(userId, start, end);
        res.json({ source: 'computed', userId, ...summary });
    } catch (err) {
        console.error('[EvaluationRouter] buildSummary:', err.message);
        res.sendStatus(503);
    }
}

router.post('/evaluation/questionnaire', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const { q1, q2, q3, q4, q5, q6, q7, q8 } = req.body;

    const values = [q1, q2, q3, q4, q5, q6, q7, q8];
    if (values.some((v) => !Number.isInteger(Number(v)) || Number(v) < 1 || Number(v) > 5)) {
        return res.status(400).json({ message: 'Each answer must be an integer 1-5' });
    }

    try {
        const existing = await prisma.evaluationQuestionnaire.findFirst({
            where: { userId },
        });
        if (existing) {
            return res.status(409).json({ message: 'Questionnaire already submitted' });
        }

        const record = await prisma.evaluationQuestionnaire.create({
            data: {
                userId,
                q1Autonomy:    Number(q1),
                q2Competence1: Number(q2),
                q3Competence2: Number(q3),
                q4Relatedness: Number(q4),
                q5Behavioral:  Number(q5),
                q6Cognitive:   Number(q6),
                q7Emotional:   Number(q7),
                q8Overall:     Number(q8),
            },
        });

        // Sync to Supabase in background
        const { start, end } = toDateRange(); 
        syncSummaryToSupabase(userId, start, end);

        res.status(201).json({ id: record.id, submittedAt: record.submittedAt });
    } catch (err) {
        console.error('[EvaluationRouter] questionnaire:', err.message);
        res.sendStatus(503);
    }
});

router.get('/evaluation/questionnaire/all', authMiddleware, async (req, res) => {
    const { role: callerRole } = req.user;
    if (callerRole !== 'INSTRUCTOR' && callerRole !== 'ADMIN') {
        return res.status(403).json({ message: 'Forbidden' });
    }

    try {
        const rows = await prisma.evaluationQuestionnaire.findMany({
            include: { user: { select: { name: true, studentId: true } } },
            orderBy: { submittedAt: 'asc' },
        });

        const result = rows.map((r) => ({
            id: r.id,
            userId: r.userId,
            studentId: r.user?.studentId,
            studentName: r.user?.name,
            submittedAt: r.submittedAt,
            q1Autonomy:    r.q1Autonomy,
            q2Competence1: r.q2Competence1,
            q3Competence2: r.q3Competence2,
            q4Relatedness: r.q4Relatedness,
            q5Behavioral:  r.q5Behavioral,
            q6Cognitive:   r.q6Cognitive,
            q7Emotional:   r.q7Emotional,
            q8Overall:     r.q8Overall,
            avgSDT: parseFloat(
                ((r.q1Autonomy + r.q2Competence1 + r.q3Competence2 + r.q4Relatedness) / 4).toFixed(2)
            ),
            avgEngagement: parseFloat(
                ((r.q5Behavioral + r.q6Cognitive + r.q7Emotional) / 3).toFixed(2)
            ),
        }));

        res.json({ total: result.length, responses: result });
    } catch (err) {
        console.error('[EvaluationRouter] questionnaire/all:', err.message);
        res.sendStatus(503);
    }
});

module.exports = router;
