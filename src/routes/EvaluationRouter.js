const express = require('express');
const axios = require('axios');
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

function toTodayUntilSundayWIBRange() {
    // Build a calendar-day range in WIB (UTC+7): today 00:00:00 through upcoming Sunday 23:59:59.999.
    const now = new Date();
    const wibNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const wibDay = wibNow.getUTCDay(); // 0=Sunday
    const daysToSunday = (7 - wibDay) % 7;

    const wibStart = new Date(Date.UTC(
        wibNow.getUTCFullYear(),
        wibNow.getUTCMonth(),
        wibNow.getUTCDate(),
        0, 0, 0, 0,
    ));

    const wibEnd = new Date(Date.UTC(
        wibNow.getUTCFullYear(),
        wibNow.getUTCMonth(),
        wibNow.getUTCDate() + daysToSunday,
        23, 59, 59, 999,
    ));

    // Convert WIB wall-clock back to UTC timestamps for DB filtering.
    return {
        start: new Date(wibStart.getTime() - 7 * 60 * 60 * 1000),
        end: new Date(wibEnd.getTime() - 7 * 60 * 60 * 1000),
    };
}

function groupByDay(rows, dateField) {
    const map = {};
    for (const row of rows) {
        const day = new Date(row[dateField]).toISOString().slice(0, 10);
        map[day] = (map[day] || 0) + 1;
    }
    return Object.entries(map).map(([date, count]) => ({ date, count }));
}

