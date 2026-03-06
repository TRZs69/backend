'use strict';

/**
 * Artillery custom processor for ELO Rating System load test.
 *
 * Generates random payloads and captures response data so that
 * Artillery scenarios can chain requests realistically:
 *   startAttempt → answerQuestion (loop) → finalize
 */

// ---------------------------------------------------------------------------
// Helper – pick a random element from an array
// ---------------------------------------------------------------------------
function randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// ---------------------------------------------------------------------------
// Config – tweak these to match your seed / test data
// ---------------------------------------------------------------------------

// User IDs that exist in the database and have the STUDENT role.
const USER_IDS = [1, 2, 3, 4, 5];

// Chapter IDs that have assessments linked to them.
const CHAPTER_IDS = [1, 2, 3, 4, 5];

// Possible answers for MC / TF questions when we don't know the real options.
const FALLBACK_ANSWERS = ['A', 'B', 'C', 'D', 'True', 'False'];

// ---------------------------------------------------------------------------
// Before-scenario hook – set virtual-user variables
// ---------------------------------------------------------------------------

/**
 * Called once per virtual user before the scenario starts.
 * Sets userId and chapterId so subsequent requests can reference them.
 */
function setUserContext(userContext, _events, done) {
    userContext.vars.userId = randomItem(USER_IDS);
    userContext.vars.chapterId = randomItem(CHAPTER_IDS);
    return done();
}

// ---------------------------------------------------------------------------
// After-response hooks
// ---------------------------------------------------------------------------

/**
 * Extracts attemptId, first questionId, and question options from the
 * POST /api/assessment/attempt/start response.
 */
function captureAttemptStart(req, res, userContext, _events, done) {
    try {
        const body = typeof res.body === 'string' ? JSON.parse(res.body) : res.body;

        // The response shape from startAttempt → formatAttemptResponse
        userContext.vars.attemptId = body?.attemptId ?? body?.attempt?.id ?? null;

        const currentQuestion = body?.currentQuestion ?? body?.nextQuestion ?? null;
        if (currentQuestion) {
            userContext.vars.questionId = currentQuestion.id;
            // Try to pick a random option from the question; fall back to generic.
            const options = currentQuestion.options;
            userContext.vars.answer =
                Array.isArray(options) && options.length > 0
                    ? randomItem(options)
                    : randomItem(FALLBACK_ANSWERS);
        } else {
            userContext.vars.questionId = null;
            userContext.vars.answer = randomItem(FALLBACK_ANSWERS);
        }
    } catch (_err) {
        // If we can't parse, just set nulls – the scenario will still exercise the endpoint.
        userContext.vars.attemptId = null;
        userContext.vars.questionId = null;
        userContext.vars.answer = randomItem(FALLBACK_ANSWERS);
    }
    return done();
}

/**
 * Extracts the *next* questionId from the answer response so the loop
 * can continue to the next question.
 */
function captureAnswerResponse(req, res, userContext, _events, done) {
    try {
        const body = typeof res.body === 'string' ? JSON.parse(res.body) : res.body;

        // If the attempt is completed, mark it so the loop can break.
        if (body?.completed === true) {
            userContext.vars.attemptCompleted = true;
            userContext.vars.questionId = null;
            return done();
        }

        const nextQuestion = body?.nextQuestion ?? null;
        if (nextQuestion) {
            userContext.vars.questionId = nextQuestion.id;
            const options = nextQuestion.options;
            userContext.vars.answer =
                Array.isArray(options) && options.length > 0
                    ? randomItem(options)
                    : randomItem(FALLBACK_ANSWERS);
        } else {
            // No next question → attempt is finished.
            userContext.vars.attemptCompleted = true;
            userContext.vars.questionId = null;
        }
    } catch (_err) {
        userContext.vars.attemptCompleted = true;
        userContext.vars.questionId = null;
    }
    return done();
}

/**
 * Simple check used as a loop condition.
 * Returns true while a questionId exists and the attempt is not completed.
 */
function shouldContinueAnswering(userContext, _events, done) {
    const keepGoing =
        userContext.vars.questionId != null && !userContext.vars.attemptCompleted;
    return done(keepGoing);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
    setUserContext,
    captureAttemptStart,
    captureAnswerResponse,
    shouldContinueAnswering,
};
