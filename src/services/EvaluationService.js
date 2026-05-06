const prisma = require('../prismaClient');
const supabase = require('../../supabase/supabase.js');

// ─── ELO Badge Bands ────────────────────────────────────────────────────────────
const ELO_BADGE_BANDS = [
    { name: 'Beginner', min: 750 },
    { name: 'Basic Understanding', min: 1000 },
    { name: 'Developing Learner', min: 1200 },
    { name: 'Intermediate', min: 1400 },
    { name: 'Proficient', min: 1600 },
    { name: 'Advanced', min: 1800 },
    { name: 'Mastery', min: 2000 },
];

// ─── Normalization Constants ────────────────────────────────────────────────────
// These "max expected" values define what a highly-engaged user looks like
// over the evaluation period. They are used to normalize raw counts to 0–100.

const MAX_EXPECTED_SESSIONS = 20;            // ~3 sessions/day over a 6-day window
const MAX_EXPECTED_ASSESSMENTS = 10;         // Reasonable upper bound of quiz submissions
const MAX_EXPECTED_CHAT_MESSAGES = 50;       // Active chatbot users send ~50 messages
const MAX_EXPECTED_AVG_DURATION_SEC = 1800;  // 30 min average session = very engaged
const MAX_EXPECTED_CHAPTERS = 8;             // Total chapter count in the course

// Weights for composite metrics
const BEHAVIORAL_WEIGHTS = { sessions: 0.35, assessments: 0.35, chatMessages: 0.30 };
const CONSISTENCY_WEIGHTS = { activeDays: 0.50, returnRate: 0.50 };
const PERSISTENCE_WEIGHTS = { duration: 0.50, assessments: 0.50 };
const USAGE_INTENSITY_WEIGHTS = { sessions: 0.50, duration: 0.50 };
const FEATURE_UTILIZATION_WEIGHTS = { chatbot: 0.34, assessments: 0.33, gamification: 0.33 };

// Feature utilization thresholds — binary "used or not" with graded intensity
const FEATURE_CHAT_THRESHOLD = 1;       // ≥1 chat session = chatbot used
const FEATURE_ASSESSMENT_THRESHOLD = 1;  // ≥1 assessment submitted = assessments used
const FEATURE_GAMIFICATION_THRESHOLD = 1;// ≥1 badge or >0 points = gamification used

// ─── Helper Functions ───────────────────────────────────────────────────────────

/**
 * Normalize a raw value to a 0–100 scale based on an expected maximum.
 * Values exceeding maxExpected are capped at 100.
 * @param {number} value     - raw metric value
 * @param {number} maxExpected - value considered "100%"
 * @returns {number} normalized score (0–100), rounded to nearest integer
 */
function normalizeTo100(value, maxExpected) {
    if (!maxExpected || maxExpected <= 0) return 0;
    const raw = (value || 0) / maxExpected;
    return clamp(Math.round(raw * 100), 0, 100);
}

/**
 * Safe division that returns a fallback when the divisor is zero or falsy.
 * @param {number} a        - numerator
 * @param {number} b        - denominator
 * @param {number} fallback - value to return when b is 0 (default: 0)
 * @returns {number}
 */
function safeDivide(a, b, fallback = 0) {
    if (!b || b === 0) return fallback;
    return a / b;
}

/**
 * Compute a weighted average from parallel arrays of values and weights.
 * Both arrays must have the same length.
 * @param {number[]} values  - individual scores
 * @param {number[]} weights - corresponding weights (should sum to 1)
 * @returns {number} weighted average, rounded to nearest integer
 */
function weightedAverage(values, weights) {
    if (!values || !weights || values.length !== weights.length || values.length === 0) return 0;
    let sum = 0;
    let wSum = 0;
    for (let i = 0; i < values.length; i++) {
        sum += (values[i] || 0) * (weights[i] || 0);
        wSum += (weights[i] || 0);
    }
    if (wSum === 0) return 0;
    return Math.round(sum / wSum);
}

// ─── Existing Utilities (unchanged) ─────────────────────────────────────────────

// Default evaluation period: 6 Mei 2026 – 13 Mei 2026 (7 continuous days)
const DEFAULT_PERIOD_START = '2026-05-06T00:00:00.000Z';
const DEFAULT_PERIOD_END   = '2026-05-13T23:59:59.999Z';
const DEFAULT_PERIOD_DAYS  = 7;

