process.env.DB_CONNECTION_LIMIT = '10';
process.env.DB_POOL_TIMEOUT = '10';
require('dotenv').config();
const { recomputeAllUsers } = require('../src/services/EvaluationService');
const prisma = require('../src/prismaClient');

async function main() {
    try {
        console.log("Triggering recompute for all users...");
        const res = await recomputeAllUsers();
        console.log("Result:", res);
    } catch (e) {
        console.error("Error during recompute:", e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