function toIsoDate(dateValue) {
    if (!dateValue) return null;
    return new Date(dateValue).toISOString();
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function round2(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
    return parseFloat(Number(value).toFixed(2));
}

function toSheetRow(userId, summary) {
    const periodDays = summary?.period?.totalDays || 1;
    const sessionsTotal = summary?.sessions?.total || 0;
    const returnRatePct = summary?.sessions?.returnRatePct || 0;
    const avgDurationSec = summary?.sessions?.avgDurationSec || 0;
    const avgGrade = summary?.assessments?.avgGrade || 0;
    const totalPointsEarned = summary?.assessments?.totalPointsEarned || 0;
    const chaptersCompleted = summary?.chapters?.totalCompleted || 0;
    const chatUserMessages = summary?.chat?.userMessages || 0;
    const qScores = summary?.questionnaire?.latest || null;

    // Lightweight proxy scores (0-100) for SDT dimensions from behavioral logs.
    const sessionsPerDayPct = clamp(Math.round((sessionsTotal / periodDays) * 100), 0, 100);
    const durationPct = clamp(Math.round((avgDurationSec / 1800) * 100), 0, 100); // 30 min baseline
    const autonomyScore = Math.round((returnRatePct + sessionsPerDayPct + durationPct) / 3);

    const chapterPct = clamp(Math.round((chaptersCompleted / periodDays) * 100), 0, 100);
    const pointsPct = clamp(totalPointsEarned, 0, 100);
    const competenceScore = Math.round((avgGrade + chapterPct + pointsPct) / 3);

    const chatPerDayPct = clamp(Math.round((chatUserMessages / periodDays) * 20), 0, 100);
    const relatednessScore = chatPerDayPct;

    // Questionnaire-based SDT and engagement scores (Likert 1-5).
    // These are paper-aligned direct questionnaire aggregates, separate from behavioral proxy scores above.
    const qAutonomy = qScores?.q1Autonomy ?? null;
    const qCompetence = qScores ? round2((qScores.q2Competence1 + qScores.q3Competence2) / 2) : null;
    const qRelatedness = qScores?.q4Relatedness ?? null;
    const qSdtOverall = qScores
        ? round2((qScores.q1Autonomy + qScores.q2Competence1 + qScores.q3Competence2 + qScores.q4Relatedness) / 4)
        : null;

    const qBehavioral = qScores?.q5Behavioral ?? null;
    const qCognitive = qScores?.q6Cognitive ?? null;
    const qEmotional = qScores?.q7Emotional ?? null;
    const qEngagementOverall = qScores
        ? round2((qScores.q5Behavioral + qScores.q6Cognitive + qScores.q7Emotional) / 3)
        : null;
    const qGlobalOverall = qScores?.q8Overall ?? null;

    return {
        syncedAt: new Date().toISOString(),
        userId,
        studentId: summary?.user?.studentId || null,
        studentName: summary?.user?.name || null,
        periodStart: toIsoDate(summary?.period?.start),
        periodEnd: toIsoDate(summary?.period?.end),
        periodDays,
        sessionsTotal,
        activeDays: summary?.sessions?.activeDays || 0,
        returnRatePct,
        avgSessionDurationSec: avgDurationSec,
        assessmentsSubmitted: summary?.assessments?.totalSubmitted || 0,
        avgGrade,
        totalPointsEarned,
        badgesEarned: summary?.badges?.totalEarned || 0,
        chaptersCompleted,
        chatSessions: summary?.chat?.totalSessions || 0,
        chatMessages: summary?.chat?.totalMessages || 0,
        chatUserMessages,
        // Behavioral proxy SDT scores (0-100)
        sdtAutonomyScore: autonomyScore,
        sdtCompetenceScore: competenceScore,
        sdtRelatednessScore: relatednessScore,
        // Questionnaire-based SDT and engagement scores (Likert 1-5)
        sdtAutonomyLikert: qAutonomy,
        sdtCompetenceLikert: qCompetence,
        sdtRelatednessLikert: qRelatedness,
        sdtOverallLikert: qSdtOverall,
        engagementBehavioralLikert: qBehavioral,
        engagementCognitiveLikert: qCognitive,
        engagementEmotionalLikert: qEmotional,
        engagementOverallLikert: qEngagementOverall,
        globalOverallLikert: qGlobalOverall,
        questionnaireSubmittedAt: qScores?.submittedAt || null,
    };
}

// payload: { rows: [...logRows], questionnaire: [...qRows] }
async function postRowsToGoogleSheets(payload) {
    const webhookUrl = process.env.GSHEETS_WEBHOOK_URL;
    const webhookSecret = process.env.GSHEETS_WEBHOOK_SECRET || '';
    const configuredTimeout = Number(process.env.GSHEETS_WEBHOOK_TIMEOUT_MS);
    const webhookTimeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0
        ? configuredTimeout
        : 60000;

    if (!webhookUrl) {
        return { ok: false, message: 'GSHEETS_WEBHOOK_URL is not configured' };
    }

    try {
        const response = await axios.post(
            webhookUrl,
            {
                source: 'levelearn-backend',
                secret: webhookSecret,
                rows: payload.rows,
                questionnaire: payload.questionnaire || [],
            },
            {
                timeout: webhookTimeoutMs,
            }
        );

        return {
            ok: true,
            status: response.status,
            data: response.data,
        };
    } catch (error) {
        return {
            ok: false,
            message: error?.response?.data?.message || error.message,
            status: error?.response?.status || null,
        };
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

async function syncEvaluationToGoogleSheets({ start, end, syncAll, targetUserId }) {
    const logRows = [];

    if (syncAll) {
        const students = await prisma.user.findMany({
            where: { role: 'STUDENT' },
            select: { id: true },
        });

        for (const student of students) {
            const summary = await computeSummary(student.id, start, end);
            logRows.push(toSheetRow(student.id, summary));
        }
    } else {
        if (!targetUserId) {
            throw new Error('userId required when syncAll is false');
        }

        const summary = await computeSummary(targetUserId, start, end);
        logRows.push(toSheetRow(targetUserId, summary));
    }

    const qFilter = syncAll ? {} : { userId: targetUserId };
    const qRaw = await prisma.evaluationQuestionnaire.findMany({
        where: qFilter,
        include: { user: { select: { name: true, studentId: true } } },
        orderBy: { submittedAt: 'asc' },
    });

    const questionnaireRows = qRaw.map((r) => ({
        syncedAt: new Date().toISOString(),
        userId: r.userId,
        studentId: r.user?.studentId,
        studentName: r.user?.name,
        submittedAt: r.submittedAt,
        q1Autonomy: r.q1Autonomy,
        q2Competence1: r.q2Competence1,
        q3Competence2: r.q3Competence2,
        q4Relatedness: r.q4Relatedness,
        q5Behavioral: r.q5Behavioral,
        q6Cognitive: r.q6Cognitive,
        q7Emotional: r.q7Emotional,
        q8Overall: r.q8Overall,
        sdtAutonomy: r.q1Autonomy,
        sdtCompetence: round2((r.q2Competence1 + r.q3Competence2) / 2),
        sdtRelatedness: r.q4Relatedness,
        avgSDT: parseFloat(((r.q1Autonomy + r.q2Competence1 + r.q3Competence2 + r.q4Relatedness) / 4).toFixed(2)),
        engagementBehavioral: r.q5Behavioral,
        engagementCognitive: r.q6Cognitive,
        engagementEmotional: r.q7Emotional,
        avgEngagement: parseFloat(((r.q5Behavioral + r.q6Cognitive + r.q7Emotional) / 3).toFixed(2)),
    }));

    const syncResult = await postRowsToGoogleSheets({
        rows: logRows,
        questionnaire: questionnaireRows,
    });

    return {
        syncResult,
        syncedLogRows: logRows.length,
        syncedQuestionnaireRows: questionnaireRows.length,
        period: { start, end },
    };
}

// ─── POST /evaluation/session/end ───────────────────────────────────────────
// Called by client on logout or app close to record session duration.
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
            data: { logoutAt, lastActiveAt: logoutAt, durationSec },
        });

        res.json({ durationSec });
    } catch (err) {
        console.error('[EvaluationRouter] session/end:', err.message);
        res.sendStatus(503);
    }
});

