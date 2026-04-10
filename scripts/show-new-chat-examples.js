require('dotenv').config();
const supabase = require('../supabase/supabase.js');

async function showNewExamples() {
    console.log('🔍 Showing NEWLY GENERATED chat examples (matched responses)...\n');

    try {
        // Get the 5 most recent sessions
        const { data: sessions } = await supabase
            .from('chat_sessions')
            .select('id, user_id, created_at')
            .order('created_at', { ascending: false })
            .limit(5);

        if (!sessions || sessions.length === 0) {
            console.log('❌ No sessions found.');
            return;
        }

        for (let i = 0; i < sessions.length; i++) {
            const session = sessions[i];
            
            const { data: messages } = await supabase
                .from('chat_messages')
                .select('role, content')
                .eq('session_id', session.id)
                .order('created_at', { ascending: true });

            console.log(`💬 Example ${i + 1} (Created: ${session.created_at.slice(0, 19)}):`);
            console.log(`${'─'.repeat(80)}`);
            
            if (messages && messages.length > 0) {
                for (const msg of messages) {
                    const role = msg.role === 'user' ? '🧑 Student' : '🤖 Levely';
                    console.log(`${role}:`);
                    console.log(`"${msg.content}"\n`);
                }
            } else {
                console.log('(No messages)');
            }
            console.log(`${'═'.repeat(80)}\n`);
        }

    } catch (err) {
        console.error('Error:', err.message);
    }
}

showNewExamples();
