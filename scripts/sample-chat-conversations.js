const supabase = require('../supabase/supabase.js');

async function sampleConversations() {
    console.log('🔍 Sampling chat conversations...\n');

    try {
        // Get 5 random recent sessions
        const { data: sessions } = await supabase
            .from('chat_sessions')
            .select('id, user_id, created_at')
            .order('created_at', { ascending: false })
            .limit(5);

        if (!sessions) return;

        for (const session of sessions) {
            const { data: messages } = await supabase
                .from('chat_messages')
                .select('role, content')
                .eq('session_id', session.id)
                .order('created_at', { ascending: true });

            console.log(`📝 Session ID: ${session.id}`);
            console.log(`${'─'.repeat(80)}`);
            
            if (messages) {
                for (const msg of messages) {
                    const icon = msg.role === 'user' ? '🧑 Student' : '🤖 Levely';
                    // Truncate long messages for display
                    let content = msg.content;
                    if (content.length > 150) {
                        content = content.substring(0, 150) + '...';
                    }
                    console.log(`${icon}: "${content}"\n`);
                }
            }
            console.log(`${'═'.repeat(80)}\n`);
        }
    } catch (err) {
        console.error('Error:', err.message);
    }
}

sampleConversations();
