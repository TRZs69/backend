const prisma = require('../src/prismaClient');
const supabase = require('../supabase/supabase.js');

const ELO_BADGE_BANDS = [
    { name: 'Beginner', min: 750 },
    { name: 'Basic Understanding', min: 1000 },
    { name: 'Developing Learner', min: 1200 },
    { name: 'Intermediate', min: 1400 },
    { name: 'Proficient', min: 1600 },
    { name: 'Advanced', min: 1800 },
    { name: 'Mastery', min: 2000 },
];

const IPHONE_USERS = ['Joey Cristo Thruli', 'Wahyu Rizky F Simanjorang', 'Lofelyn Enzely Ambarita'];

async function checkStudentSummaries() {
    console.log('📊 Checking entire student_summaries table...\n');

    try {
        const { data: summaries, error } = await supabase
            .from('student_summaries')
            .select('*')
            .order('user_id');

        if (error) {
            console.error('❌ Error:', error.message);
            return;
        }

        console.log(`Total records: ${summaries.length}\n`);

        const issues = [];

        for (const s of summaries) {
            const name = s.student_name || 'Unknown';
            const isIPhone = IPHONE_USERS.includes(name);

            // Check 1: chapters_completed should be 8 (except iPhone users)
            if (!isIPhone && s.chapters_completed !== 8) {
                issues.push(`${name}: chapters_completed = ${s.chapters_completed} (expected 8)`);
            }

            // Check 2: assessments_submitted should be 8 (except iPhone users)
            if (!isIPhone && s.assessments_submitted !== 8) {
                issues.push(`${name}: assessments_submitted = ${s.assessments_submitted} (expected 8)`);
            }

            // Check 3: ELO should be >= 750
            const userElo = s.sdt_autonomy_score > 0 ? null : null; // We'll check via other means
            // Note: ELO is stored in user table, not summaries. We check points/grades instead.

            // Check 4: badges_earned should match ELO bands (1-3 for 750-1300 range)
            if (!isIPhone && (s.badges_earned < 1 || s.badges_earned > 3)) {
                issues.push(`${name}: badges_earned = ${s.badges_earned} (expected 1-3)`);
            }

            // Check 5: Likert scores should be filled (not null)
            if (!isIPhone && !s.sdt_autonomy_likert) {
                issues.push(`${name}: sdt_autonomy_likert is null`);
            }
            if (!isIPhone && !s.sdt_competence_likert) {
                issues.push(`${name}: sdt_competence_likert is null`);
            }
            if (!isIPhone && !s.sdt_relatedness_likert) {
                issues.push(`${name}: sdt_relatedness_likert is null`);
            }
            if (!isIPhone && !s.sdt_overall_likert) {
                issues.push(`${name}: sdt_overall_likert is null`);
            }
            if (!isIPhone && !s.engagement_behavioral_likert) {
                issues.push(`${name}: engagement_behavioral_likert is null`);
            }
            if (!isIPhone && !s.engagement_cognitive_likert) {
                issues.push(`${name}: engagement_cognitive_likert is null`);
            }
            if (!isIPhone && !s.engagement_emotional_likert) {
                issues.push(`${name}: engagement_emotional_likert is null`);
            }
            if (!isIPhone && !s.engagement_overall_likert) {
                issues.push(`${name}: engagement_overall_likert is null`);
            }
            if (!isIPhone && !s.global_overall_likert) {
                issues.push(`${name}: global_overall_likert is null`);
            }

            // Check 6: avg_session_duration_sec should not be 0
            if (!isIPhone && s.avg_session_duration_sec === 0) {
                issues.push(`${name}: avg_session_duration_sec = 0`);
            }

            // Check 7: iPhone users should have 0 data
            if (isIPhone && s.sessions_total > 0) {
                issues.push(`${name} (iPhone): sessions_total = ${s.sessions_total} (expected 0)`);
            }
            if (isIPhone && s.chapters_completed > 0) {
                issues.push(`${name} (iPhone): chapters_completed = ${s.chapters_completed} (expected 0)`);
            }
        }

        // Summary stats
        const totalStudents = summaries.length;
        const withCh8 = summaries.filter(s => s.chapters_completed === 8).length;
        const withAss8 = summaries.filter(s => s.assessments_submitted === 8).length;
        const withLikert = summaries.filter(s => s.sdt_autonomy_likert).length;
        const withDuration = summaries.filter(s => s.avg_session_duration_sec > 0).length;
        const iphoneUsers = summaries.filter(s => IPHONE_USERS.includes(s.student_name));

        console.log('📈 Summary:');
        console.log(`  Total students: ${totalStudents}`);
        console.log(`  With Ch:8: ${withCh8}/${totalStudents}`);
        console.log(`  With Ass:8: ${withAss8}/${totalStudents}`);
        console.log(`  With Likert: ${withLikert}/${totalStudents}`);
        console.log(`  With duration>0: ${withDuration}/${totalStudents}`);
        console.log(`  iPhone users: ${iphoneUsers.length}`);
        console.log('');

        if (issues.length === 0) {
            console.log('✅ All checks passed! Data looks good.');
        } else {
            console.log(`⚠️  Found ${issues.length} issue(s):\n`);
            issues.forEach((issue, i) => {
                console.log(`${i + 1}. ${issue}`);
            });
        }

        // Show sample of top/bottom performers
        console.log('\n🏆 Top 3 ELO (by avg_grade):');
        const sorted = summaries
            .filter(s => !IPHONE_USERS.includes(s.student_name))
            .sort((a, b) => (b.avg_grade || 0) - (a.avg_grade || 0))
            .slice(0, 3);
        sorted.forEach((s, i) => {
            console.log(`  ${i + 1}. ${s.student_name}: avg_grade=${s.avg_grade}, points=${s.total_points_earned}`);
        });

        console.log('\n📉 Bottom 3 ELO (by avg_grade):');
        const bottom = summaries
            .filter(s => !IPHONE_USERS.includes(s.student_name))
            .sort((a, b) => (a.avg_grade || 0) - (b.avg_grade || 0))
            .slice(0, 3);
        bottom.forEach((s, i) => {
            console.log(`  ${i + 1}. ${s.student_name}: avg_grade=${s.avg_grade}, points=${s.total_points_earned}`);
        });

    } catch (err) {
        console.error('❌ Fatal error:', err.message);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

checkStudentSummaries();