function toDateRange(startDate, endDate) {
    const start = startDate ? new Date(startDate) : new Date(DEFAULT_PERIOD_START);
    const end = endDate ? new Date(endDate) : new Date(DEFAULT_PERIOD_END);

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

// ─── Supabase Chat Stats (unchanged) ────────────────────────────────────────────

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

// ─── Data Aggregation (unchanged) ───────────────────────────────────────────────

async function computeSummary(userId, start, end) {
    let [
        sessionsRaw,
        assessmentsRaw,
        badgesRaw,
        chaptersRaw,
        user,
        chatStats,
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
    ]);

    // No split-window filtering needed — the Prisma/Supabase queries
    // already filter by the continuous [start, end] range.

    const completedSessions = sessionsRaw.filter((s) => s.durationSec !== null);
    const avgDuration =
        completedSessions.length > 0
            ? Math.round(completedSessions.reduce((acc, s) => acc + s.durationSec, 0) / completedSessions.length)
            : null;

    const grades = assessmentsRaw.filter((a) => a.grade !== null).map((a) => a.grade);
    const avgGrade = grades.length > 0 ? Math.round(grades.reduce((a, b) => a + b, 0) / grades.length) : null;
    const totalPointsEarned = assessmentsRaw.reduce((acc, a) => acc + (a.pointsEarned || 0), 0);

    // Calculate period length in days (continuous window)
    const periodDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
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
    };
}

// ─── Payload Builder (REFACTORED — SDT removed, log-based metrics added) ───────

