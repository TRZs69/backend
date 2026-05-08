const { createHash } = require('crypto');
const prisma = require('../prismaClient');
const supabase = require('../../supabase/supabase.js');
const {
    REQUIRED_FEATURE_COUNT,
    clamp,
    round2,
    resolvePeriodDays,
    calculateFeatureUtilizationScore,
    calculateRetryAttempts,
} = require('../utils/evaluationMetrics');

const SUMMARY_TABLE = 'student_summaries_2';
const ACTIVITY_TABLE = 'activity_logs';

// Hardcoded aggregation period based on WIB:
// start: 2026-03-26 00:00:00 WIB, end: 2026-05-14 23:59:59.999 WIB
const DEFAULT_PERIOD_START_ISO = '2026-03-25T17:00:00.000Z';
const DEFAULT_PERIOD_END_ISO = '2026-05-14T16:59:59.999Z';

const EVENT_NAMES = {
    USER_LOGIN: 'user_login',
    SESSION_START: 'session_start',
    SESSION_END: 'session_end',
    ASSESSMENT_SUBMIT: 'assessment_submit',
    MATERIAL_ACCESS: 'material_access',
    ASSIGNMENT_SUBMIT: 'assignment_submit',
    CHATBOT_INTERACTION: 'chatbot_interaction',
    CHAPTER_COMPLETED: 'chapter_completed',
    BADGE_EARNED: 'badge_earned',
};

const SUPPORTED_EVENT_NAMES = new Set(Object.values(EVENT_NAMES));
const RECOMPUTE_DEBOUNCE_MS = Number(process.env.EVAL_RECOMPUTE_DEBOUNCE_MS || 3000);
const RECOMPUTE_CONCURRENCY = Math.max(1, Number(process.env.EVAL_RECOMPUTE_CONCURRENCY || 4));

const pendingRecomputeTimers = new Map();
const inFlightRecomputeUsers = new Set();
const rerunRecomputeUsers = new Set();

let isBatchRecomputeRunning = false;

function normalizeInteger(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    return Math.trunc(numeric);
}

function parseDate(value, fallback) {
    if (value === undefined || value === null || value === '') {
        return new Date(fallback);
    }

    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime())) {
        return new Date(fallback);
    }
    return parsed;
}

function isDateOnlyString(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

function getDefaultDateRange() {
    return {
        start: new Date(DEFAULT_PERIOD_START_ISO),
        end: new Date(DEFAULT_PERIOD_END_ISO),
    };
}

function toDateRange(startDate, endDate) {
    const defaults = getDefaultDateRange();
    const start = parseDate(startDate, defaults.start);
    const end = parseDate(endDate, defaults.end);

    if (isDateOnlyString(endDate)) {
        end.setUTCHours(16, 59, 59, 999);
    }

    if (end < start) {
        return { start, end: new Date(start) };
    }

    return { start, end };
}

function numberOrDefault(value, fallback = 0) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return numeric;
}

function legacySummaryFromStoredRow(userId, row, fallbackStart, fallbackEnd) {
    const periodStart = row?.period_start ? new Date(row.period_start) : fallbackStart;
    const periodEnd = row?.period_end ? new Date(row.period_end) : fallbackEnd;
    const periodDays = normalizeInteger(row?.period_days) || resolvePeriodDays(periodStart, periodEnd);

    return {
        period: {
            start: periodStart,
            end: periodEnd,
            totalDays: periodDays,
        },
        user: {
            studentId: row?.student_id || null,
            name: row?.student_name || null,
        },
        sessions: {
            total: normalizeInteger(row?.sessions_total) || 0,
            activeDays: normalizeInteger(row?.active_days) || 0,
            returnRatePct: round2(numberOrDefault(row?.return_rate_pct, 0)),
            avgDurationSec: round2(numberOrDefault(row?.avg_session_duration_sec, 0)),
        },
        assessments: {
            totalSubmitted: normalizeInteger(row?.assessments_submitted) || 0,
            avgGrade: round2(numberOrDefault(row?.avg_grade, 0)),
            totalPointsEarned: round2(numberOrDefault(row?.total_points_earned, 0)),
        },
        badges: {
            totalEarned: normalizeInteger(row?.badges_earned) || 0,
        },
        chapters: {
            totalCompleted: normalizeInteger(row?.chapters_completed) || 0,
        },
        chat: {
            totalSessions: normalizeInteger(row?.chat_sessions) || 0,
            totalMessages: normalizeInteger(row?.chat_messages) || 0,
            userMessages: normalizeInteger(row?.chat_user_messages) || 0,
        },
    };
}

