const DEFAULT_ELO = 1200;
const MIN_ELO = 750;
const MAX_ELO = 3000;

/**
 * Clamps an ELO value to ensure it falls within the allowed range.
 * If the value is invalid or out of bounds, returns the default.
 *
 * @param {string|number} value - The ELO rating to clamp
 * @returns {number} The clamped ELO value
 */
const clampElo = (value) => {
    const parsed = parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed >= MIN_ELO && parsed <= MAX_ELO) {
        return parsed;
    }
    return DEFAULT_ELO;
};

/**
 * Calculates the new ELO ratings for both the user and the question
 * based on the outcome of a duel (whether the user answered correctly).
 *
 * @param {Object} params
 * @param {number|string} params.userElo - Current ELO of the user
 * @param {number|string} params.questionElo - Current ELO of the question
 * @param {boolean} params.isCorrect - Whether the user answered the question correctly
 * @returns {Object} Result of the ELO calculation duel
 */
const calculateQuestionDuelElo = ({
    userElo,
    questionElo,
    isCorrect,
}) => {
    const currentUserElo = Math.max(MIN_ELO, Number(userElo) || MIN_ELO);
    const currentQuestionElo = clampElo(questionElo);

    const K_USER = 30;
    const K_QUESTION = 15;

    const expectedUser = 1 / (1 + Math.pow(10, (currentQuestionElo - currentUserElo) / 400));
    const actualUserScore = isCorrect ? 1 : 0;
    const actualQuestionScore = isCorrect ? 0 : 1;

    const userDeltaRaw = K_USER * (actualUserScore - expectedUser);
    const questionDeltaRaw = K_QUESTION * (actualQuestionScore - (1 - expectedUser));

    const nextUserElo = Math.max(MIN_ELO, Math.round(currentUserElo + userDeltaRaw));
    const nextQuestionElo = Math.max(MIN_ELO, Math.round(currentQuestionElo + questionDeltaRaw));

    return {
        userDeltaRaw,
        questionDeltaRaw,
        nextUserElo,
        nextQuestionElo,
    };
};

module.exports = {
    DEFAULT_ELO,
    MIN_ELO,
    MAX_ELO,
    clampElo,
    calculateQuestionDuelElo,
};
