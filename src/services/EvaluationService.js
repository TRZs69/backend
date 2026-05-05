const prisma = require('../prismaClient');
const supabase = require('../../supabase/supabase.js');
const { determineDifficulty } = require('../utils/elo');

const EVENT_TYPE = { SESSION: 'SESSION', ASSESSMENT: 'ASSESSMENT', CHATBOT: 'CHATBOT' };
const ACTIVITY_TABLE = 'activity_logs';
const SUMMARY_TABLE = 'student_analytics_summary';

function toDateRange(startDate, endDate) {
    const start = startDate ? new Date(startDate) : new Date('2026-01-01T00:00:00.000Z');
    const end = endDate ? new Date(endDate) : new Date();
    if (endDate && !String(endDate).includes('T')) end.setHours(23, 59, 59, 999);
    return { start, end };
}

const round4 = (v) => Number.isFinite(Number(v)) ? Number(Number(v).toFixed(4)) : 0;
const eloToLevel = (elo) => determineDifficulty(Number(elo) || 750);

function compareDifficultyLevels(userElo, questionElo) {
    const userLevel = eloToLevel(userElo);
    const questionLevel = eloToLevel(questionElo);
    const gap = Number(userElo) - Number(questionElo);
    let relation = 'MATCH';
    if (Number.isFinite(gap) && gap > 100) relation = 'TOO_EASY';
    if (Number.isFinite(gap) && gap < -100) relation = 'TOO_HARD';
    return { userLevel, questionLevel, relation };
}

function normalizeAssessmentPayload(payload = {}) {
    const userEloBefore = Number(payload.userEloBefore);
    const questionElo = Number(payload.questionElo);
    const expectedProbability = Number(payload.expectedProbability);
    const diff = compareDifficultyLevels(userEloBefore, questionElo);
    return {
        isCorrect: Boolean(payload.isCorrect),
        userEloBefore: Number.isFinite(userEloBefore) ? userEloBefore : 750,
        userEloAfter: Number.isFinite(Number(payload.userEloAfter)) ? Number(payload.userEloAfter) : (Number.isFinite(userEloBefore) ? userEloBefore : 750),
        questionElo: Number.isFinite(questionElo) ? questionElo : 1200,
        expectedProbability: Number.isFinite(expectedProbability)
            ? expectedProbability
            : 1 / (1 + Math.pow(10, -(((Number.isFinite(userEloBefore) ? userEloBefore : 750) - (Number.isFinite(questionElo) ? questionElo : 1200)) / 400))),
        userDifficultyLevel: diff.userLevel,
        questionDifficultyLevel: diff.questionLevel,
        difficultyRelation: diff.relation,
    };
}

async function logActivityEvent({ userId, eventType, payload = {}, createdAt }) {
    const type = String(eventType || '').toUpperCase();
    if (!Object.values(EVENT_TYPE).includes(type)) return;
    const row = {
        user_id: Number(userId),
        event_type: type,
        payload: type === EVENT_TYPE.ASSESSMENT ? normalizeAssessmentPayload(payload) : { ...normalizeAssessmentPayload({}), ...payload },
    };
    if (createdAt) row.created_at = new Date(createdAt).toISOString();
    const { error } = await supabase.from(ACTIVITY_TABLE).insert([row]);
    if (error) console.error('[EvaluationService] logActivityEvent:', error.message);
}

let summaryColumnsCache = null;
async function getSummaryColumns() {
    if (summaryColumnsCache) return summaryColumnsCache;
    const { data } = await supabase.from('information_schema.columns')
        .select('column_name').eq('table_schema', 'public').eq('table_name', SUMMARY_TABLE);
    summaryColumnsCache = Array.isArray(data) && data.length ? new Set(data.map((d) => d.column_name)) : null;
    return summaryColumnsCache;
}

function parsePayload(p) { if (!p) return {}; return typeof p === 'object' ? p : (() => { try { return JSON.parse(p); } catch { return {}; } })(); }

