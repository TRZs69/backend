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
const FEATURE_UTILIZATION_WEIGHTS = { chatbot: 0.25, assessments: 0.25, material: 0.25, assignment: 0.25 };

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
const DEFAULT_PERIOD_END = '2026-05-13T23:59:59.999Z';
const DEFAULT_PERIOD_DAYS = 7;

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
        totalAvailableChapters,
        userChapterActivity,
    ] = await Promise.all([
        prisma.userSession.findMany({
            where: { userId, loginAt: { gte: start, lte: end } },
            select: { id: true, loginAt: true, logoutAt: true, durationSec: true, lastActiveAt: true },
            orderBy: { loginAt: 'asc' },
        }),
        prisma.assessmentAttempt.findMany({
            where: {
                userId,
                updatedAt: { gte: start, lte: end },
            },
            select: {
                id: true, submittedAt: true, grade: true, status: true,
                pointsEarned: true, newDifficulty: true,
                currentUserElo: true, courseEloStart: true, courseEloEnd: true,
            },
            orderBy: { updatedAt: 'asc' },
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
        prisma.chapter.count(),
        prisma.userChapter.findMany({
            where: { userId, updatedAt: { gte: start, lte: end } },
            select: { materialDone: true, assignmentDone: true, assessmentDone: true }
        }),
    ]);

    // No split-window filtering needed — the Prisma/Supabase queries
    // already filter by the continuous [start, end] range.

    const completedSessions = sessionsRaw.map((s) => {
        let dur = s.durationSec;
        if (dur === null || dur === undefined) {
            const last = s.lastActiveAt ? new Date(s.lastActiveAt).getTime() : new Date(s.loginAt).getTime();
            dur = Math.round((last - new Date(s.loginAt).getTime()) / 1000);
        }
        return { ...s, durationSec: dur };
    });

    const avgDuration =
        completedSessions.length > 0
            ? Math.round(completedSessions.reduce((acc, s) => acc + s.durationSec, 0) / completedSessions.length)
            : null;

    const submittedAssessments = assessmentsRaw.filter((a) => a.status === 'SUBMITTED');
    const grades = submittedAssessments.filter((a) => a.grade !== null).map((a) => a.grade);
    const avgGrade = grades.length > 0 ? Math.round(grades.reduce((a, b) => a + b, 0) / grades.length) : null;
    const totalPointsEarned = submittedAssessments.reduce((acc, a) => acc + (a.pointsEarned || 0), 0);

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
            totalAvailable: totalAvailableChapters,
        },
        chat: chatStats,
        userChapterActivity,
        rawAssessments: {
            totalAttempts: assessmentsRaw.length,
            submittedAssessments: submittedAssessments.length,
        }
    };
}

// ─── Payload Builder (REFACTORED — SDT removed, log-based metrics added) ───────

