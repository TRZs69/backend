const prisma = require('../prismaClient');
const supabase = require('../../supabase/supabase.js');

const ELO_BADGE_BANDS = [
    { name: 'Beginner', min: 750 },
    { name: 'Basic Understanding', min: 1000 },
    { name: 'Developing Learner', min: 1200 },
    { name: 'Intermediate', min: 1400 },
    { name: 'Proficient', min: 1600 },
    { name: 'Advanced', min: 1800 },
    { name: 'Mastery', min: 2000 },
];

function toDateRange(startDate, endDate) {
    const start = startDate ? new Date(startDate) : new Date('2026-03-26T00:00:00.000Z');
    const end = endDate ? new Date(endDate) : new Date('2026-04-09T23:59:59.999Z');

    if (endDate && !endDate.includes('T')) {
        end.setHours(23, 59, 59, 999);
    }
    return { start, end };
}

function groupByDay(rows, dateField) {
    const map = {};
    for (const row of rows) {
        const wibDate = new Date(new Date(row[dateField]).getTime() + 7 * 60 * 60 * 1000);
        const day = wibDate.toISOString().slice(0, 10);
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

async function getChatStats(userId, start, end) {
    try {
        const isDefault = start.getTime() === new Date('2026-03-26T00:00:00.000Z').getTime() &&
                          end.getTime() === new Date('2026-04-09T23:59:59.999Z').getTime();
        const inWindow = (dStr) => {
            if (!dStr) return false;
            const d = new Date(dStr);
            const s1 = new Date('2026-03-26T00:00:00.000Z');
            const e1 = new Date('2026-03-29T23:59:59.999Z');
            const s2 = new Date('2026-04-08T00:00:00.000Z');
            const e2 = new Date('2026-04-09T23:59:59.999Z');
            return (d >= s1 && d <= e1) || (d >= s2 && d <= e2);
        };

        let { data: sessions, error: sessErr } = await supabase
            .from('chat_sessions')
            .select('id, created_at')
            .eq('user_id', userId)
            .gte('created_at', start.toISOString())
            .lte('created_at', end.toISOString());

        if (sessErr || !sessions || sessions.length === 0) {
            return { totalSessions: 0, totalMessages: 0, userMessages: 0, perDay: [] };
        }

        if (isDefault) {
            sessions = sessions.filter(s => inWindow(s.created_at));
        }

        if (sessions.length === 0) {
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

        let filteredMessages = messages;
        if (isDefault) {
            filteredMessages = messages.filter(m => inWindow(m.created_at));
        }

        const userMessages = filteredMessages.filter((m) => m.role === 'user');
        const perDay = groupByDay(userMessages, 'created_at');

        return {
            totalSessions: sessions.length,
            totalMessages: filteredMessages.length,
            userMessages: userMessages.length,
            perDay,
        };
    } catch {
        return { totalSessions: 0, totalMessages: 0, userMessages: 0, perDay: [] };
    }
}

async function computeSummary(userId, start, end) {
    let [
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
            select: { id: true, loginAt: true, logoutAt: true, durationSec: true, lastActiveAt: true },
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

    const isDefault = start.getTime() === new Date('2026-03-26T00:00:00.000Z').getTime() &&
                      end.getTime() === new Date('2026-04-09T23:59:59.999Z').getTime();

    if (isDefault) {
        const inWindow = (dStr) => {
            if (!dStr) return false;
            const d = new Date(dStr);
            const s1 = new Date('2026-03-26T00:00:00.000Z');
            const e1 = new Date('2026-03-29T23:59:59.999Z');
            const s2 = new Date('2026-04-08T00:00:00.000Z');
            const e2 = new Date('2026-04-09T23:59:59.999Z');
            return (d >= s1 && d <= e1) || (d >= s2 && d <= e2);
        };
        sessionsRaw = sessionsRaw.filter(s => inWindow(s.loginAt));
        assessmentsRaw = assessmentsRaw.filter(a => inWindow(a.submittedAt));
        badgesRaw = badgesRaw.filter(b => inWindow(b.awardedAt));
        chaptersRaw = chaptersRaw.filter(c => inWindow(c.timeFinished));
        questionnairesRaw = questionnairesRaw.filter(q => inWindow(q.submittedAt));
    }

    const completedSessions = sessionsRaw.filter((s) => s.durationSec !== null);
    const avgDuration =
        completedSessions.length > 0
            ? Math.round(completedSessions.reduce((acc, s) => acc + s.durationSec, 0) / completedSessions.length)
            : null;

    const grades = assessmentsRaw.filter((a) => a.grade !== null).map((a) => a.grade);
    const avgGrade = grades.length > 0 ? Math.round(grades.reduce((a, b) => a + b, 0) / grades.length) : null;
    const totalPointsEarned = assessmentsRaw.reduce((acc, a) => acc + (a.pointsEarned || 0), 0);

    let periodDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
    if (isDefault) {
        periodDays = 6; // March 26-29 (4 days) + April 8-9 (2 days)
    }
    const activeDaysSet = new Set();
    let calculatedSessionsTotal = 0;

    sessionsRaw.forEach((s) => {
        const sStart = new Date(s.loginAt.getTime() + 7 * 60 * 60 * 1000);
        const sLast = new Date((s.lastActiveAt || s.loginAt).getTime() + 7 * 60 * 60 * 1000);
        
        const startDayStr = sStart.toISOString().slice(0, 10);
        const lastDayStr = sLast.toISOString().slice(0, 10);

        if (startDayStr === lastDayStr) {
            calculatedSessionsTotal += 1;
            activeDaysSet.add(startDayStr);
        } else {
            let current = new Date(sStart.toISOString().slice(0, 10));
            while (current.toISOString().slice(0, 10) <= lastDayStr) {
                const currentDayStr = current.toISOString().slice(0, 10);
                activeDaysSet.add(currentDayStr);
                calculatedSessionsTotal += 1;
                current.setDate(current.getDate() + 1);
            }
        }
    });

    const activeDays = activeDaysSet.size;
    const sessionsTotal = calculatedSessionsTotal;
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

    const eloBadgeCount = ELO_BADGE_BANDS.filter((band) => (user?.elo || 750) >= band.min).length;
    const totalBadges = Math.max(eloBadgeCount, badgesRaw.length);

    return {
        period: { start, end, totalDays: periodDays },
        user: user || {},
        sessions: {
            total: sessionsTotal,
            activeDays,
            returnRatePct: returnRate,
            avgDurationSec: avgDuration,
        },
        assessments: {
            totalSubmitted: assessmentsRaw.length,
            avgGrade,
            totalPointsEarned,
        },
        badges: {
            totalEarned: totalBadges,
        },
        chapters: {
            totalCompleted: chaptersRaw.length,
        },
        chat: chatStats,
        questionnaire: {
            latest: latestQuestionnaire,
            averages: avgQuestionnaire,
        },
    };
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

    const sessionsPerDayPct = clamp(Math.round((sessionsTotal / periodDays) * 100), 0, 100);
    const durationPct = clamp(Math.round((avgDurationSec / 1800) * 100), 0, 100);
    const autonomyScore = Math.round((returnRatePct + sessionsPerDayPct + durationPct) / 3);

    const chapterPct = clamp(Math.round((chaptersCompleted / periodDays) * 100), 0, 100);
    const pointsPct = clamp(totalPointsEarned, 0, 100);
    const competenceScore = Math.round((avgGrade + chapterPct + pointsPct) / 3);

    // Option 3: Composite Score (Chat + Return Rate)
    // Normalized chat score (0-100) averaged with return rate for a stable relatedness metric
    const chatPerDayPct = clamp(Math.round((chatUserMessages / periodDays) * 20), 0, 100);
    const relatednessScore = Math.round((returnRatePct + chatPerDayPct) / 2);

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
        sdt_competence_1_likert: qScores?.q2Competence1 ?? null,
        sdt_competence_2_likert: qScores?.q3Competence2 ?? null,
        sdt_relatedness_likert: qScores?.q4Relatedness ?? null,
        engagement_behavioral_likert: qScores?.q5Behavioral ?? null,
        engagement_cognitive_likert: qScores?.q6Cognitive ?? null,
        engagement_emotional_likert: qScores?.q7Emotional ?? null,
        global_overall_likert: qScores?.q8Overall ?? null,
        updated_at: new Date().toISOString(),
    };
}

const supabaseSyncQueue = new Map();
const supabaseSyncTimeouts = new Map();

async function syncSummaryToSupabase(userId) {
    if (process.env.RENDER === 'true' || process.env.NODE_ENV === 'production') {
        return { ok: true, skipped: true };
    }

    if (supabaseSyncQueue.has(userId)) {
        return { ok: true, queued: true };
    }

    if (supabaseSyncTimeouts.has(userId)) {
        clearTimeout(supabaseSyncTimeouts.get(userId));
    }

    return new Promise((resolve) => {
        const timeout = setTimeout(async () => {
            supabaseSyncQueue.set(userId, true);
            supabaseSyncTimeouts.delete(userId);

            try {
                const { start, end } = toDateRange();
                const summary = await computeSummary(userId, start, end);
                const payload = toSummaryPayload(userId, summary);

                const { error } = await supabase
                    .from('student_summaries')
                    .upsert(payload, { onConflict: 'user_id' });

                if (error) throw error;
                resolve({ ok: true });
            } catch (err) {
                console.error('[EvaluationService] syncSummaryToSupabase:', err.message);
                resolve({ ok: false, error: err.message });
            } finally {
                supabaseSyncQueue.delete(userId);
            }
        }, 5000);

        supabaseSyncTimeouts.set(userId, timeout);
    });
}

module.exports = {
    toDateRange,
    computeSummary,
    toSummaryPayload,
    syncSummaryToSupabase
};
