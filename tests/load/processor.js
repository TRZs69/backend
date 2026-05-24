'use strict';





function randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}






const USER_IDS = [1, 2, 3, 4, 5];


const CHAPTER_IDS = [1, 2, 3, 4, 5];


const FALLBACK_ANSWERS = ['A', 'B', 'C', 'D', 'True', 'False'];





function setUserContext(userContext, _events, done) {
    userContext.vars.userId = randomItem(USER_IDS);
    userContext.vars.chapterId = randomItem(CHAPTER_IDS);
    return done();
}





function captureAttemptStart(req, res, userContext, _events, done) {
    try {
        const body = typeof res.body === 'string' ? JSON.parse(res.body) : res.body;

        
        userContext.vars.attemptId = body?.attemptId ?? body?.attempt?.id ?? null;

        const currentQuestion = body?.currentQuestion ?? body?.nextQuestion ?? null;
        if (currentQuestion) {
            userContext.vars.questionId = currentQuestion.id;
            
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
        
        userContext.vars.attemptId = null;
        userContext.vars.questionId = null;
        userContext.vars.answer = randomItem(FALLBACK_ANSWERS);
    }
    return done();
}

function captureAnswerResponse(req, res, userContext, _events, done) {
    try {
        const body = typeof res.body === 'string' ? JSON.parse(res.body) : res.body;

        
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
            
            userContext.vars.attemptCompleted = true;
            userContext.vars.questionId = null;
        }
    } catch (_err) {
        userContext.vars.attemptCompleted = true;
        userContext.vars.questionId = null;
    }
    return done();
}

function shouldContinueAnswering(userContext, _events, done) {
    const keepGoing =
        userContext.vars.questionId != null && !userContext.vars.attemptCompleted;
    return done(keepGoing);
}





module.exports = {
    setUserContext,
    captureAttemptStart,
    captureAnswerResponse,
    shouldContinueAnswering,
};
