require('dotenv').config();
const { recomputeAllUsers, getStoredSummary } = require('../src/services/EvaluationService');
const supabase = require('../supabase/supabase');

async function main() {
    try {
        console.log("=== Running recomputeAllUsers ===");
        const result = await recomputeAllUsers({ source: 'manual' });
        console.log("Recompute result:", result);

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
            console.log(`User: ${s.user_id} (${s.student_name})`);
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
