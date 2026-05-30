require('dotenv').config();
const supabase = require('../supabase/supabase');

async function main() {
    try {
        console.log("=== Calling recompute_all_student_summaries_v2 RPC in Supabase ===");
        const { data: countProcessed, error: errRpc } = await supabase
            .rpc('recompute_all_student_summaries_v2', {
                p_period_start: '2026-03-25T17:00:00.000Z',
                p_period_end: '2026-06-03T16:59:59.999Z'
            });

        if (errRpc) {
            console.error("RPC Error:", errRpc);
            return;
        }

        console.log(`Successfully processed ${countProcessed} users.`);

        console.log("\n=== Querying updated student summaries in Supabase ===");
        const { data: summaries, error } = await supabase
            .from('student_summaries_2')
            .select('*');

        if (error) {
            console.error("Error fetching summaries:", error);
            return;
        }

        console.log(`Fetched ${summaries.length} student summaries:`);
        summaries.forEach(s => {
            console.log(`User: ${s.user_id} (${s.student_name || 'N/A'})`);
            console.log(`  - period_days: ${s.period_days}`);
            console.log(`  - sessions_total: ${s.sessions_total}`);
            console.log(`  - active_days: ${s.active_days}`);
            console.log(`  - return_rate_pct: ${s.return_rate_pct}`);
            console.log(`  - avg_session_duration_sec: ${s.avg_session_duration_sec}`);
            console.log(`  - assessments_submitted: ${s.assessments_submitted}`);
            console.log(`  - assessment_attempts: ${s.assessment_attempts}`);
            console.log(`  - assignments_submitted: ${s.assignments_submitted}`);
            console.log(`  - avg_grade: ${s.avg_grade}`);
            console.log(`  - total_points_earned: ${s.total_points_earned}`);
            console.log(`  - retry_attempts: ${s.retry_attempts}`);
            console.log(`  - chapters_completed: ${s.chapters_completed}`);
            console.log(`  - learning_progress_rate: ${s.learning_progress_rate}`);
            console.log(`  - feature_utilization_score: ${s.feature_utilization_score}`);
            console.log(`  - engagement_behavioral_score: ${s.engagement_behavioral_score}`);
            console.log(`  - engagement_consistency_score: ${s.engagement_consistency_score}`);
            console.log(`  - engagement_persistence_score: ${s.engagement_persistence_score}`);
        });

    } catch (e) {
        console.error(e);
    }
}

main();
