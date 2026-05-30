require('dotenv').config();
const supabase = require('../supabase/supabase');

async function main() {
    try {
        console.log("=== Querying all distinct event names in activity_logs ===");
        const { data, error } = await supabase
            .from('activity_logs')
            .select('event_name');

        if (error) {
            console.error("Error:", error);
            return;
        }

        const counts = {};
        data.forEach(row => {
            counts[row.event_name] = (counts[row.event_name] || 0) + 1;
        });

        console.log("Total events:", data.length);
        console.log("All event counts in activity_logs:", counts);
    } catch (e) {
        console.error(e);
    }
}

main();
