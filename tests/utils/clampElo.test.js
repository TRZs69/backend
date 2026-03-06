const { clampElo, MIN_ELO, MAX_ELO, DEFAULT_ELO } = require('../../src/utils/elo');

describe('clampElo() - Ensuring ELO stays within bounds', () => {
    it('should return the original value if it falls within min and max bounds', () => {
        const validElo = 1500;
        const result = clampElo(validElo);
        expect(result).toBe(validElo);
    });

    it('should return DEFAULT_ELO if the value is strictly below MIN_ELO', () => {
        const lowElo = MIN_ELO - 100;
        const result = clampElo(lowElo);
        expect(result).toBe(DEFAULT_ELO);
    });

    it('should return DEFAULT_ELO if the value is strictly above MAX_ELO', () => {
        const highElo = MAX_ELO + 100;
        const result = clampElo(highElo);
        expect(result).toBe(DEFAULT_ELO);
    });

    it('should parse strings into integers successfully', () => {
        const result = clampElo("1450");
        expect(result).toBe(1450);
    });

    it('should handle invalid string inputs by returning DEFAULT_ELO', () => {
        const result = clampElo("invalid_string");
        expect(result).toBe(DEFAULT_ELO);
    });

    it('should handle falsy/null inputs by returning DEFAULT_ELO', () => {
        expect(clampElo(null)).toBe(DEFAULT_ELO);
        expect(clampElo(undefined)).toBe(DEFAULT_ELO);
    });
});
