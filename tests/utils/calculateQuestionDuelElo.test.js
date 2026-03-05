const { calculateQuestionDuelElo, MIN_ELO } = require('../../src/utils/elo');

describe('calculateQuestionDuelElo() - Calculating new ELOs based on answers', () => {
    it('should correctly increase user ELO and decrease question ELO when a student answers correctly', () => {
        const userElo = 1500;
        const questionElo = 1500;

        // Expected user probability = 0.5 when Elos are identical.
        // If answered correctly, actual logic goes up by K_USER * (1 - 0.5) = 30 * 0.5 = 15.
        const result = calculateQuestionDuelElo({ userElo, questionElo, isCorrect: true });

        expect(result.nextUserElo).toBeGreaterThan(userElo);
        expect(result.nextQuestionElo).toBeLessThan(questionElo);
        expect(result.nextUserElo).toBe(1515);
        expect(result.nextQuestionElo).toBe(1493); // 1500 + 15 * (0 - 0.5) = 1492.5 => rounded to 1493
    });

    it('should correctly decrease user ELO and increase question ELO when a student answers incorrectly', () => {
        const userElo = 1500;
        const questionElo = 1500;

        // If answered incorrectly, user logic goes by K_USER * (0 - 0.5) = -15
        const result = calculateQuestionDuelElo({ userElo, questionElo, isCorrect: false });

        expect(result.nextUserElo).toBeLessThan(userElo);
        expect(result.nextQuestionElo).toBeGreaterThan(questionElo);
        expect(result.nextUserElo).toBe(1485);
        expect(result.nextQuestionElo).toBe(1508); // 1500 + 15 * (1 - 0.5) = 1507.5 => rounded to 1508
    });

    it('should not allow user or question ELO to fall below MIN_ELO after calculations', () => {
        const userElo = MIN_ELO; // 750
        const questionElo = MIN_ELO; // 750

        // If the user is incorrect, they'd drop points, but we enforce floor bounds.
        const result = calculateQuestionDuelElo({ userElo, questionElo, isCorrect: false });

        expect(result.nextUserElo).toBe(MIN_ELO);
        // The question should still increase
        expect(result.nextQuestionElo).toBeGreaterThan(MIN_ELO);
    });

    it('should correctly calculate expected values when ELO disparity is massive', () => {
        const userElo = 1200;
        const questionElo = 1800; // Expected probability is low because question is hard.

        // Expected user = 1 / (1 + 10^((1800-1200)/400)) = 1 / (1 + 10^1.5) = 1 / (1 + 31.62) = ~0.0306
        const result = calculateQuestionDuelElo({ userElo, questionElo, isCorrect: true });

        // Reward should be substantial for user.
        expect(result.nextUserElo).toBeGreaterThan(1200);
        expect(result.userDeltaRaw).toBeCloseTo(30 * (1 - 0.0306), 0); // K * (Actual - Expected)
    });
});
