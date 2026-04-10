require('dotenv').config();
const supabase = require('../supabase/supabase.js');

async function testSupabaseConnection() {
    console.log('🔌 Testing Supabase connection...\n');

    try {
        // 1. Check which project we're connected to
        const { data: proj, error: projErr } = await supabase
            .from('student_summaries')
            .select('user_id')
            .limit(1);

        console.log('Project check:');
        console.log(`  student_summaries rows: ${projErr ? projErr.message : proj?.length || 0}`);

        // 2. Try to insert a test session
        const testUserId = 471; // Obenhard
        const testDate = new Date().toISOString();

        console.log(`\n📝 Attempting to insert test session for user ${testUserId}...`);

        const { data: session, error: insertError } = await supabase
            .from('chat_sessions')
            .insert({
                user_id: testUserId,
                created_at: testDate,
                updated_at: testDate,
            })
            .select();

        if (insertError) {
            console.error(`❌ Insert failed: ${insertError.message}`);
            console.error(`   Code: ${insertError.code}`);
            console.error(`   Details: ${JSON.stringify(insertError.details)}`);
            return;
        }

        console.log(`✅ Insert successful!`);
        console.log(`   Session ID: ${session[0].id}`);
        console.log(`   User ID: ${session[0].user_id}`);

        // 3. Verify the insert
        const { count } = await supabase
            .from('chat_sessions')
            .select('*', { count: 'exact', head: true });

        console.log(`\n📊 Total sessions after insert: ${count}`);

        // 4. Delete the test session
        await supabase
            .from('chat_sessions')
            .delete()
            .eq('id', session[0].id);

        console.log('🧹 Cleaned up test session.');

    } catch (err) {
        console.error('Fatal error:', err.message);
    }
}

testSupabaseConnection();