function toSummaryPayload(userId, summary) {
    // ── Extract base metrics from computed summary ──────────────────────────
    const periodDays = summary?.period?.totalDays || 1;
    const sessionsTotal = summary?.sessions?.total || 0;
    const activeDays = summary?.sessions?.activeDays || 0;
    const returnRatePct = summary?.sessions?.returnRatePct || 0;
    const avgDurationSec = summary?.sessions?.avgDurationSec || 0;
    const assessmentsSubmitted = summary?.rawAssessments?.submittedAssessments || 0;
    const assessmentAttempts = summary?.rawAssessments?.totalAttempts || 0;
    const retryAttempts = Math.max(0, assessmentAttempts - assessmentsSubmitted);

    const avgGrade = summary?.assessments?.avgGrade || 0;
    const totalPointsEarned = summary?.assessments?.totalPointsEarned || 0;
    const badgesEarned = summary?.badges?.totalEarned || 0;
    const chaptersCompleted = summary?.chapters?.totalCompleted || 0;
    const totalAvailableChapters = summary?.chapters?.totalAvailable || 8;

    const chatSessions = summary?.chat?.totalSessions || 0;
    const chatMessages = summary?.chat?.totalMessages || 0;
    const chatUserMessages = summary?.chat?.userMessages || 0;

    // Feature utilization logic
    const userChapterActivity = summary?.userChapterActivity || [];
    const usedMaterial = userChapterActivity.some(c => c.materialDone);
    const usedAssignment = userChapterActivity.some(c => c.assignmentDone);
    const usedAssessment = assessmentsSubmitted > 0;
    const usedChatbot = chatSessions > 0;

    let featuresUsed = 0;
    if (usedMaterial) featuresUsed++;
    if (usedAssignment) featuresUsed++;
    if (usedAssessment) featuresUsed++;
    if (usedChatbot) featuresUsed++;

    // ═══════════════════════════════════════════════════════════════════════════
    // A. ENGAGEMENT – BEHAVIORAL SCORE (0–100)
    // ═══════════════════════════════════════════════════════════════════════════
    const behavioralSessions = normalizeTo100(sessionsTotal, MAX_EXPECTED_SESSIONS);
    const behavioralAssessments = normalizeTo100(assessmentsSubmitted, MAX_EXPECTED_ASSESSMENTS);
    const behavioralChat = normalizeTo100(chatUserMessages, MAX_EXPECTED_CHAT_MESSAGES);
    const engagementBehavioralScore = weightedAverage(
        [behavioralSessions, behavioralAssessments, behavioralChat],
        [BEHAVIORAL_WEIGHTS.sessions, BEHAVIORAL_WEIGHTS.assessments, BEHAVIORAL_WEIGHTS.chatMessages]
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // B. ENGAGEMENT – CONSISTENCY SCORE (0–100)
    // ═══════════════════════════════════════════════════════════════════════════
    const activeDaysNorm = normalizeTo100(activeDays, periodDays);
    const engagementConsistencyScore = weightedAverage(
        [activeDaysNorm, returnRatePct],
        [CONSISTENCY_WEIGHTS.activeDays, CONSISTENCY_WEIGHTS.returnRate]
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // C. ENGAGEMENT – PERSISTENCE SCORE (0–100)
    // ═══════════════════════════════════════════════════════════════════════════
    const durationNorm = normalizeTo100(avgDurationSec, MAX_EXPECTED_AVG_DURATION_SEC);
    const persistenceAttemptsNorm = normalizeTo100(assessmentAttempts, MAX_EXPECTED_ASSESSMENTS);
    const engagementPersistenceScore = weightedAverage(
        [durationNorm, persistenceAttemptsNorm],
        [PERSISTENCE_WEIGHTS.duration, PERSISTENCE_WEIGHTS.assessments]
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // D. SYSTEM USAGE INTENSITY (0–100)
    // ═══════════════════════════════════════════════════════════════════════════
    const systemUsageIntensity = weightedAverage(
        [behavioralSessions, durationNorm],
        [USAGE_INTENSITY_WEIGHTS.sessions, USAGE_INTENSITY_WEIGHTS.duration]
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // E. LEARNING PROGRESS RATE (0–100)
    // ═══════════════════════════════════════════════════════════════════════════
    const learningProgressRate = totalAvailableChapters > 0 ? normalizeTo100(chaptersCompleted, totalAvailableChapters) : 0;

    // ═══════════════════════════════════════════════════════════════════════════
    // F. FEATURE UTILIZATION SCORE (0–100)
    // ═══════════════════════════════════════════════════════════════════════════
    const featureUtilizationScore = Math.round((featuresUsed / 4) * 100);

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
        assessment_attempts: assessmentAttempts,
        retry_attempts: retryAttempts,
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

// ─── Activity Event Logging ─────────────────────────────────────────────────────
//
// Real-time event logger that captures user actions into Supabase `activity_logs`.
// This runs alongside (not instead of) the existing aggregated student_summaries.
//
// Flow:  User Action → logActivityEvent(activity_logs) → syncSummaryToSupabase(student_summaries)
//
// Event types:
//   SESSION    — login / logout
//   ASSESSMENT — quiz submission with grade, correctness, points
//   CHATBOT    — chatbot interaction (message sent)

// Valid event types — acts as an allow-list
const ACTIVITY_EVENT_TYPES = ['SESSION', 'ASSESSMENT', 'CHATBOT', 'MATERIAL', 'ASSIGNMENT'];

// Minimum interval (ms) between duplicate events for the same user + eventType.
// Prevents log spam from rapid-fire client calls (e.g. double-tap, reconnect loops).
const EVENT_RATE_LIMIT_MS = 2000;

// In-memory rate-limit tracker: Map<"userId:eventType", lastTimestamp>
const eventRateLimiter = new Map();

/**
 * Log a user activity event to Supabase `activity_logs`.
 *
 * - Non-blocking: errors are caught and logged, never thrown.
 * - Rate-limited: duplicate (userId + eventType) within EVENT_RATE_LIMIT_MS are skipped.
 * - Optionally triggers a debounced summary sync after logging.
 *
 * @param {Object}  opts
 * @param {number}  opts.userId    - Prisma user ID
 * @param {string}  opts.eventType - One of ACTIVITY_EVENT_TYPES
 * @param {Object}  opts.payload   - Arbitrary JSON metadata for the event
 * @param {boolean} [opts.triggerSync=false] - If true, also debounce-sync student_summaries
 * @returns {Promise<{ok: boolean, skipped?: boolean, error?: string}>}
 */
async function logActivityEvent({ userId, eventType, payload = {}, triggerSync = false }) {
    try {
        // ── Validation ──────────────────────────────────────────────────────
        if (!userId || !eventType) {
            return { ok: false, skipped: true, error: 'Missing userId or eventType' };
        }

        if (!ACTIVITY_EVENT_TYPES.includes(eventType)) {
            console.warn(`[EvaluationService] logActivityEvent: unknown eventType "${eventType}"`);
            return { ok: false, skipped: true, error: `Unknown eventType: ${eventType}` };
        }

        // ── Rate limiting ───────────────────────────────────────────────────
        const rateLimitKey = `${userId}:${eventType}`;
        const now = Date.now();
        const lastEventTime = eventRateLimiter.get(rateLimitKey) || 0;

        if (now - lastEventTime < EVENT_RATE_LIMIT_MS) {
            return { ok: true, skipped: true };
        }
        eventRateLimiter.set(rateLimitKey, now);

        // ── Insert into activity_logs ────────────────────────────────────────
        const row = {
            user_id: userId,
            event_type: eventType,
            payload: payload || {},
            created_at: new Date().toISOString(),
        };

        const { error } = await supabase
            .from('activity_logs')
            .insert(row);

        if (error) {
            console.error('[EvaluationService] logActivityEvent insert error:', error.message);
            return { ok: false, error: error.message };
        }

        // ── Optional: trigger debounced summary sync ────────────────────────
        if (triggerSync) {
            // Fire-and-forget — do NOT await; syncSummaryToSupabase already debounces
            syncSummaryToSupabase(userId).catch(() => { });
        }

        return { ok: true };
    } catch (err) {
        // Fail-safe: never crash the calling code
        console.error('[EvaluationService] logActivityEvent unexpected error:', err.message);
        return { ok: false, error: err.message };
    }
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
                    .from('student_summaries_2')
                    .upsert(payload, { onConflict: 'user_id, period_start' });

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
    logActivityEvent,
    // Exported for testing / reuse
    normalizeTo100,
    safeDivide,
    weightedAverage,
};