function mapFeatureNameFromEvent(eventName) {
    switch (eventName) {
        case EVENT_NAMES.USER_LOGIN:
            return 'login';
        case EVENT_NAMES.SESSION_START:
        case EVENT_NAMES.SESSION_END:
            return 'session';
        case EVENT_NAMES.ASSESSMENT_SUBMIT:
            return 'assessment';
        case EVENT_NAMES.MATERIAL_ACCESS:
            return 'material';
        case EVENT_NAMES.ASSIGNMENT_SUBMIT:
            return 'assignment';
        case EVENT_NAMES.CHATBOT_INTERACTION:
            return 'chatbot';
        default:
            return null;
    }
}

function buildDefaultIdempotencyKey({
    userId,
    eventName,
    sessionId,
    chapterId,
    assessmentAttemptId,
    chatSessionId,
    score,
    points,
    eventTs,
    metadata = {},
}) {
    const metadataKey =
        metadata.request_id ||
        metadata.requestId ||
        metadata.message_id ||
        metadata.messageId ||
        metadata.client_event_id ||
        '';

    const raw = [
        userId,
        eventName,
        sessionId || '',
        chapterId || '',
        assessmentAttemptId || '',
        chatSessionId || '',
        score ?? '',
        points ?? '',
        eventTs.toISOString(),
        metadataKey,
    ].join('|');

    return createHash('sha256').update(raw).digest('hex');
}

function isDuplicateKeyError(error) {
    if (!error) return false;
    if (String(error.code || '') === '23505') return true;
    const message = String(error.message || '').toLowerCase();
    return message.includes('duplicate key') || message.includes('unique constraint');
}

async function getStoredSummary(userId) {
    const normalizedUserId = normalizeInteger(userId);
    if (!normalizedUserId) return null;

    const { data, error } = await supabase
        .from(SUMMARY_TABLE)
        .select('*')
        .eq('user_id', normalizedUserId)
        .maybeSingle();

    if (error) {
        console.error(`[EvaluationService] Failed to read ${SUMMARY_TABLE}:`, error.message);
        return null;
    }

    return data || null;
}

async function getSummaryProfile(userId) {
    const normalizedUserId = normalizeInteger(userId);
    if (!normalizedUserId) {
        return { studentId: null, studentName: null, totalAvailableChapters: 0 };
    }

    const user = await prisma.user.findUnique({
        where: { id: normalizedUserId },
        select: { id: true, name: true, studentId: true, role: true },
    });

    if (!user) {
        return { studentId: null, studentName: null, totalAvailableChapters: 0 };
    }

    let totalAvailableChapters = 0;
    try {
        totalAvailableChapters = await prisma.chapter.count({
            where: {
                course: {
                    enrollments: {
                        some: { userId: normalizedUserId },
                    },
                },
            },
        });
    } catch (error) {
        console.error('[EvaluationService] chapter count by enrollment failed:', error.message);
    }

    if (!totalAvailableChapters) {
        const fallbackCount = await prisma.userChapter.count({
            where: { userId: normalizedUserId },
        });
        totalAvailableChapters = fallbackCount || 0;
    }

    return {
        studentId: user.studentId || null,
        studentName: user.name || null,
        totalAvailableChapters,
    };
}

