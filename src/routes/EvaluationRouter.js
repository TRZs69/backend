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

function toSheetRow(userId, summary) {
    const periodDays = summary?.period?.totalDays || 1;
    const sessionsTotal = summary?.sessions?.total || 0;
    const returnRatePct = summary?.sessions?.returnRatePct || 0;
    const avgDurationSec = summary?.sessions?.avgDurationSec || 0;
    const avgGrade = summary?.assessments?.avgGrade || 0;
    const totalPointsEarned = summary?.assessments?.totalPointsEarned || 0;
    const chaptersCompleted = summary?.chapters?.totalCompleted || 0;
    const chatUserMessages = summary?.chat?.userMessages || 0;

    // Lightweight proxy scores (0-100) for SDT dimensions from behavioral logs.
    const sessionsPerDayPct = clamp(Math.round((sessionsTotal / periodDays) * 100), 0, 100);
    const durationPct = clamp(Math.round((avgDurationSec / 1800) * 100), 0, 100); // 30 min baseline
    const autonomyScore = Math.round((returnRatePct + sessionsPerDayPct + durationPct) / 3);

    const chapterPct = clamp(Math.round((chaptersCompleted / periodDays) * 100), 0, 100);
    const pointsPct = clamp(totalPointsEarned, 0, 100);
    const competenceScore = Math.round((avgGrade + chapterPct + pointsPct) / 3);

    const chatPerDayPct = clamp(Math.round((chatUserMessages / periodDays) * 20), 0, 100);
    const relatednessScore = chatPerDayPct;

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
        sdtAutonomyScore: autonomyScore,
        sdtCompetenceScore: competenceScore,
        sdtRelatednessScore: relatednessScore,
    };
}

async function postRowsToGoogleSheets(rows) {
    const webhookUrl = process.env.GSHEETS_WEBHOOK_URL;
    const webhookSecret = process.env.GSHEETS_WEBHOOK_SECRET || '';

    if (!webhookUrl) {
        return { ok: false, message: 'GSHEETS_WEBHOOK_URL is not configured' };
    }

    try {
        const response = await axios.post(
            webhookUrl,
            {
                source: 'levelearn-backend',
                secret: webhookSecret,
                rows,
            },
            {
                timeout: 15000,
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
// Sync one user or all students summaries to Google Sheets (via webhook).
router.post('/evaluation/sync/google-sheets', authMiddleware, async (req, res) => {
    const { role: callerRole } = req.user;
    if (callerRole !== 'INSTRUCTOR' && callerRole !== 'ADMIN') {
        return res.status(403).json({ message: 'Forbidden' });
    }

    const { start, end } = toDateRange(req.body?.startDate, req.body?.endDate);
    const syncAll = Boolean(req.body?.syncAll);
    const targetUserId = Number(req.body?.userId);

    try {
        const rows = [];

        if (syncAll) {
            const students = await prisma.user.findMany({
                where: { role: 'STUDENT' },
                select: { id: true },
            });

            for (const student of students) {
                const summary = await computeSummary(student.id, start, end);
                rows.push(toSheetRow(student.id, summary));
            }
        } else {
            if (!targetUserId) {
                return res.status(400).json({ message: 'userId required when syncAll is false' });
            }

            const summary = await computeSummary(targetUserId, start, end);
            rows.push(toSheetRow(targetUserId, summary));
        }

        const syncResult = await postRowsToGoogleSheets(rows);
        if (!syncResult.ok) {
            return res.status(502).json({
                message: 'Failed to sync to Google Sheets',
                detail: syncResult.message,
                status: syncResult.status,
            });
        }

        res.json({
            message: 'Synced to Google Sheets',
            syncedRows: rows.length,
            period: { start, end },
            providerResponse: syncResult.data,
        });
    } catch (err) {
        console.error('[EvaluationRouter] sync/google-sheets:', err.message);
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

module.exports = router;
