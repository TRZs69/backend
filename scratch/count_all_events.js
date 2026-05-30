require('dotenv').config();
const supabase = require('../supabase/supabase');
const { EVENT_NAMES } = require('../src/services/EvaluationService');

async function main() {
    try {
        console.log("=== Counting all event types in activity_logs ===");
        const names = Object.values(EVENT_NAMES);
        
        for (const name of names) {
            const { count, error } = await supabase
                .from('activity_logs')
                .select('*', { count: 'exact', head: true })
                .eq('event_name', name);
            
            if (error) {
                console.error(`Error for event ${name}:`, error);
            } else {
                console.log(`Event: ${name} -> Count: ${count}`);
            }
        }
        
        // Also check if there are any other event names
        const { count: totalCount } = await supabase
            .from('activity_logs')
            .select('*', { count: 'exact', head: true });
        console.log(`Total events in activity_logs: ${totalCount}`);
    } catch (e) {
        console.error(e);
    }
}

main();
