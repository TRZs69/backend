const prisma = require('../src/prismaClient');
const supabase = require('../supabase/supabase.js');

async function sampleExistingChatMessages() {
    console.log('[Sample] Sampling existing user chat messages...\n');

    try {
        // Get some sessions with messages
        const { data: sessions } = await supabase
            .from('chat_sessions')
            .select('id, user_id')
            .limit(20);

        if (!sessions || sessions.length === 0) {
            console.log('No sessions found');
            return;
        }

        const sessionIds = sessions.map(s => s.id);
        const { data: messages } = await supabase
            .from('chat_messages')
            .select('role, content, created_at, session_id')
            .in('session_id', sessionIds)
            .order('created_at', { ascending: true })
            .limit(50);

        if (!messages) {
            console.log('No messages found');
            return;
        }

        console.log(`Found ${messages.length} messages\n`);
        console.log(`${'='.repeat(80)}`);
        
        let currentUser = '';
        for (const msg of messages) {
            if (msg.role === 'user') {
                console.log(`\n🧑 USER [${msg.created_at.slice(0, 16)}]:`);
                console.log(`   "${msg.content}"`);
            } else if (msg.role === 'assistant') {
                console.log(`\n🤖 LEVELY [${msg.created_at.slice(0, 16)}]:`);
                // Show first 150 chars of assistant response
                const preview = msg.content.length > 150 ? msg.content.slice(0, 150) + '...' : msg.content;
                console.log(`   "${preview}"`);
            }
        }

        console.log(`\n${'='.repeat(80)}`);
        console.log('\n✅ Done sampling!');
    } catch (err) {
        console.error('[Sample] Error:', err.message);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

sampleExistingChatMessages();