async function recordActivityEvent({
    userId,
    eventName,
    eventTs = new Date(),
    sessionId = null,
    chapterId = null,
    assessmentAttemptId = null,
    chatSessionId = null,
    score = null,
    points = null,
    metadata = {},
    eventIdempotencyKey = null,
    triggerRecompute = true,
    source = 'app',
}) {
    try {
        const normalizedUserId = normalizeInteger(userId);
        if (!normalizedUserId) {
            return { ok: false, reason: 'invalid_user_id' };
        }

        if (!SUPPORTED_EVENT_NAMES.has(eventName)) {
            return { ok: false, reason: 'invalid_event_name' };
        }

        const parsedEventTs = eventTs instanceof Date ? eventTs : new Date(eventTs);
        const effectiveEventTs = Number.isFinite(parsedEventTs.getTime()) ? parsedEventTs : new Date();

        const safeMetadata = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
            ? metadata
            : {};

        const idempotencyKey = eventIdempotencyKey || buildDefaultIdempotencyKey({
            userId: normalizedUserId,
            eventName,
            sessionId,
            chapterId,
            assessmentAttemptId,
            chatSessionId,
            score,
            points,
            eventTs: effectiveEventTs,
            metadata: safeMetadata,
        });

        const row = {
            user_id: normalizedUserId,
            event_name: eventName,
            event_ts: effectiveEventTs.toISOString(),
            session_id: sessionId ? String(sessionId) : null,
            chapter_id: normalizeInteger(chapterId),
            assessment_attempt_id: normalizeInteger(assessmentAttemptId),
            chat_session_id: chatSessionId ? String(chatSessionId) : null,
            score: score === null || score === undefined ? null : numberOrDefault(score, 0),
            points: points === null || points === undefined ? null : numberOrDefault(points, 0),
            metadata: { ...safeMetadata, source },
            idempotency_key: idempotencyKey,
            created_at: new Date().toISOString(),
        };

        const { error } = await supabase.from(ACTIVITY_TABLE).insert(row);

        if (error) {
            if (isDuplicateKeyError(error)) {
                return { ok: true, duplicate: true, idempotencyKey };
            }
            return { ok: false, error: error.message };
        }

        if (triggerRecompute) {
            enqueueRecomputeUserSummary(normalizedUserId, { source: 'event' });
        }

        return { ok: true, idempotencyKey };
    } catch (error) {
        console.error('[EvaluationService] recordActivityEvent error:', error.message);
        return { ok: false, error: error.message };
    }
}

function mapLegacyEventType(eventType, payload = {}) {
    if (eventType === 'SESSION') {
        if (payload.action === 'login') return EVENT_NAMES.SESSION_START;
        if (payload.action === 'logout') return EVENT_NAMES.SESSION_END;
        return EVENT_NAMES.SESSION_START;
    }
    if (eventType === 'ASSESSMENT') {
        return EVENT_NAMES.ASSESSMENT_SUBMIT;
    }
    if (eventType === 'CHATBOT') {
        return EVENT_NAMES.CHATBOT_INTERACTION;
    }

    const asLower = String(eventType || '').toLowerCase();
    if (SUPPORTED_EVENT_NAMES.has(asLower)) {
        return asLower;
    }
    return null;
}

async function logActivityEvent({ userId, eventType, payload = {}, triggerSync = true }) {
    const eventName = mapLegacyEventType(eventType, payload);
    if (!eventName) {
        return { ok: false, reason: 'invalid_event_type' };
    }

    return recordActivityEvent({
        userId,
        eventName,
        sessionId: payload.sessionId ?? null,
        chapterId: payload.chapterId ?? null,
        assessmentAttemptId: payload.attemptId ?? null,
        chatSessionId: payload.chatSessionId ?? payload.sessionId ?? null,
        score: payload.score ?? null,
        points: payload.points ?? payload.pointsEarned ?? null,
        metadata: payload,
        eventIdempotencyKey: payload.eventIdempotencyKey || null,
        triggerRecompute: triggerSync === true,
    });
}

