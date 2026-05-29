const { startAttempt } = require('./src/services/AssessmentService');

async function testGeneration() {
  try {
    console.log("Starting attempt for user 468, chapter 137...");
    const result = await startAttempt(468, 137, true);
    console.log("GENERATION RESULT:");
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("GENERATION FAILED:", err);
  } finally {
    process.exit(0);
  }
}

testGeneration();