function toSummaryPayload(userId, summary) {
    // ── Extract base metrics from computed summary ──────────────────────────
    const periodDays        = summary?.period?.totalDays || 1;
    const sessionsTotal     = summary?.sessions?.total || 0;
    const activeDays        = summary?.sessions?.activeDays || 0;
    const returnRatePct     = summary?.sessions?.returnRatePct || 0;
    const avgDurationSec    = summary?.sessions?.avgDurationSec || 0;
    const assessmentsSubmitted = summary?.assessments?.totalSubmitted || 0;
    const avgGrade          = summary?.assessments?.avgGrade || 0;
    const totalPointsEarned = summary?.assessments?.totalPointsEarned || 0;
    const badgesEarned      = summary?.badges?.totalEarned || 0;
    const chaptersCompleted = summary?.chapters?.totalCompleted || 0;
    const chatSessions      = summary?.chat?.totalSessions || 0;
    const chatMessages      = summary?.chat?.totalMessages || 0;
    const chatUserMessages  = summary?.chat?.userMessages || 0;

    // ═══════════════════════════════════════════════════════════════════════════
    // A. ENGAGEMENT – BEHAVIORAL SCORE (0–100)
    // ─────────────────────────────────────────────────────────────────────────
    // Measures breadth of interaction: how many sessions, assessments, and
    // chat messages the user produced. Each component is normalized to its
    // own expected maximum, then combined via weighted average.
    //
    // Formula:  0.35 × norm(sessions) + 0.35 × norm(assessments) + 0.30 × norm(chat_messages)
    // ═══════════════════════════════════════════════════════════════════════════
    const behavioralSessions    = normalizeTo100(sessionsTotal, MAX_EXPECTED_SESSIONS);
    const behavioralAssessments = normalizeTo100(assessmentsSubmitted, MAX_EXPECTED_ASSESSMENTS);
    const behavioralChat        = normalizeTo100(chatUserMessages, MAX_EXPECTED_CHAT_MESSAGES);
    const engagementBehavioralScore = weightedAverage(
        [behavioralSessions, behavioralAssessments, behavioralChat],
        [BEHAVIORAL_WEIGHTS.sessions, BEHAVIORAL_WEIGHTS.assessments, BEHAVIORAL_WEIGHTS.chatMessages]
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // B. ENGAGEMENT – CONSISTENCY SCORE (0–100)
    // ─────────────────────────────────────────────────────────────────────────
    // Measures regularity of usage over the evaluation period.
    // active_days is normalized against the period length; return_rate_pct
    // is already a percentage.
    //
    // Formula:  0.50 × norm(active_days / period_days) + 0.50 × return_rate_pct
    // ═══════════════════════════════════════════════════════════════════════════
    const activeDaysNorm = normalizeTo100(activeDays, periodDays);
    const engagementConsistencyScore = weightedAverage(
        [activeDaysNorm, returnRatePct],
        [CONSISTENCY_WEIGHTS.activeDays, CONSISTENCY_WEIGHTS.returnRate]
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // C. ENGAGEMENT – PERSISTENCE SCORE (0–100)
    // ─────────────────────────────────────────────────────────────────────────
    // Approximates effort/perseverance: users who spend longer sessions AND
    // submit more assessments demonstrate higher persistence.
    //
    // Formula:  0.50 × norm(avg_duration) + 0.50 × norm(assessments)
    // ═══════════════════════════════════════════════════════════════════════════
    const durationNorm     = normalizeTo100(avgDurationSec, MAX_EXPECTED_AVG_DURATION_SEC);
    const assessmentsNorm  = normalizeTo100(assessmentsSubmitted, MAX_EXPECTED_ASSESSMENTS);
    const engagementPersistenceScore = weightedAverage(
        [durationNorm, assessmentsNorm],
        [PERSISTENCE_WEIGHTS.duration, PERSISTENCE_WEIGHTS.assessments]
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // D. SYSTEM USAGE INTENSITY (0–100)
    // ─────────────────────────────────────────────────────────────────────────
    // Reflects overall system usage volume: combines session count with
    // session depth (duration).
    //
    // Formula:  0.50 × norm(sessions) + 0.50 × norm(avg_duration)
    // ═══════════════════════════════════════════════════════════════════════════
    const systemUsageIntensity = weightedAverage(
        [behavioralSessions, durationNorm],
        [USAGE_INTENSITY_WEIGHTS.sessions, USAGE_INTENSITY_WEIGHTS.duration]
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // E. LEARNING PROGRESS RATE (0–100)
    // ─────────────────────────────────────────────────────────────────────────
    // Measures how many chapters the user completed relative to what is
    // available. Simple ratio normalized to 100.
    //
    // Formula:  (chapters_completed / MAX_EXPECTED_CHAPTERS) × 100
    // ═══════════════════════════════════════════════════════════════════════════
    const learningProgressRate = normalizeTo100(chaptersCompleted, MAX_EXPECTED_CHAPTERS);

    // ═══════════════════════════════════════════════════════════════════════════
    // F. FEATURE UTILIZATION SCORE (0–100)
    // ─────────────────────────────────────────────────────────────────────────
    // Measures breadth of platform feature adoption. Each feature area
    // contributes a graded score (not just binary) based on usage intensity,
    // then averaged with equal-ish weights.
    //
    // Feature areas:
    //   • Chatbot:       intensity = norm(chat_sessions, MAX_EXPECTED_SESSIONS)
    //   • Assessments:   intensity = norm(assessments, MAX_EXPECTED_ASSESSMENTS)
    //   • Gamification:  intensity = norm(badges + has_points, MAX_EXPECTED_CHAPTERS)
    //
    // A user who touches all features scores higher than one who uses only one.
    // ═══════════════════════════════════════════════════════════════════════════
    const chatbotUtilization = chatSessions >= FEATURE_CHAT_THRESHOLD
        ? normalizeTo100(chatSessions, MAX_EXPECTED_SESSIONS)
        : 0;
    const assessmentUtilization = assessmentsSubmitted >= FEATURE_ASSESSMENT_THRESHOLD
        ? normalizeTo100(assessmentsSubmitted, MAX_EXPECTED_ASSESSMENTS)
        : 0;
    const gamificationRaw = (totalPointsEarned > 0 ? 1 : 0) + badgesEarned;
    const gamificationUtilization = gamificationRaw >= FEATURE_GAMIFICATION_THRESHOLD
        ? normalizeTo100(gamificationRaw, MAX_EXPECTED_CHAPTERS)
        : 0;
    const featureUtilizationScore = weightedAverage(
        [chatbotUtilization, assessmentUtilization, gamificationUtilization],
        [FEATURE_UTILIZATION_WEIGHTS.chatbot, FEATURE_UTILIZATION_WEIGHTS.assessments, FEATURE_UTILIZATION_WEIGHTS.gamification]
    );

    // ── Assemble final payload ──────────────────────────────────────────────
    return {
        user_id: userId,
        student_id: summary?.user?.studentId || null,
        student_name: summary?.user?.name || null,
        period_start: summary?.period?.start,
        period_end: summary?.period?.end,

        // Session metrics
        sessions_total: sessionsTotal,
        active_days: activeDays,
        return_rate_pct: returnRatePct,
        avg_session_duration_sec: avgDurationSec,

        // Assessment metrics
        assessments_submitted: assessmentsSubmitted,
        avg_grade: avgGrade,
        total_points_earned: totalPointsEarned,

        // Achievement metrics
        badges_earned: badgesEarned,
        chapters_completed: chaptersCompleted,

        // Chat metrics
        chat_sessions: chatSessions,
        chat_messages: chatMessages,
        chat_user_messages: chatUserMessages,

        // Engagement scores (log-based)
        engagement_behavioral_score: engagementBehavioralScore,
        engagement_consistency_score: engagementConsistencyScore,
        engagement_persistence_score: engagementPersistenceScore,

        // System effectiveness scores (log-based)
        system_usage_intensity: systemUsageIntensity,
        learning_progress_rate: learningProgressRate,
        feature_utilization_score: featureUtilizationScore,

        updated_at: new Date().toISOString(),
    };
}

// ─── Supabase Sync (unchanged) ──────────────────────────────────────────────────

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
    syncSummaryToSupabase,
    // Exported for testing / reuse
    normalizeTo100,
    safeDivide,
    weightedAverage,
};