// ─── POST /evaluation/session/heartbeat ─────────────────────────────────────
// Called periodically (every ~60 s) to keep lastActiveAt fresh.
router.post('/evaluation/session/heartbeat', authMiddleware, async (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ message: 'sessionId required' });

    try {
        const session = await prisma.userSession.findUnique({ where: { id: Number(sessionId) } });
        if (!session || session.userId !== req.user.id) {
            return res.status(404).json({ message: 'Session not found' });
        }

        await prisma.userSession.update({
            where: { id: session.id },
            data: { lastActiveAt: new Date() },
        });

        res.json({ ok: true });
    } catch (err) {
        console.error('[EvaluationRouter] heartbeat:', err.message);
        res.sendStatus(503);
    }
});

// ─── GET /evaluation/summary?userId=X&startDate=Y&endDate=Z ─────────────────
// For instructors/admins to view a specific student's log summary.
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

// ─── GET /evaluation/summary/me?startDate=Y&endDate=Z ───────────────────────
// Students see their own summary.
router.get('/evaluation/summary/me', authMiddleware, async (req, res) => {
    const { start, end } = toDateRange(req.query.startDate, req.query.endDate);
    return buildSummary(req.user.id, start, end, res);
});

// ─── GET /evaluation/summary/all?startDate=Y&endDate=Z ──────────────────────
// Admin/instructor: summary of ALL students for export.
router.get('/evaluation/summary/all', authMiddleware, async (req, res) => {
    const { role: callerRole } = req.user;
    if (callerRole !== 'INSTRUCTOR' && callerRole !== 'ADMIN') {
        return res.status(403).json({ message: 'Forbidden' });
    }

    const { start, end } = toDateRange(req.query.startDate, req.query.endDate);

    try {
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

        res.json({ period: { start, end }, students: results });
    } catch (err) {
        console.error('[EvaluationRouter] summary/all:', err.message);
        res.sendStatus(503);
    }
});

// ─── POST /evaluation/sync/google-sheets ───────────────────────────────────
// Sync all log summaries + questionnaire responses to Google Sheets in one call.
router.post('/evaluation/sync/google-sheets', authMiddleware, async (req, res) => {
    const { role: callerRole } = req.user;
    if (callerRole !== 'INSTRUCTOR' && callerRole !== 'ADMIN') {
        return res.status(403).json({ message: 'Forbidden' });
    }

    const { start, end } = toDateRange(req.body?.startDate, req.body?.endDate);
    const syncAll = Boolean(req.body?.syncAll);
    const targetUserId = Number(req.body?.userId);

    try {
        const result = await syncEvaluationToGoogleSheets({
            start,
            end,
            syncAll,
            targetUserId,
        });

        const { syncResult, syncedLogRows, syncedQuestionnaireRows, period } = result;

        if (!syncResult.ok) {
            return res.status(502).json({
                message: 'Failed to sync to Google Sheets',
                detail: syncResult.message,
                status: syncResult.status,
            });
        }

        res.json({
            message: 'Synced to Google Sheets',
            syncedLogRows,
            syncedQuestionnaireRows,
            period,
            providerResponse: syncResult.data,
        });
    } catch (err) {
        if (err.message === 'userId required when syncAll is false') {
            return res.status(400).json({ message: err.message });
        }
        console.error('[EvaluationRouter] sync/google-sheets:', err.message);
        res.sendStatus(503);
    }
});

