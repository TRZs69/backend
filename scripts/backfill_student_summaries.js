const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const evaluationService = require('../src/services/EvaluationService');

async function runBackfill() {
    console.log('--- Starting Backfill of Student Summaries ---');
    
    try {
        const students = await prisma.user.findMany({
            where: { role: 'STUDENT' },
            select: { id: true, name: true }
        });

        console.log(`Found ${students.length} students to backfill.`);

        for (const student of students) {
            console.log(`Processing student: ${student.name} (ID: ${student.id})`);
            const result = await evaluationService.syncSummaryToSupabase(student.id);

            if (!result.ok) {
                console.error(`  [ERROR] Failed to sync ${student.name}:`, result.error);
            } else {
                console.log(`  [SUCCESS] Updated ${student.name} in Supabase.`);
            }
        }

        console.log('--- Backfill Completed ---');
    } catch (err) {
        console.error('Backfill failed:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

runBackfill();
