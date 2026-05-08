const cron = require('node-cron');
const evaluationService = require('./EvaluationService');

const TIMEZONE = 'Asia/Jakarta';
const HOURLY_CRON = '0 * * * *';
const DAILY_CRON = '0 0 * * *';

let isStarted = false;
let isJobRunning = false;

async function runJob(source) {
    if (isJobRunning) {
        console.warn(`[EvaluationScheduler] Skip ${source} run because previous job is still running.`);
        return;
    }

    isJobRunning = true;
    const startedAt = Date.now();
    try {
        const result = await evaluationService.recomputeAllUsers({ source });
        const elapsedMs = Date.now() - startedAt;
        console.log(`[EvaluationScheduler] ${source} done in ${elapsedMs}ms`, result);
    } catch (error) {
        console.error(`[EvaluationScheduler] ${source} failed:`, error.message);
    } finally {
        isJobRunning = false;
    }
}

function startEvaluationScheduler() {
    if (isStarted) {
        return { started: false, reason: 'already_started' };
    }

    const enabled = String(process.env.EVAL_SCHEDULER_ENABLED || 'true').toLowerCase() === 'true';
    if (!enabled) {
        console.log('[EvaluationScheduler] Disabled by EVAL_SCHEDULER_ENABLED.');
        return { started: false, reason: 'disabled' };
    }

    cron.schedule(HOURLY_CRON, () => {
        void runJob('hourly');
    }, { timezone: TIMEZONE });

    cron.schedule(DAILY_CRON, () => {
        void runJob('daily');
    }, { timezone: TIMEZONE });

    isStarted = true;
    console.log(`[EvaluationScheduler] Started (hourly: "${HOURLY_CRON}", daily: "${DAILY_CRON}", tz: ${TIMEZONE}).`);
    return { started: true };
}

module.exports = {
    startEvaluationScheduler,
};
