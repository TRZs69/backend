require('dotenv').config();
const supabase = require('../supabase/supabase.js');

async function showExamples() {
    console.log('🔍 Fetching chat examples...\n');

    try {
        // Check total sessions count
        const { count } = await supabase
            .from('chat_sessions')
            .select('*', { count: 'exact', head: true });

        console.log(`Total sessions in DB: ${count}\n`);

        if (count === 0) {
            console.log('❌ No sessions found.');
            return;
        }

        // Get 3 recent sessions with messages
        const { data: sessions } = await supabase
            .from('chat_sessions')
            .select('id, user_id')
            .order('created_at', { ascending: false })
            .limit(3);

        if (!sessions || sessions.length === 0) {
            console.log('❌ Could not fetch sessions.');
            return;
        }

        for (let i = 0; i < sessions.length; i++) {
            const session = sessions[i];
            
            const { data: messages } = await supabase
                .from('chat_messages')
                .select('role, content')
                .eq('session_id', session.id)
                .order('created_at', { ascending: true });

            console.log(`💬 Example ${i + 1} (Session ${session.id}):`);
            console.log(`${'─'.repeat(80)}`);
            
            if (messages && messages.length > 0) {
                for (const msg of messages) {
                    const role = msg.role === 'user' ? '🧑 Student' : '🤖 Levely';
                    console.log(`${role}:`);
                    console.log(`"${msg.content}"\n`);
                }
            } else {
                console.log('(No messages found for this session)\n');
            }
            console.log(`${'═'.repeat(80)}\n`);
        }

    } catch (err) {
        console.error('Error:', err.message);
        console.error(err.stack);
    }
}

showExamples();
