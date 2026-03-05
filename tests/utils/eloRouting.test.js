const {
    MIN_ELO,
    MAX_ELO,
    determineDifficulty,
    resolveBandIndex,
    getBandTraversalOrder,
    sortByDistanceToTarget
} = require('../../src/utils/elo');

describe('ELO Routing & Classification Logic Tests', () => {

    describe('determineDifficulty() - Badge Title Mapping', () => {
        it('should correctly map ELOs below 1000 to "Beginner"', () => {
            expect(determineDifficulty(750)).toBe('Beginner');
            expect(determineDifficulty(999)).toBe('Beginner');
            expect(determineDifficulty(MIN_ELO)).toBe('Beginner');
        });

        it('should correctly map ELOs between 1000 and 1199 to "Basic Understanding"', () => {
            expect(determineDifficulty(1000)).toBe('Basic Understanding');
            expect(determineDifficulty(1100)).toBe('Basic Understanding');
            expect(determineDifficulty(1199)).toBe('Basic Understanding');
        });

        it('should correctly map ELOs between 1200 and 1399 to "Developing Learner"', () => {
            expect(determineDifficulty(1200)).toBe('Developing Learner');
            expect(determineDifficulty(1350)).toBe('Developing Learner');
            expect(determineDifficulty(1399)).toBe('Developing Learner');
        });

        it('should correctly map ELOs between 1400 and 1599 to "Intermediate"', () => {
            expect(determineDifficulty(1400)).toBe('Intermediate');
            expect(determineDifficulty(1500)).toBe('Intermediate');
            expect(determineDifficulty(1599)).toBe('Intermediate');
        });

        it('should correctly map ELOs between 1600 and 1799 to "Proficient"', () => {
            expect(determineDifficulty(1600)).toBe('Proficient');
            expect(determineDifficulty(1700)).toBe('Proficient');
            expect(determineDifficulty(1799)).toBe('Proficient');
        });

        it('should correctly map ELOs between 1800 and 1999 to "Advanced"', () => {
            expect(determineDifficulty(1800)).toBe('Advanced');
            expect(determineDifficulty(1900)).toBe('Advanced');
            expect(determineDifficulty(1999)).toBe('Advanced');
        });

        it('should correctly map ELOs 2000 and over to "Mastery"', () => {
            expect(determineDifficulty(2000)).toBe('Mastery');
            expect(determineDifficulty(2500)).toBe('Mastery');
            expect(determineDifficulty(MAX_ELO)).toBe('Mastery');
        });
    });

    describe('resolveBandIndex() - Mapping ELO to Array Index', () => {
        it('should map Elo to the exact corresponding internal index 0-6', () => {
            expect(resolveBandIndex(800)).toBe(0); // Beginner
            expect(resolveBandIndex(1050)).toBe(1); // Basic
            expect(resolveBandIndex(1250)).toBe(2); // Developing
            expect(resolveBandIndex(1500)).toBe(3); // Intermediate
            expect(resolveBandIndex(1700)).toBe(4); // Proficient
            expect(resolveBandIndex(1950)).toBe(5); // Advanced
            expect(resolveBandIndex(2100)).toBe(6); // Mastery
        });
    });

    describe('getBandTraversalOrder() - Determining Adjacent Difficulty Search Paths', () => {
        it('should correctly radiate outwards from the middle index (3 - Intermediate)', () => {
            const order = getBandTraversalOrder(3);
            expect(order).toEqual([3, 2, 4, 1, 5, 0, 6]);
        });

        it('should correctly ascend when starting from the absolute bottom (0)', () => {
            const order = getBandTraversalOrder(0);
            expect(order).toEqual([0, 1, 2, 3, 4, 5, 6]);
        });

        it('should correctly descend when starting from the absolute top (6)', () => {
            const order = getBandTraversalOrder(6);
            expect(order).toEqual([6, 5, 4, 3, 2, 1, 0]);
        });

        it('should handle invalid starting bounds safely', () => {
            expect(getBandTraversalOrder(-5)).toEqual([0, 1, 2, 3, 4, 5, 6]);
            expect(getBandTraversalOrder(999)).toEqual([6, 5, 4, 3, 2, 1, 0]);
        });
    });

    describe('sortByDistanceToTarget() - Mathematical Sorting by Elo Proximity', () => {
        it('should rank questions closest to the target ELO first', () => {
            const questions = [
                { id: 'a', elo: 1800 },
                { id: 'b', elo: 900 },
                { id: 'c', elo: 1050 },
                { id: 'd', elo: 1000 }
            ];

            // Expected closest to 1000 is d(0 diff), c(50 diff), b(100 diff), a(800 diff)
            const sorted = sortByDistanceToTarget(questions, 1000);

            expect(sorted[0].id).toBe('d');
            expect(sorted[1].id).toBe('c');
            expect(sorted[2].id).toBe('b');
            expect(sorted[3].id).toBe('a');
        });

        it('should resolve ties by placing the fundamentally lower ELO first', () => {
            const questions = [
                { id: 'a', elo: 1100 },
                { id: 'b', elo: 900 }
            ];

            // Target 1000 -> Diff is exactly 100 for both.
            // Tie-breaker rule favors the structurally easier question (lower raw ELO).
            const sorted = sortByDistanceToTarget(questions, 1000);

            expect(sorted[0].id).toBe('b'); // 900 comes first
            expect(sorted[1].id).toBe('a'); // 1100 comes second
        });
    });
});
