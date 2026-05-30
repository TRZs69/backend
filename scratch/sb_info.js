require('dotenv').config();
const supabase = require('../supabase/supabase');

async function main() {
    try {
        // Let's get count of records in activity_logs
        const { count: countLogs, error: errLogs } = await supabase
            .from('activity_logs')
            .select('*', { count: 'exact', head: true });

        // Get count of records in student_summaries_2
        const { count: countSummaries, error: errSummaries } = await supabase
            .from('student_summaries_2')
            .select('*', { count: 'exact', head: true });

        console.log({
            countLogs,
            errLogs,
            countSummaries,
            errSummaries
        });

        // Get some rows from student_summaries_2
        const { data: summaries, error: errSumData } = await supabase
            .from('student_summaries_2')
            .select('*')
            .limit(5);

        console.log('Summaries samples:', summaries);

        // Let's check some chapter_completed logs in activity_logs
        const { data: logs, error: errLogData } = await supabase
            .from('activity_logs')
            .select('*')
            .eq('event_name', 'chapter_completed')
            .limit(10);
        
        console.log('Chapter completed logs samples:', logs);

    } catch (e) {
        console.error(e);
    }
}

main();
