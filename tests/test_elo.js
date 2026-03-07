const { determineDifficulty } = require('./src/utils/elo');

console.log("determineDifficulty(750):", determineDifficulty(750));
console.log("determineDifficulty(null):", determineDifficulty(null));
console.log("determineDifficulty(undefined):", determineDifficulty(undefined));
