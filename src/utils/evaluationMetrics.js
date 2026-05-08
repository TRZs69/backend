const REQUIRED_FEATURE_COUNT = 6;

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function round2(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Number(numeric.toFixed(2));
}

function resolvePeriodDays(start, end) {
    const dayMs = 24 * 60 * 60 * 1000;
    const raw = Math.floor((end.getTime() - start.getTime()) / dayMs) + 1;
    return Math.max(1, raw);
}

function calculateRetryAttempts(assessmentsSubmitted, distinctAssessmentChapters) {
    const retries = Number(assessmentsSubmitted || 0) - Number(distinctAssessmentChapters || 0);
    return Math.max(0, Math.trunc(retries));
}

function calculateFeatureUtilizationScore(featuresUsed, requiredFeatures = REQUIRED_FEATURE_COUNT) {
    const normalizedFeatures = clamp(Number(featuresUsed || 0), 0, requiredFeatures);
    return round2((normalizedFeatures / Math.max(1, requiredFeatures)) * 100);
}

module.exports = {
    REQUIRED_FEATURE_COUNT,
    clamp,
    round2,
    resolvePeriodDays,
    calculateRetryAttempts,
    calculateFeatureUtilizationScore,
};
