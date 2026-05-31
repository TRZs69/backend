require('dotenv').config();
const supabase = require('../supabase/supabase.js');

async function diagnose() {
    const userId = 527;

    // 1. All activity_logs for user 527
    console.log('=== 1. All activity_logs for user 527 ===');
    const { data: logs, error: logsErr } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30);
    if (logsErr) console.error('Logs error:', logsErr);
    else {
        for (const l of logs) {
            const meta = l.metadata ? JSON.stringify(l.metadata).substring(0, 80) : '';
            console.log(`  [${l.created_at}] ${l.event_name} | chapter=${l.chapter_id} | score=${l.score} | pts=${l.points} | ${meta}`);
        }
        if (logs.length === 0) console.log('  (no logs found)');
    }

    // 2. Count by event type
    console.log('\n=== 2. Event counts ===');
    const { data: allLogs } = await supabase
        .from('activity_logs')
        .select('event_name')
        .eq('user_id', userId);
    if (allLogs) {
        const counts = {};
        for (const l of allLogs) {
            counts[l.event_name] = (counts[l.event_name] || 0) + 1;
        }
        console.log(counts);
    }

    // 3. Student summary
    console.log('\n=== 3. student_summaries_2 for user 527 ===');
    const { data: summary, error: sumErr } = await supabase
        .from('student_summaries_2')
        .select('*')
        .eq('user_id', userId)
        .single();
    if (sumErr) console.error('Summary error:', sumErr);
    else {
        const { user_id, student_id, student_name, assessments_submitted, avg_grade, total_points_earned, 
                assignments_submitted, badges_earned, avg_session_duration_sec, retry_attempts, 
                chapters_completed, sessions_total, updated_at } = summary;
        console.log({ user_id, student_id, student_name, assessments_submitted, avg_grade, total_points_earned, 
                      assignments_submitted, badges_earned, avg_session_duration_sec, retry_attempts, 
                      chapters_completed, sessions_total, updated_at });
    }
}

diagnose().catch(console.error);