async function updateStudentAnalytics(userId) {
    const uid = Number(userId);
    const user = await prisma.user.findUnique({ where: { id: uid }, select: { name: true, studentId: true } });
    const { data: logs, error } = await supabase.from(ACTIVITY_TABLE)
        .select('event_type,payload,created_at').eq('user_id', uid).order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    const rows = (logs || []).map((l) => ({ ...l, event_type: String(l.event_type || '').toUpperCase(), payload: parsePayload(l.payload) }));
    const assessments = rows.filter((r) => r.event_type === EVENT_TYPE.ASSESSMENT);
    const sessions = rows.filter((r) => r.event_type === EVENT_TYPE.SESSION);
    const chatbot = rows.filter((r) => r.event_type === EVENT_TYPE.CHATBOT);

    const totalAttempts = assessments.length;
    const sessionsTotal = sessions.length;
    const correct = assessments.filter((a) => a.payload?.isCorrect === true).length;
    const firstElo = totalAttempts ? Number(assessments[0].payload?.userEloBefore) : 0;
    const lastElo = totalAttempts ? Number(assessments[totalAttempts - 1].payload?.userEloAfter) : 0;
    const rel = { MATCH: 0, TOO_EASY: 0, TOO_HARD: 0 };
    assessments.forEach((a) => { const k = String(a.payload?.difficultyRelation || 'MATCH').toUpperCase(); if (rel[k] !== undefined) rel[k] += 1; });

    let chatbotAfterFailure = 0, pendingFailure = false;
    rows.forEach((r) => {
        if (r.event_type === EVENT_TYPE.ASSESSMENT) pendingFailure = r.payload?.isCorrect === false;
        else if (r.event_type === EVENT_TYPE.CHATBOT && pendingFailure) { chatbotAfterFailure += 1; pendingFailure = false; }
    });

    const raw = {
        user_id: uid,
        student_id: user?.studentId || null,
        student_name: user?.name || null,
        period_start: rows[0]?.created_at || new Date().toISOString(),
        period_end: rows[rows.length - 1]?.created_at || new Date().toISOString(),
        sessions_total: sessionsTotal,
        total_attempts: totalAttempts,
        completion_rate: round4(sessionsTotal ? totalAttempts / sessionsTotal : 0),
        accuracy_rate: round4(totalAttempts ? correct / totalAttempts : 0),
        current_elo: Number.isFinite(lastElo) ? Math.round(lastElo) : 0,
        elo_gain: Number.isFinite(firstElo) && Number.isFinite(lastElo) ? Math.round(lastElo - firstElo) : 0,
        difficulty_match_rate: round4(totalAttempts ? rel.MATCH / totalAttempts : 0),
        too_easy_rate: round4(totalAttempts ? rel.TOO_EASY / totalAttempts : 0),
        too_hard_rate: round4(totalAttempts ? rel.TOO_HARD / totalAttempts : 0),
        chatbot_usage_rate: round4(totalAttempts ? chatbot.length / totalAttempts : 0),
        chatbot_after_failure_rate: round4(totalAttempts ? chatbotAfterFailure / totalAttempts : 0),
        updated_at: new Date().toISOString(),
    };

    const cols = await getSummaryColumns();
    const payload = cols ? Object.fromEntries(Object.entries(raw).filter(([k]) => cols.has(k))) : raw;
    const { error: upsertError } = await supabase.from(SUMMARY_TABLE).upsert([payload], { onConflict: 'user_id,period_start,period_end' });
    if (upsertError) throw new Error(upsertError.message);
    return payload;
}

async function syncSummaryToSupabase(userId) {
    try { return { ok: true, payload: await updateStudentAnalytics(userId) }; }
    catch (err) { console.error('[EvaluationService] syncSummaryToSupabase:', err.message); return { ok: false, error: err.message }; }
}

async function computeSummary(userId, start, end) {
    const uid = Number(userId);
    const { data: logs } = await supabase.from(ACTIVITY_TABLE).select('event_type,payload,created_at')
        .eq('user_id', uid).gte('created_at', start.toISOString()).lte('created_at', end.toISOString()).order('created_at', { ascending: true });
    return { userId: uid, period: { start, end }, logs: logs || [], analytics: await updateStudentAnalytics(uid) };
}

module.exports = { EVENT_TYPE, toDateRange, compareDifficultyLevels, logActivityEvent, updateStudentAnalytics, syncSummaryToSupabase, computeSummary };
