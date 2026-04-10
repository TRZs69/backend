const prisma = require('../src/prismaClient');
const supabase = require('../supabase/supabase.js');

const IPHONE_USERS = ['Joey Cristo Thruli', 'Wahyu Rizky F Simanjorang', 'Lofelyn Enzely Ambarita'];

async function verifyChatData() {
    console.log('[ChatVerify] Checking chat data coverage...\n');

    try {
        const { data: summaries } = await supabase
            .from('student_summaries')
            .select('student_name, chat_sessions, chat_messages, chat_user_messages')
            .order('student_name');

        let withChat = 0;
        let withoutChat = 0;
        let iphoneCount = 0;

        console.log('Student Chat Data Status:\n');
        for (const s of summaries) {
            const isIPhone = IPHONE_USERS.includes(s.student_name);
            const hasChat = s.chat_user_messages > 0;

            if (isIPhone) {
                iphoneCount++;
                console.log(`📱 ${s.student_name} (iPhone) - Skipped`);
            } else if (hasChat) {
                withChat++;
                console.log(`✅ ${s.student_name}: sessions=${s.chat_sessions}, messages=${s.chat_messages}, user_msg=${s.chat_user_messages}`);
            } else {
                withoutChat++;
                console.log(`❌ ${s.student_name}: NO CHAT DATA`);
            }
        }

        console.log(`\n${'='.repeat(60)}`);
        console.log(`Summary:`);
        console.log(`  With chat data: ${withChat}`);
        console.log(`  Without chat data: ${withoutChat}`);
        console.log(`  iPhone users (skipped): ${iphoneCount}`);
        console.log(`  Total: ${summaries.length}`);

        if (withoutChat === 0) {
            console.log('\n✅ All non-iPhone students have chat data!');
        } else {
            console.log(`\n⚠️  ${withoutChat} students still missing chat data`);
        }
    } catch (err) {
        console.error('[ChatVerify] Error:', err.message);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

verifyChatData();
