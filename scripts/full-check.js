const prisma = require('../src/prismaClient');
const supabase = require('../supabase/supabase.js');

const IPHONE_USERS = ['Joey Cristo Thruli', 'Wahyu Rizky F Simanjorang', 'Lofelyn Enzely Ambarita'];

async function fullCheck() {
    console.log('🔍 FULL CHECK: student_summaries table\n');

    try {
        const { data: summaries, error } = await supabase
            .from('student_summaries')
            .select('*')
            .order('user_id');

        if (error) {
            console.error('❌ Error:', error.message);
            return;
        }

        const issues = [];
        let withChat = 0, withLikert = 0, withDuration = 0, withCh8 = 0, withAss8 = 0;
        let totalStudents = summaries.length;

        console.log(`${'─'.repeat(90)}`);
        console.log(`${'Name'.padEnd(35)} | Ch | Ass | ELO | Chat | Likert | Dur | Badges`);
        console.log(`${'─'.repeat(90)}`);

        for (const s of summaries) {
            const name = (s.student_name || 'Unknown').slice(0, 34).padEnd(35);
            const isIPhone = IPHONE_USERS.includes(s.student_name);
            const ch = s.chapters_completed ?? '?';
            const ass = s.assessments_submitted ?? '?';
            const avgGrade = s.avg_grade ?? 0;
            const chat = s.chat_user_messages ?? 0;
            const hasLikert = s.sdt_autonomy_likert ? '✅' : '❌';
            const dur = s.avg_session_duration_sec ?? 0;
            const badges = s.badges_earned ?? '?';

            // Display
            const chatIcon = isIPhone ? '—' : (chat > 0 ? '✅' : '❌');
            console.log(`${name} | ${String(ch).padStart(2)} | ${String(ass).padStart(3)} | ${String(avgGrade).padStart(3)}% | ${chatIcon} | ${hasLikert} | ${String(dur).padStart(4)}s | ${badges}`);

            // Validation
            if (!isIPhone) {
                if (s.chapters_completed !== 8) issues.push(`${s.student_name}: chapters_completed = ${s.chapters_completed} (expected 8)`);
                if (s.assessments_submitted !== 8) issues.push(`${s.student_name}: assessments_submitted = ${s.assessments_submitted} (expected 8)`);
                if (!s.sdt_autonomy_likert) issues.push(`${s.student_name}: missing Likert scores`);
                if (s.avg_session_duration_sec === 0 || !s.avg_session_duration_sec) issues.push(`${s.student_name}: avg_session_duration_sec = 0`);
                if (s.chat_user_messages === 0 || !s.chat_user_messages) issues.push(`${s.student_name}: no chat messages`);
                if (s.badges_earned < 1 || s.badges_earned > 3) issues.push(`${s.student_name}: badges_earned = ${s.badges_earned} (expected 1-3)`);

                if (s.chapters_completed === 8) withCh8++;
                if (s.assessments_submitted === 8) withAss8++;
                if (s.chat_user_messages > 0) withChat++;
                if (s.sdt_autonomy_likert) withLikert++;
                if (s.avg_session_duration_sec > 0) withDuration++;
            } else {
                // iPhone users should be 0
                if (s.sessions_total > 0 || s.chapters_completed > 0 || s.assessments_submitted > 0) {
                    issues.push(`${s.student_name} (iPhone): should be all zeros but has data`);
                }
                if (s.sdt_autonomy_likert !== null) issues.push(`${s.student_name} (iPhone): Likert should be null`);
            }
        }

        console.log(`${'─'.repeat(90)}\n`);

        // Summary
        console.log('📊 SUMMARY:');
        console.log(`  Total students: ${totalStudents}`);
        console.log(`  iPhone users: ${IPHONE_USERS.length}`);
        console.log(`  Active students: ${totalStudents - IPHONE_USERS.length}`);
        console.log(`\n  Chapters = 8: ${withCh8}/${totalStudents - IPHONE_USERS.length}`);
        console.log(`  Assessments = 8: ${withAss8}/${totalStudents - IPHONE_USERS.length}`);
        console.log(`  Chat data: ${withChat}/${totalStudents - IPHONE_USERS.length}`);
        console.log(`  Likert scores: ${withLikert}/${totalStudents - IPHONE_USERS.length}`);
        console.log(`  Duration > 0: ${withDuration}/${totalStudents - IPHONE_USERS.length}`);

        if (issues.length === 0) {
            console.log(`\n✅ ALL CHECKS PASSED! Data is clean and complete.`);
        } else {
            console.log(`\n⚠️  Found ${issues.length} issue(s):\n`);
            issues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));
        }

        // Top/Bottom performers
        const activeStudents = summaries.filter(s => !IPHONE_USERS.includes(s.student_name));
        const sorted = [...activeStudents].sort((a, b) => (b.avg_grade || 0) - (a.avg_grade || 0));

        console.log(`\n🏆 TOP 5 (by avg_grade):`);
        sorted.slice(0, 5).forEach((s, i) => {
            console.log(`  ${i + 1}. ${s.student_name}: grade=${s.avg_grade}%, points=${s.total_points_earned}, ELO=${s.sdt_autonomy_score}`);
        });

        console.log(`\n📉 BOTTOM 5 (by avg_grade):`);
        sorted.slice(-5).reverse().forEach((s, i) => {
            console.log(`  ${i + 1}. ${s.student_name}: grade=${s.avg_grade}%, points=${s.total_points_earned}, ELO=${s.sdt_autonomy_score}`);
        });

    } catch (err) {
        console.error('❌ Fatal error:', err.message);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

fullCheck();
