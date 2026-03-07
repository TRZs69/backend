const { determineDifficulty } = require('./src/utils/elo');

const formatUser = (user) => {
    if (!user) return user;
    const isStudent = String(user.role || '').toUpperCase() === 'STUDENT';
    const effectivePoints = (user.points === null || user.points === undefined) ? 750 : user.points;
    return {
        ...user,
        points: isStudent ? effectivePoints : null,
        eloTitle: isStudent ? determineDifficulty(effectivePoints) : null
    };
};

console.log(formatUser({ id: 1, role: 'STUDENT', points: null }));
console.log(formatUser({ id: 2, role: 'STUDENT' }));
console.log(formatUser({ id: 3, role: 'STUDENT', points: 1500 }));
console.log(formatUser({ id: 4, role: 'INSTRUCTOR', points: null }));
