const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function queryElos() {
    try {
        const students = await prisma.user.findMany({
            where: { role: 'STUDENT' },
            select: {
                id: true,
                username: true,
                name: true,
                elo: true,
                studentId: true
            },
            orderBy: { elo: 'desc' }
        });

        console.log('--- Current Student Elo Scores ---');
        console.table(students);
        console.log(`Total Students: ${students.length}`);
    } catch (err) {
        console.error('Error querying Elos:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

queryElos();
