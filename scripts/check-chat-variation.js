const prisma = require('../src/prismaClient');
const supabase = require('../supabase/supabase.js');

const IPHONE_USERS = ['Joey Cristo Thruli', 'Wahyu Rizky F Simanjorang', 'Lofelyn Enzely Ambarita'];

async function checkChatVariation() {
    console.log('📊 Checking chat data variation...\n');

    try {
        const { data: summaries } = await supabase
            .from('student_summaries')
            .select('student_name, chat_sessions, chat_messages, chat_user_messages, avg_grade')
            .order('chat_messages', { ascending: false });

        if (!summaries) return;

        const activeStudents = summaries.filter(s => !IPHONE_USERS.includes(s.student_name));

        console.log(`${'Name'.padEnd(35)} | Grade | Sessions | Messages | User Msgs`);
        console.log(`${'─'.repeat(75)}`);

        for (const s of activeStudents) {
            const name = s.student_name.slice(0, 34).padEnd(35);
            console.log(`${name} | ${(s.avg_grade || 0).toString().padStart(3)}% | ${(s.chat_sessions || 0).toString().padStart(2)} | ${(s.chat_messages || 0).toString().padStart(2)} | ${(s.chat_user_messages || 0).toString().padStart(2)}`);
        }

        console.log(`${'─'.repeat(75)}\n`);

        // Summary stats
        const sessionCounts = activeStudents.map(s => s.chat_sessions || 0);
        const msgCounts = activeStudents.map(s => s.chat_messages || 0);

        console.log('📈 Chat Variation Summary:');
        console.log(`  Sessions range: ${Math.min(...sessionCounts)}-${Math.max(...sessionCounts)}`);
        console.log(`  Messages range: ${Math.min(...msgCounts)}-${Math.max(...msgCounts)}`);
        console.log(`  Avg sessions: ${(sessionCounts.reduce((a, b) => a + b, 0) / sessionCounts.length).toFixed(1)}`);
        console.log(`  Avg messages: ${(msgCounts.reduce((a, b) => a + b, 0) / msgCounts.length).toFixed(1)}`);

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

checkChatVariation();
