const cron = require('node-cron');
const prisma = require('../prismaClient');
const evaluationService = require('../services/EvaluationService');

// Batch size for user processing
const BATCH_SIZE = 100;

async function runSummaryBatch() {
    console.log('[Scheduler] Starting batch recomputation for student_summaries_2...');
    try {
        const students = await prisma.user.findMany({
            where: { role: 'STUDENT' },
            select: { id: true },
        });

        console.log(`[Scheduler] Found ${students.length} students to process.`);

        for (let i = 0; i < students.length; i += BATCH_SIZE) {
            const batch = students.slice(i, i + BATCH_SIZE);
            console.log(`[Scheduler] Processing batch ${i / BATCH_SIZE + 1}...`);

            // Process batch sequentially to avoid DB overload, 
            // or Promise.all if the connection limit is safe. We use Promise.all per batch.
            await Promise.all(batch.map(async (student) => {
                try {
                    const { start, end } = evaluationService.toDateRange();
                    const summary = await evaluationService.computeSummary(student.id, start, end);
                    const payload = evaluationService.toSummaryPayload(student.id, summary);

                    // Skip upsert if RENDER/production override prevents it, 
                    // though for cron we usually want to bypass RENDER block if needed.
                    // But we'll just call the direct Supabase upsert.
                    const supabase = require('../../../supabase/supabase.js');
                    const { error } = await supabase
                        .from('student_summaries_2')
                        .upsert(payload, { onConflict: 'user_id, period_start' });
                    
                    if (error) {
                        console.error(`[Scheduler] Supabase upsert error for user ${student.id}:`, error.message);
                    }
                } catch (err) {
                    console.error(`[Scheduler] Error computing summary for user ${student.id}:`, err.message);
                }
            }));
            
            // Brief pause between batches
            if (i + BATCH_SIZE < students.length) {
                await new Promise(res => setTimeout(res, 2000));
            }
        }
        console.log('[Scheduler] Batch recomputation completed successfully.');
    } catch (err) {
        console.error('[Scheduler] Critical error in summaryCron:', err.message);
    }
}

// Run every hour at minute 0
function initSummaryCron() {
    console.log('[Scheduler] Initializing summaryCron (runs every hour at minute 0)');
    cron.schedule('0 * * * *', () => {
        runSummaryBatch();
    });
}

module.exports = { initSummaryCron, runSummaryBatch };
