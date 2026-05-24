const DEFAULT_ELO = 1200;
const MIN_ELO = 750;
const MAX_ELO = 3000;

const clampElo = (value) => {
    const parsed = parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed >= MIN_ELO && parsed <= MAX_ELO) {
        return parsed;
    }
    return DEFAULT_ELO;
};
const determineUserKFactor = (targetElo) => {
    const elo = clampElo(targetElo);
    
    
    if (elo < 1000) return 40;
    
    if (elo < 1200) return 30;
    
    if (elo < 1400) return 20;
    
    if (elo < 1600) return 15;
    
    if (elo < 1800) return 12;
    
    if (elo < 2000) return 10;
    
    return 8;
};

const determineQuestionKFactor = (targetElo) => {
    const elo = clampElo(targetElo);
    
    
    if (elo < 1000) return 30;
    
    if (elo < 1200) return 24;
    
    if (elo < 1400) return 20;
    
    if (elo < 1600) return 15;
    
    if (elo < 1800) return 12;
    
    if (elo < 2000) return 10;
    
    return 8;
};

const calculateQuestionDuelElo = ({
    userElo,
    questionElo,
    isCorrect,
}) => {
    const currentUserElo = Math.max(MIN_ELO, Number(userElo) || MIN_ELO);
    const currentQuestionElo = clampElo(questionElo);

    const K_USER = determineUserKFactor(currentUserElo);
    const K_QUESTION = determineQuestionKFactor(currentQuestionElo);

    const expectedUser = 1 / (1 + Math.pow(10, -(currentUserElo - currentQuestionElo) / 400));
    const actualUserScore = isCorrect ? 1 : 0;
 
    const userDeltaRaw = K_USER * (actualUserScore - expectedUser);

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

const determineDifficulty = (userElo) => {
    const elo = clampElo(userElo);
    for (let i = ELO_BANDS.length - 1; i >= 0; i--) {
        if (elo >= ELO_BANDS[i].min) {
            return ELO_BANDS[i].name;
        }
    }
    return ELO_BANDS[0].name;
};

const resolveBandIndex = (targetElo) => {
    const elo = clampElo(targetElo);
    for (let i = 0; i < ELO_BANDS.length; i++) {
        if (elo >= ELO_BANDS[i].min && elo < ELO_BANDS[i].max) {
            return i;
        }
    }
    return elo >= 2000 ? 6 : 0;
};

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
    determineUserKFactor,
    determineQuestionKFactor,
    calculateQuestionDuelElo,
    determineDifficulty,
    resolveBandIndex,
    getBandTraversalOrder,
    sortByDistanceToTarget,
};
