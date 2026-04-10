const prisma = require('../src/prismaClient');
const supabase = require('../supabase/supabase.js');

async function sampleLevelyResponses() {
    console.log('🔍 Sampling existing Levely responses from database...\n');

    try {
        // Get random sessions
        const { data: sessions } = await supabase
            .from('chat_sessions')
            .select('id, user_id')
            .order('created_at', { ascending: false })
            .limit(30);

        if (!sessions || sessions.length === 0) {
            console.log('No sessions found');
            return;
        }

        const sessionIds = sessions.map(s => s.id);
        const { data: messages } = await supabase
            .from('chat_messages')
            .select('role, content, created_at')
            .in('session_id', sessionIds)
            .order('created_at', { ascending: true });

        if (!messages) return;

        console.log(`Found ${messages.length} messages\n`);
        console.log(`${'─'.repeat(90)}`);

        // Show a few user/assistant pairs
        let count = 0;
        let userMsg = '';

        for (const msg of messages) {
            if (msg.role === 'user') {
                userMsg = msg.content;
            } else if (msg.role === 'assistant' && userMsg && count < 10) {
                console.log(`\n🧑 USER: "${userMsg}"`);
                console.log(`\n🤖 LEVELY: "${msg.content}"`);
                console.log(`${'─'.repeat(90)}`);
                count++;
                userMsg = '';
            }
        }

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

sampleLevelyResponses();