async function recomputeUserSummary(userId, { source = 'manual', startDate, endDate } = {}) {
    const normalizedUserId = normalizeInteger(userId);
    if (!normalizedUserId) {
        return { ok: false, reason: 'invalid_user_id' };
    }

    if (inFlightRecomputeUsers.has(normalizedUserId)) {
        rerunRecomputeUsers.add(normalizedUserId);
        return { ok: true, queued: true, reason: 'in_flight' };
    }

    inFlightRecomputeUsers.add(normalizedUserId);
    try {
        const { start, end } = toDateRange(startDate, endDate);
        const profile = await getSummaryProfile(normalizedUserId);

        const { error } = await supabase.rpc('recompute_student_summary_v2', {
            p_user_id: normalizedUserId,
            p_period_start: start.toISOString(),
            p_period_end: end.toISOString(),
            p_student_id: profile.studentId,
            p_student_name: profile.studentName,
            p_total_available_chapters: profile.totalAvailableChapters,
        });

        if (error) {
            throw new Error(error.message);
        }

        const summary = await getStoredSummary(normalizedUserId);
        return { ok: true, source, userId: normalizedUserId, summary };
    } catch (error) {
        console.error('[EvaluationService] recomputeUserSummary error:', error.message);
        return { ok: false, source, userId: normalizedUserId, error: error.message };
    } finally {
        inFlightRecomputeUsers.delete(normalizedUserId);
    }
}

async function runRecomputeUntilSettled(userId, options = {}) {
    let latest = null;
    do {
        rerunRecomputeUsers.delete(userId);
        latest = await recomputeUserSummary(userId, options);
    } while (rerunRecomputeUsers.has(userId));
    return latest;
}

function enqueueRecomputeUserSummary(userId, { source = 'event', startDate, endDate } = {}) {
    const normalizedUserId = normalizeInteger(userId);
    if (!normalizedUserId) {
        return { ok: false, reason: 'invalid_user_id' };
    }

    if (pendingRecomputeTimers.has(normalizedUserId)) {
        clearTimeout(pendingRecomputeTimers.get(normalizedUserId));
    }

    const timer = setTimeout(() => {
        pendingRecomputeTimers.delete(normalizedUserId);
        void runRecomputeUntilSettled(normalizedUserId, { source, startDate, endDate });
    }, RECOMPUTE_DEBOUNCE_MS);

    pendingRecomputeTimers.set(normalizedUserId, timer);
    return { ok: true, queued: true };
}

async function runWithConcurrency(items, limit, worker) {
    const total = items.length;
    const results = new Array(total);
    let nextIndex = 0;

    const runners = Array.from({ length: Math.min(limit, total) }, async () => {
        while (true) {
            const current = nextIndex;
            nextIndex += 1;
            if (current >= total) {
                return;
            }
            results[current] = await worker(items[current], current);
        }
    });

    await Promise.all(runners);
    return results;
}

async function recomputeAllUsers({ source = 'manual' } = {}) {
    if (isBatchRecomputeRunning) {
        return { ok: true, skipped: true, reason: 'batch_running' };
    }

    isBatchRecomputeRunning = true;
    try {
        const students = await prisma.user.findMany({
            where: { role: 'STUDENT' },
            select: { id: true },
            orderBy: { id: 'asc' },
        });

        const workerResults = await runWithConcurrency(students, RECOMPUTE_CONCURRENCY, async (student) => {
            try {
                const result = await runRecomputeUntilSettled(student.id, { source });
                return { userId: student.id, ok: result?.ok === true, error: result?.error || null };
            } catch (error) {
                return { userId: student.id, ok: false, error: error.message };
            }
        });

        const succeeded = workerResults.filter((item) => item.ok).length;
        const failed = workerResults.filter((item) => !item.ok).length;

        return {
            ok: failed === 0,
            source,
            totalUsers: students.length,
            succeeded,
            failed,
            failures: workerResults.filter((item) => !item.ok),
        };
    } catch (error) {
        console.error('[EvaluationService] recomputeAllUsers error:', error.message);
        return { ok: false, source, error: error.message };
    } finally {
        isBatchRecomputeRunning = false;
    }
}

async function syncSummaryToSupabase(userId) {
    return enqueueRecomputeUserSummary(userId, { source: 'event' });
}