// ─── GET /evaluation/sync/google-sheets/cron ───────────────────────────────
// Vercel Cron entrypoint (protected by CRON_SECRET bearer token).
router.get('/evaluation/sync/google-sheets/cron', async (req, res) => {
    const cronSecret = process.env.CRON_SECRET;
    const auth = req.headers.authorization || '';
    const expected = cronSecret ? `Bearer ${cronSecret}` : null;

    if (!expected || auth !== expected) {
        return res.status(401).json({ message: 'Unauthorized cron request' });
    }

    const cronStart = process.env.GSHEETS_CRON_START_DATE || undefined;
    const cronEnd = process.env.GSHEETS_CRON_END_DATE || undefined;
    const hasExplicitRange = Boolean(cronStart || cronEnd);
    const { start, end } = hasExplicitRange
        ? toDateRange(cronStart, cronEnd)
        : toTodayUntilSundayWIBRange();

    try {
        const result = await syncEvaluationToGoogleSheets({
            start,
            end,
            syncAll: true,
            targetUserId: null,
        });

        const { syncResult, syncedLogRows, syncedQuestionnaireRows, period } = result;

        if (!syncResult.ok) {
            return res.status(502).json({
                message: 'Failed to sync to Google Sheets',
                detail: syncResult.message,
                status: syncResult.status,
            });
        }

        return res.json({
            message: 'Cron sync completed',
            syncedLogRows,
            syncedQuestionnaireRows,
            period,
            providerResponse: syncResult.data,
        });
    } catch (err) {
        console.error('[EvaluationRouter] cron sync:', err.message);
        return res.sendStatus(503);
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
        // 1. Sessions in period
        prisma.userSession.findMany({
            where: { userId, loginAt: { gte: start, lte: end } },
            select: { id: true, loginAt: true, logoutAt: true, durationSec: true, lastActiveAt: true },
            orderBy: { loginAt: 'asc' },
        }),
        // 2. Submitted assessments in period
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
        // 3. Badges earned in period
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
        // 4. Chapters completed in period
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
        // 5. Current user snapshot
        prisma.user.findUnique({
            where: { id: userId },
            select: { points: true, badges: true, elo: true, name: true, studentId: true },
        }),
        // 6. Chat stats from Supabase
        getChatStats(userId, start, end),
        // 7. Questionnaire responses in period
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

    // Sessions metrics
    const completedSessions = sessionsRaw.filter((s) => s.durationSec !== null);
    const avgDuration =
        completedSessions.length > 0
            ? Math.round(completedSessions.reduce((acc, s) => acc + s.durationSec, 0) / completedSessions.length)
            : null;
    const sessionsPerDay = groupByDay(sessionsRaw, 'loginAt');

    // Assessment metrics
    const grades = assessmentsRaw.filter((a) => a.grade !== null).map((a) => a.grade);
    const avgGrade = grades.length > 0 ? Math.round(grades.reduce((a, b) => a + b, 0) / grades.length) : null;
    const totalPointsEarned = assessmentsRaw.reduce((acc, a) => acc + (a.pointsEarned || 0), 0);
    const assessmentsPerDay = groupByDay(assessmentsRaw, 'submittedAt');

    // Return rate: % of days with session relative to total days in period
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
        // SDT: Autonomy indicators
        sessions: {
            total: sessionsRaw.length,
            activeDays,
            returnRatePct: returnRate,
            avgDurationSec: avgDuration,
            perDay: sessionsPerDay,
            raw: sessionsRaw,
        },
        // SDT: Competence indicators
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
        // SDT: Relatedness + Cognitive Engagement
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
        const summary = await computeSummary(userId, start, end);
        res.json({ userId, ...summary });
    } catch (err) {
        console.error('[EvaluationRouter] buildSummary:', err.message);
        res.sendStatus(503);
    }
}

// ─── POST /evaluation/questionnaire ─────────────────────────────────────────
// Called once by the student after the evaluation period ends.
// Body: { q1, q2, q3, q4, q5, q6, q7, q8 }  — each integer 1-5
router.post('/evaluation/questionnaire', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const { q1, q2, q3, q4, q5, q6, q7, q8 } = req.body;

    // Basic validation
    const values = [q1, q2, q3, q4, q5, q6, q7, q8];
    if (values.some((v) => !Number.isInteger(Number(v)) || Number(v) < 1 || Number(v) > 5)) {
        return res.status(400).json({ message: 'Each answer must be an integer 1-5' });
    }

    try {
        // Prevent duplicate submission
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

        res.status(201).json({ id: record.id, submittedAt: record.submittedAt });
    } catch (err) {
        console.error('[EvaluationRouter] questionnaire:', err.message);
        res.sendStatus(503);
    }
});

// ─── GET /evaluation/questionnaire/all ───────────────────────────────────────
// Instructor/admin: export all questionnaire responses.
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
