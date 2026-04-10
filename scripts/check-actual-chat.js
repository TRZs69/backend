const prisma = require('../src/prismaClient');
const supabase = require('../supabase/supabase.js');

async function checkActualChatData() {
    console.log('🔍 Checking actual chat sessions & messages...\n');

    try {
        const { data: students } = await supabase
            .from('student_summaries')
            .select('user_id, student_name')
            .order('user_id');

        if (!students) return;

        console.log(`${'Name'.padEnd(35)} | Sessions | Messages | User Msgs | Bot Msgs`);
        console.log(`${'─'.repeat(75)}`);

        for (const s of students) {
            // Get sessions count
            const { data: sessions } = await supabase
                .from('chat_sessions')
                .select('id')
                .eq('user_id', s.user_id)
                .gte('created_at', '2026-03-26T00:00:00.000Z')
                .lte('created_at', '2026-04-09T23:59:59.999Z');

            if (!sessions || sessions.length === 0) {
                console.log(`${s.student_name.slice(0, 34).padEnd(35)} |    0     |    0    |    0    |    0`);
                continue;
            }

            const sessionIds = sessions.map(s => s.id);

            // Get messages count
            const { data: messages } = await supabase
                .from('chat_messages')
                .select('role')
                .in('session_id', sessionIds);

            const totalMsgs = messages ? messages.length : 0;
            const userMsgs = messages ? messages.filter(m => m.role === 'user').length : 0;
            const botMsgs = totalMsgs - userMsgs;

            console.log(`${s.student_name.slice(0, 34).padEnd(35)} |   ${sessions.length}    |   ${totalMsgs}    |   ${userMsgs}    |   ${botMsgs}`);
        }

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

checkActualChatData();
