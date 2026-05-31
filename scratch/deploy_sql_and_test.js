require('dotenv').config();
const supabase = require('../supabase/supabase.js');

async function deployFunction() {
    // Verify by running a test recompute for user 527
    console.log('=== Testing recompute for user 527 with current deployed function ===');
    const { error: testErr } = await supabase.rpc('recompute_student_summary_v2', {
        p_user_id: 527,
        p_period_start: '2026-03-25T17:00:00.000Z',
        p_period_end: '2026-06-03T16:59:59.999Z',
        p_student_id: '11S22027',
        p_student_name: 'Kevin Aditia',
        p_total_available_chapters: 16,
    });
    
    if (testErr) {
        console.log('Recompute error:', testErr.message);
        console.log('\n⚠️  Anda perlu deploy SQL baru ke Supabase Dashboard > SQL Editor.');
        console.log('Copy fungsi recompute_student_summary_v2 dari: backend/supabase/student_summary_v2.sql');
    } else {
        const { data: summary } = await supabase
            .from('student_summaries_2')
            .select('avg_session_duration_sec, assessments_submitted, assignments_submitted, total_points_earned, chapters_completed, sessions_total')
            .eq('user_id', 527)
            .single();
        console.log('✅ Recompute success. Current summary:', summary);
    }

    // Also show all activity_logs event counts for user 527
    console.log('\n=== Event counts for user 527 ===');
    const { data: allLogs } = await supabase
        .from('activity_logs')
        .select('event_name')
        .eq('user_id', 527);
    if (allLogs) {
        const counts = {};
        for (const l of allLogs) {
            counts[l.event_name] = (counts[l.event_name] || 0) + 1;
        }
        console.log(counts);
    }
}

deployFunction().catch(console.error);