async function computeSummary(userId, startDate, endDate) {
    const normalizedUserId = normalizeInteger(userId);
    if (!normalizedUserId) {
        throw new Error('userId is required');
    }

    const { start, end } = toDateRange(startDate, endDate);
    await runRecomputeUntilSettled(normalizedUserId, {
        source: 'manual',
        startDate: start,
        endDate: end,
    });

    const row = await getStoredSummary(normalizedUserId);
    return legacySummaryFromStoredRow(normalizedUserId, row, start, end);
}

function toSummaryPayload(userId, summary = {}) {
    const periodDays = normalizeInteger(summary?.period?.totalDays) || 1;
    const sessionsTotal = normalizeInteger(summary?.sessions?.total) || 0;
    const activeDays = normalizeInteger(summary?.sessions?.activeDays) || 0;
    const returnRatePct = round2(numberOrDefault(summary?.sessions?.returnRatePct, 0));
    const avgDurationSec = round2(numberOrDefault(summary?.sessions?.avgDurationSec, 0));
    const assessmentsSubmitted = normalizeInteger(summary?.assessments?.totalSubmitted) || 0;
    const avgGrade = round2(numberOrDefault(summary?.assessments?.avgGrade, 0));
    const totalPointsEarned = round2(numberOrDefault(summary?.assessments?.totalPointsEarned, 0));
    const chaptersCompleted = normalizeInteger(summary?.chapters?.totalCompleted) || 0;
    const badgesEarned = normalizeInteger(summary?.badges?.totalEarned) || 0;
    const chatSessions = normalizeInteger(summary?.chat?.totalSessions) || 0;
    const chatMessages = normalizeInteger(summary?.chat?.totalMessages) || 0;
    const chatUserMessages = normalizeInteger(summary?.chat?.userMessages) || 0;
    const retryAttempts = calculateRetryAttempts(
        assessmentsSubmitted,
        normalizeInteger(summary?.assessments?.distinctChapters) || 0,
    );

    const featuresUsed = normalizeInteger(summary?.featuresUsed) || 0;
    const featureUtilizationScore = calculateFeatureUtilizationScore(featuresUsed);
    const totalActivity = normalizeInteger(summary?.totalActivity) || 0;

    return {
        user_id: normalizeInteger(userId),
        student_id: summary?.user?.studentId || null,
        student_name: summary?.user?.name || null,
        period_start: summary?.period?.start || new Date(DEFAULT_PERIOD_START_ISO).toISOString(),
        period_end: summary?.period?.end || new Date(DEFAULT_PERIOD_END_ISO).toISOString(),
        period_days: periodDays,
        sessions_total: sessionsTotal,
        active_days: activeDays,
        return_rate_pct: returnRatePct,
        avg_session_duration_sec: avgDurationSec,
        assessments_submitted: assessmentsSubmitted,
        avg_grade: avgGrade,
        total_points_earned: totalPointsEarned,
        retry_attempts: retryAttempts,
        chapters_completed: chaptersCompleted,
        badges_earned: badgesEarned,
        chat_sessions: chatSessions,
        chat_messages: chatMessages,
        chat_user_messages: chatUserMessages,
        total_activity: totalActivity,
        system_usage_intensity: round2(totalActivity / Math.max(1, periodDays)),
        feature_utilization_score: featureUtilizationScore,
        features_used: clamp(featuresUsed, 0, REQUIRED_FEATURE_COUNT),
        updated_at: new Date().toISOString(),
    };
}

module.exports = {
    ACTIVITY_TABLE,
    SUMMARY_TABLE,
    EVENT_NAMES,
    REQUIRED_FEATURE_COUNT,
    getDefaultDateRange,
    toDateRange,
    computeSummary,
    toSummaryPayload,
    getStoredSummary,
    recordActivityEvent,
    logActivityEvent,
    enqueueRecomputeUserSummary,
    recomputeUserSummary,
    recomputeAllUsers,
    syncSummaryToSupabase,
    __testables: {
        clamp,
        round2,
        resolvePeriodDays,
        mapFeatureNameFromEvent,
        calculateFeatureUtilizationScore,
        calculateRetryAttempts,
    },
};
