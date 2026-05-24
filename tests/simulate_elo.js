

function simulateElo(userElo, itemDifficultyElo, grade) {
    const actualScore = grade / 100;
    const expectedProb = 1 / (1 + Math.pow(10, (itemDifficultyElo - userElo) / 400));

    let K_FACTOR = 30;
    let eloChange = 0;

    
    let isProvisional = userElo <= 750;

    if (isProvisional) {
        K_FACTOR = 80; 
        eloChange = Math.round(K_FACTOR * (actualScore - expectedProb));
        eloChange += Math.round(grade * 0.5); 
    } else {
        
        K_FACTOR = 30; 
        eloChange = Math.round(K_FACTOR * (actualScore - expectedProb));
    }

    
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
    simulateElo(750, 1200, 100), 
    simulateElo(750, 1200, 50),  
    simulateElo(750, 1200, 0),   
    simulateElo(750, 750, 100),  
    simulateElo(750, 750, 0),    
];
console.table(scenario1);

console.log("\n=======================================================================");
console.log("=== SCENARIO 2: ESTABLISHED USER (Normal Volatility, K=30)      ===");
console.log("=======================================================================");
const scenario2 = [
    simulateElo(1200, 1400, 100), 
    simulateElo(1200, 1400, 50),  
    simulateElo(1200, 1400, 0),   
    simulateElo(1500, 1000, 100), 
    simulateElo(1500, 1000, 50),  
    simulateElo(1500, 1000, 0),   
];
console.table(scenario2);

console.log("\nFeel free to modify the parameters in this script to test your own scenarios!");
