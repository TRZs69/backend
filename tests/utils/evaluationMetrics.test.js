const {
    clamp,
    round2,
    resolvePeriodDays,
    calculateRetryAttempts,
    calculateFeatureUtilizationScore,
} = require('../../src/utils/evaluationMetrics');

describe('evaluationMetrics utils', () => {
    test('clamp should keep value inside min-max bounds', () => {
        expect(clamp(120, 0, 100)).toBe(100);
        expect(clamp(-10, 0, 100)).toBe(0);
        expect(clamp(45, 0, 100)).toBe(45);
    });

    test('round2 should be null-safe and numeric-safe', () => {
        expect(round2(12.3456)).toBe(12.35);
        expect(round2('17.239')).toBe(17.24);
        expect(round2(undefined)).toBe(0);
        expect(round2('abc')).toBe(0);
    });

    test('resolvePeriodDays should be at least one day', () => {
        const start = new Date('2026-03-26T00:00:00.000Z');
        const end = new Date('2026-03-26T12:00:00.000Z');
        expect(resolvePeriodDays(start, end)).toBe(1);

        const end2 = new Date('2026-03-28T00:00:00.000Z');
        expect(resolvePeriodDays(start, end2)).toBe(3);
    });

    test('calculateRetryAttempts should floor at zero', () => {
        expect(calculateRetryAttempts(10, 4)).toBe(6);
        expect(calculateRetryAttempts(3, 5)).toBe(0);
        expect(calculateRetryAttempts(0, 0)).toBe(0);
    });

    test('calculateFeatureUtilizationScore should map features to 0-100', () => {
        expect(calculateFeatureUtilizationScore(0)).toBe(0);
        expect(calculateFeatureUtilizationScore(3)).toBe(50);
        expect(calculateFeatureUtilizationScore(6)).toBe(100);
        expect(calculateFeatureUtilizationScore(10)).toBe(100);
    });
});
