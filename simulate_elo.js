// simulate_elo.js

/**
 * Simulates the Elo rating calculation process from AssessmentService.js
 * 
 * @param {number} userElo - The learner's current Elo points
 * @param {number} itemDifficultyElo - The average Elo rating of the questions in the assessment
 * @param {number} grade - The grade scored on the assessment (0-100)
 */
function simulateElo(userElo, itemDifficultyElo, grade) {
    const actualScore = grade / 100;
    const expectedProb = 1 / (1 + Math.pow(10, (itemDifficultyElo - userElo) / 400));

    let K_FACTOR = 30;
    let eloChange = 0;

    // Users with 750 points or less are considered "Provisional" / Unrated
    let isProvisional = userElo <= 750;

    if (isProvisional) {
        K_FACTOR = 80; // High volatility placement phase
        eloChange = Math.round(K_FACTOR * (actualScore - expectedProb));
        eloChange += Math.round(grade * 0.5); // Add Placement bonus
    } else {
        // Standard ELO phase
        K_FACTOR = 30; // Normal volatility phase
        eloChange = Math.round(K_FACTOR * (actualScore - expectedProb));
    }

    // Safety net: Max penalty of -5 points
    const pointsEarned = Math.max(-5, eloChange);
    const newUserElo = userElo + pointsEarned;

    return {
        "User Base ELO": userElo,
        "Question Average ELO": itemDifficultyElo,
        "Grade(%)": grade,
        "K-Factor": K_FACTOR,
        "Win Probability": (expectedProb * 100).toFixed(1) + "%",
        "Raw Elo Change": eloChange,
        "Final Points Earned": pointsEarned,
        "New User ELO": newUserElo
    };
}

console.log("\n=======================================================================");
console.log("=== SCENARIO 1: NEW/PROVISIONAL USER (High Volatility, K=80)    ===");
console.log("=======================================================================");
const scenario1 = [
    simulateElo(750, 1200, 100), // Perfect score on hard assessment
    simulateElo(750, 1200, 50),  // 50% on hard assessment
    simulateElo(750, 1200, 0),   // 0% on hard assessment
    simulateElo(750, 750, 100),  // Perfect score on normal assessment
    simulateElo(750, 750, 0),    // 0% on normal assessment
];
console.table(scenario1);

console.log("\n=======================================================================");
console.log("=== SCENARIO 2: ESTABLISHED USER (Normal Volatility, K=30)      ===");
console.log("=======================================================================");
const scenario2 = [
    simulateElo(1200, 1400, 100), // Perfect score on hard assessment (expected to do bad)
    simulateElo(1200, 1400, 50),  // 50% on hard assessment
    simulateElo(1200, 1400, 0),   // 0% on hard assessment
    simulateElo(1500, 1000, 100), // Perfect score on easy assessment (expected to do good)
    simulateElo(1500, 1000, 50),  // 50% on easy assessment (expected to do good, but failed)
    simulateElo(1500, 1000, 0),   // 0% on easy assessment
];
console.table(scenario2);

console.log("\nFeel free to modify the parameters in this script to test your own scenarios!");
