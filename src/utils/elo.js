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
 * Determines the K-factor for a user based on their current ELO.
 * 
 * @param {number|string} targetElo 
 * @returns {number} The dynamic K-factor for user
 */
const determineUserKFactor = (targetElo) => {
    const elo = clampElo(targetElo);
    
    // Pemula (750-1000)
    if (elo < 1000) return 40;
    // Basic (1000-1200)
    if (elo < 1200) return 30;
    // Developing (1200-1400)
    if (elo < 1400) return 20;
    // Intermediate (1400-1600)
    if (elo < 1600) return 15;
    // Proficient (1600-1800)
    if (elo < 1800) return 12;
    // Advanced (1800-2000)
    if (elo < 2000) return 10;
    // Mastery (2000+)
    return 8;
};

/**
 * Determines the K-factor for a question based on its current ELO.
 * 
 * @param {number|string} targetElo 
 * @returns {number} The dynamic K-factor for question
 */
const determineQuestionKFactor = (targetElo) => {
    const elo = clampElo(targetElo);
    
    // Pemula (750-1000)
    if (elo < 1000) return 30;
    // Basic (1000-1200)
    if (elo < 1200) return 24;
    // Developing (1200-1400)
    if (elo < 1400) return 20;
    // Intermediate (1400-1600)
    if (elo < 1600) return 15;
    // Proficient (1600-1800)
    if (elo < 1800) return 12;
    // Advanced (1800-2000)
    if (elo < 2000) return 10;
    // Mastery (2000+)
    return 8;
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

    const K_USER = determineUserKFactor(currentUserElo);
    const K_QUESTION = determineQuestionKFactor(currentQuestionElo);

    // Sesuai rumus gambar: P_s,i = 1 / (1 + 10^(-(R_s - D_i) / 400))
    const expectedUser = 1 / (1 + Math.pow(10, -(currentUserElo - currentQuestionElo) / 400));
    
    // S (Skor mahasiswa): Benar = 1, Salah = 0
    const actualUserScore = isCorrect ? 1 : 0;

    // Formula 3. Update Rating Mahasiswa: R_s^baru = R_s + K_s(S - P_s,i)
    const userDeltaRaw = K_USER * (actualUserScore - expectedUser);
    
    // Formula 3. Update Rating Soal: D_i^baru = D_i + K_i(P_s,i - S)
    const questionDeltaRaw = K_QUESTION * (expectedUser - actualUserScore);

    const nextUserElo = Math.max(MIN_ELO, Math.round(currentUserElo + userDeltaRaw));
    const nextQuestionElo = Math.max(MIN_ELO, Math.round(currentQuestionElo + questionDeltaRaw));

    return {
        userDeltaRaw,
        questionDeltaRaw,
        nextUserElo,
        nextQuestionElo,
    };
};

const ELO_BANDS = [
    { name: 'Beginner', min: 750, max: 1000 },
    { name: 'Basic Understanding', min: 1000, max: 1200 },
    { name: 'Developing Learner', min: 1200, max: 1400 },
    { name: 'Intermediate', min: 1400, max: 1600 },
    { name: 'Proficient', min: 1600, max: 1800 },
    { name: 'Advanced', min: 1800, max: 2000 },
    { name: 'Mastery', min: 2000, max: MAX_ELO },
];

/**
 * Determines the classification/badge based on a user's ELO score.
 * Replaces the old grade-based determineDifficulty.
 * 
 * @param {number|string} userElo - Current ELO of the user
 * @returns {string} The name/title of the ELO band they belong to.
 */
const determineDifficulty = (userElo) => {
    const elo = clampElo(userElo);
    for (let i = ELO_BANDS.length - 1; i >= 0; i--) {
        if (elo >= ELO_BANDS[i].min) {
            return ELO_BANDS[i].name;
        }
    }
    return ELO_BANDS[0].name;
};

/**
 * Resolves the array index of the band that a target ELO falls into.
 * 
 * @param {number} targetElo 
 * @returns {number} The index (0 to 6)
 */
const resolveBandIndex = (targetElo) => {
    const elo = clampElo(targetElo);
    for (let i = 0; i < ELO_BANDS.length; i++) {
        if (elo >= ELO_BANDS[i].min && elo < ELO_BANDS[i].max) {
            return i;
        }
    }
    return elo >= 2000 ? 6 : 0;
};

/**
 * Given a starting index (e.g., 3 for Intermediate), returns an array of indices
 * that radiate outwards (e.g., [3, 2, 4, 1, 5, 0, 6]) to search for questions 
 * in adjacent difficulty bands gracefully.
 * 
 * @param {number} startIndex 
 * @returns {number[]} Array of search indices
 */
const getBandTraversalOrder = (startIndex) => {
    const totalBands = ELO_BANDS.length;
    const safeStart = Math.max(0, Math.min(startIndex, totalBands - 1));
    const order = [safeStart];

    let left = safeStart - 1;
    let right = safeStart + 1;

    while (left >= 0 || right < totalBands) {
        if (left >= 0) {
            order.push(left);
            left--;
        }
        if (right < totalBands) {
            order.push(right);
            right++;
        }
    }
    return order;
};

/**
 * Sorts questions based on how close their ELO is to a target.
 * 
 * @param {Array} list - Array of question objects containing an `elo` property
 * @param {number} targetElo - The specific ELO number we want to match as closely as possible
 * @returns {Array} New array sorted by proximity
 */
const sortByDistanceToTarget = (list = [], targetElo = MIN_ELO) => {
    return [...list].sort((a, b) => {
        const diffA = Math.abs(clampElo(a.elo) - targetElo);
        const diffB = Math.abs(clampElo(b.elo) - targetElo);
        if (diffA !== diffB) {
            return diffA - diffB;
        }
        return clampElo(a.elo) - clampElo(b.elo);
    });
};

module.exports = {
    DEFAULT_ELO,
    MIN_ELO,
    MAX_ELO,
    ELO_BANDS,
    clampElo,
    calculateQuestionDuelElo,
    determineDifficulty,
    resolveBandIndex,
    getBandTraversalOrder,
    sortByDistanceToTarget,
};
