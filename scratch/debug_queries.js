require('dotenv').config();
const supabase = require('../supabase/supabase');
const prisma = require('../src/prismaClient');

async function main() {
    try {
        console.log("=== Checking users with chapters_completed > 16 in student_summaries_2 ===");
        const { data: overCompleted, error: errOver } = await supabase
            .from('student_summaries_2')
            .select('user_id, student_name, chapters_completed, total_available_chapters')
            .gt('chapters_completed', 16);

        if (errOver) {
            console.error("Error fetching overCompleted:", errOver);
        } else {
            console.log("Users with chapters_completed > 16:", overCompleted);
            for (const row of overCompleted) {
                const { data: logs, error: errLogs } = await supabase
                    .from('activity_logs')
                    .select('chapter_id, event_name, event_ts')
                    .eq('user_id', row.user_id)
                    .eq('event_name', 'chapter_completed');
                
                if (errLogs) {
                    console.error("Error logs for user:", row.user_id, errLogs);
                } else {
                    console.log(`User ${row.user_id} completed chapter logs (count: ${logs.length}):`);
                    console.log(logs);
                }
            }
        }

        console.log("\n=== Checking if any events exist for null fields ===");
        const { data: allEvents, error: errAll } = await supabase
            .from('activity_logs')
            .select('event_name')
            .limit(1000);

        if (errAll) {
            console.error("Error fetching all events:", errAll);
        } else {
            const counts = {};
            allEvents.forEach(e => {
                counts[e.event_name] = (counts[e.event_name] || 0) + 1;
            });
            console.log("Event counts sample in activity_logs:", counts);
        }

        console.log("\n=== Checking MySQL student data (points, badges) ===");
        const users = await prisma.user.findMany({
            where: { role: 'STUDENT' },
            select: { id: true, name: true, points: true, badges: true },
            take: 5
        });
        console.log("MySQL user points & badges sample:", users);

    } catch (e) {
        console.error(e);
    }
}

main();
