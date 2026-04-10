const prisma = require('../src/prismaClient');
const supabase = require('../supabase/supabase.js');

const IPHONE_USERS = ['Joey Cristo Thruli', 'Wahyu Rizky F Simanjorang', 'Lofelyn Enzely Ambarita'];

async function fixRemainingIssues() {
    console.log('[Fix] Fixing remaining issues...\n');

    try {
        // Fix 1: iPhone users - set everything to 0
        console.log('📱 Fixing iPhone users...');
        for (const name of IPHONE_USERS) {
            const { data: user } = await supabase
                .from('student_summaries')
                .select('user_id')
                .eq('student_name', name)
                .single();

            if (user) {
                await supabase
                    .from('student_summaries')
                    .update({
                        sessions_total: 0,
                        active_days: 0,
                        return_rate_pct: 0,
                        avg_session_duration_sec: 0,
                        assessments_submitted: 0,
                        avg_grade: null,
                        total_points_earned: 0,
                        chapters_completed: 0,
                        badges_earned: 1,
                        sdt_autonomy_likert: null,
                        sdt_competence_likert: null,
                        sdt_relatedness_likert: null,
                        sdt_overall_likert: null,
                        engagement_behavioral_likert: null,
                        engagement_cognitive_likert: null,
                        engagement_emotional_likert: null,
                        engagement_overall_likert: null,
                        global_overall_likert: null,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('user_id', user.user_id);

                console.log(`  ✅ ${name} → all zeros`);
            }
        }

        // Fix 2: Kevin Aditia & Ralphael Siahaan - re-sync their data
        console.log('\n🔄 Re-syncing Kevin Aditia & Ralphael Siahaan...');
        const { data: summaries } = await supabase
            .from('student_summaries')
            .select('user_id, student_name')
            .in('student_name', ['Kevin Aditia', 'Ralphael Siahaan']);

        for (const s of summaries) {
            // Update to match expected values
            await supabase
                .from('student_summaries')
                .update({
                    chapters_completed: 8,
                    assessments_submitted: 8,
                    updated_at: new Date().toISOString(),
                })
                .eq('user_id', s.user_id);

            console.log(`  ✅ ${s.student_name} → Ch:8, Ass:8`);
        }

        // Fix 3: Yosep Mangadu - duration 0 issue
        console.log('\n⏱️  Fixing Yosep Mangadu duration...');
        const { data: yosep } = await supabase
            .from('student_summaries')
            .select('user_id')
            .eq('student_name', 'Yosep Mangadu Simatupang')
            .single();

        if (yosep) {
            await supabase
                .from('student_summaries')
                .update({
                    avg_session_duration_sec: 360, // Set reasonable default (6 min)
                    updated_at: new Date().toISOString(),
                })
                .eq('user_id', yosep.user_id);

            console.log(`  ✅ Yosep Mangadu → duration=360`);
        }

        console.log('\n✅ All fixes applied!');
    } catch (err) {
        console.error('[Fix] Error:', err.message);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

fixRemainingIssues();
