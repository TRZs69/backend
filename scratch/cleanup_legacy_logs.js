require('dotenv').config();
const supabase = require('../supabase/supabase');

async function main() {
    try {
        console.log("=== Cleaning up legacy activity logs (chapter_id < 100) ===");
        
        // Find how many logs will be deleted
        const { count, error: errCount } = await supabase
            .from('activity_logs')
            .select('*', { count: 'exact', head: true })
            .lt('chapter_id', 100);
        
        if (errCount) {
            console.error("Error counting legacy logs:", errCount);
            return;
        }
        
        console.log(`Found ${count} legacy logs with chapter_id < 100.`);
        
        if (count > 0) {
            const { data, error: errDel } = await supabase
                .from('activity_logs')
                .delete()
                .lt('chapter_id', 100);
            
            if (errDel) {
                console.error("Error deleting legacy logs:", errDel);
            } else {
                console.log("Successfully deleted legacy logs!");
            }
        } else {
            console.log("No legacy logs to delete.");
        }
    } catch (e) {
        console.error(e);
    }
}

main();
