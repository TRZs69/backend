const prisma = require('../src/prismaClient');
const evaluationService = require('../src/services/EvaluationService');
const supabase = require('../supabase/supabase.js');

async function resyncAllSummaries() {
    console.log('[Resync] Starting summary resync for all students...');
    
    try {
        const students = await prisma.user.findMany({
            where: { role: 'STUDENT' },
            select: { id: true, name: true, studentId: true },
        });

        console.log(`[Resync] Found ${students.length} students`);

        for (const student of students) {
            try {
                console.log(`[Resync] Processing: ${student.name} (ID: ${student.id})`);
                
                const { start, end } = evaluationService.toDateRange();
                const summary = await evaluationService.computeSummary(student.id, start, end);
                const payload = evaluationService.toSummaryPayload(student.id, summary);

                const { error } = await supabase
                    .from('student_summaries')
                    .upsert(payload, { onConflict: 'user_id' });

                if (error) {
                    console.error(`[Resync] Error for ${student.name}:`, error.message);
                } else {
                    console.log(`[Resync] ✓ Updated: ${student.name}`);
                }
            } catch (err) {
                console.error(`[Resync] Failed for ${student.name}:`, err.message);
            }
        }

        console.log('[Resync] All summaries synced successfully!');
    } catch (err) {
        console.error('[Resync] Fatal error:', err.message);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

resyncAllSummaries();
