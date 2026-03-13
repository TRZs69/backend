const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function removeBase750() {
    const students = await prisma.user.findMany({
        where: { role: 'STUDENT' }
    });

    for (const student of students) {
        const originalPoints = student.points || 0;
        // We expect their points to be 750 + X, where X is their earned points.
        // If they have less than 750 for some reason, we clamp it to 0.
        const newPoints = Math.max(0, originalPoints - 750);

        await prisma.user.update({
            where: { id: student.id },
            data: { points: newPoints }
        });
        console.log(`Updated user ${student.id}: points ${originalPoints} -> ${newPoints}`);
    }

    await prisma.$disconnect();
}

removeBase750().catch(console.error);
