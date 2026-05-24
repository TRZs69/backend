const { calculateQuestionDuelElo, MIN_ELO } = require('../../src/utils/elo');

describe('calculateQuestionDuelElo() - Calculating new ELOs based on answers', () => {
    it('should correctly increase user ELO and decrease question ELO when a student answers correctly', () => {
        const userElo = 1500;
        const questionElo = 1500;

        
        
        
        
        
        
        const result = calculateQuestionDuelElo({ userElo, questionElo, isCorrect: true });

        expect(result.nextUserElo).toBeGreaterThan(userElo);
        expect(result.nextQuestionElo).toBeLessThan(questionElo);
        expect(result.nextUserElo).toBe(1508);
        expect(result.nextQuestionElo).toBe(1493); 
    });

    it('should correctly decrease user ELO and increase question ELO when a student answers incorrectly', () => {
        const userElo = 1500;
        const questionElo = 1500;

        
        
        
        
        
        const result = calculateQuestionDuelElo({ userElo, questionElo, isCorrect: false });

        expect(result.nextUserElo).toBeLessThan(userElo);
        expect(result.nextQuestionElo).toBeGreaterThan(questionElo);
        expect(result.nextUserElo).toBe(1493);
        expect(result.nextQuestionElo).toBe(1508);
    });

    it('should not allow user or question ELO to fall below MIN_ELO after calculations', () => {
        const userElo = MIN_ELO; 
        const questionElo = MIN_ELO; 

        
        const result = calculateQuestionDuelElo({ userElo, questionElo, isCorrect: false });

        expect(result.nextUserElo).toBe(MIN_ELO);
        
        expect(result.nextQuestionElo).toBeGreaterThan(MIN_ELO);
    });

    it('should correctly calculate expected values when ELO disparity is massive', () => {
        const userElo = 1200; 
        const questionElo = 1800; 

        
        const result = calculateQuestionDuelElo({ userElo, questionElo, isCorrect: true });

        
        expect(result.nextUserElo).toBeGreaterThan(1200);
        expect(result.userDeltaRaw).toBeCloseTo(20 * (1 - 0.0306), 0); 
    });
});
