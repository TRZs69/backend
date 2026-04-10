const supabase = require('../supabase/supabase.js');

async function debugChatData() {
    console.log('🔍 Debugging chat data...\n');

    try {
        // 1. Check count
        const { count, error: countError } = await supabase
            .from('chat_sessions')
            .select('*', { count: 'exact', head: true });

        if (countError) {
            console.error('❌ Error counting sessions:', countError.message);
            return;
        }

        console.log(`Total sessions in 'chat_sessions' table: ${count}\n`);

        if (count === 0) {
            console.log('⚠️  Table is empty. Data might not have been saved correctly.');
            console.log('   Possible reasons:');
            console.log('   - Supabase connection issue during generation');
            console.log('   - Wrong table name');
            console.log('   - Data was deleted');
            return;
        }

        // 2. Fetch first 3 sessions
        const { data: sessions, error: sessionError } = await supabase
            .from('chat_sessions')
            .select('id, user_id, created_at')
            .limit(3);

        if (sessionError) {
            console.error('❌ Error fetching sessions:', sessionError.message);
            return;
        }

        console.log('First 3 sessions:');
        for (const s of sessions) {
            console.log(`  - ID: ${s.id}, User: ${s.user_id}, Date: ${s.created_at}`);
            
            // Fetch messages for this session
            const { data: messages, error: msgError } = await supabase
                .from('chat_messages')
                .select('role, content')
                .eq('session_id', s.id)
                .limit(2);

            if (msgError) {
                console.log(`    ❌ Error fetching messages: ${msgError.message}`);
            } else if (messages && messages.length > 0) {
                console.log(`    Messages (${messages.length}):`);
                for (const m of messages) {
                    const preview = m.content.substring(0, 80) + (m.content.length > 80 ? '...' : '');
                    console.log(`      [${m.role}]: "${preview}"`);
                }
            } else {
                console.log(`    (No messages)`);
            }
            console.log('');
        }

    } catch (err) {
        console.error('Fatal error:', err.message);
    }
}

debugChatData();
