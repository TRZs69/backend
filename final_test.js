const ChatbotService = require('./src/services/ChatbotService');
const { postProcessReply } = require('./src/services/ChatbotUtils');
require('dotenv').config();


const prisma = require('./src/prismaClient');
prisma.user.findUnique = async () => ({ id: 1, name: "Ralphael", points: 100, studentId: "123", role: "STUDENT" });
prisma.userSession.findFirst = async () => null;
prisma.userChapter.findFirst = async () => null;
prisma.chapter.count = async () => 10;
prisma.assessmentAttempt.findMany = async () => [];

const ChatHistoryRepository = require('./src/services/ChatHistoryRepository');
ChatHistoryRepository.isEnabled = false;
ChatHistoryRepository.ensureSession = async () => "mock-session";
ChatHistoryRepository.appendMessages = async () => [];
ChatHistoryRepository.fetchMessages = async () => [];

async function runTest(prompt = "hello levely") {
    console.log(`\n>>> TESTING LIVE LLM WITH PROMPT: "${prompt}"`);
    const result = await ChatbotService.streamMessage({
        message: prompt,
        userId: 1,
        sessionId: "mock-session",
        onToken: () => {}
    });

    console.log("\n--- CLEANED FINAL REPLY ---");
    console.log(result.reply);
    console.log("-----------------------------\n");
}

async function main() {
    try {
        await runTest("hello levely");
    } catch (err) {
        console.error("Test failed:", err);
    } finally {
        process.exit(0);
    }
}
main();
