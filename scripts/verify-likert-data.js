const prisma = require('../src/prismaClient');
const supabase = require('../supabase/supabase.js');

async function verifyLikertData() {
    console.log('[Verify] Checking Likert data in Supabase...\n');

    try {
        const { data: summaries, error } = await supabase
            .from('student_summaries')
            .select('user_id, student_name, sdt_autonomy_likert, sdt_competence_likert, sdt_relatedness_likert, sdt_overall_likert, engagement_behavioral_likert, engagement_cognitive_likert, engagement_emotional_likert, engagement_overall_likert, global_overall_likert')
            .order('user_id');

        if (error) {
            console.error('Error:', error.message);
            return;
        }

        let filledCount = 0;
        let emptyCount = 0;

        console.log('Student Likert Data Status:\n');
        for (const s of summaries) {
            const hasLikert = s.sdt_autonomy_likert !== null && s.sdt_autonomy_likert !== undefined;
            const status = hasLikert ? '✅' : '❌';
            
            if (hasLikert) {
                filledCount++;
                console.log(`${status} ${s.student_name} (ID: ${s.user_id})`);
                console.log(`   SDT: ${s.sdt_autonomy_likert}, ${s.sdt_competence_likert}, ${s.sdt_relatedness_likert}, ${s.sdt_overall_likert}`);
                console.log(`   Engagement: ${s.engagement_behavioral_likert}, ${s.engagement_cognitive_likert}, ${s.engagement_emotional_likert}, ${s.engagement_overall_likert}`);
                console.log(`   Overall: ${s.global_overall_likert}\n`);
            } else {
                emptyCount++;
            }
        }

        console.log(`\n${'='.repeat(60)}`);
        console.log(`Summary:`);
        console.log(`  With Likert data: ${filledCount}`);
        console.log(`  Without Likert data: ${emptyCount}`);
        console.log(`  Total: ${summaries.length}`);
    } catch (err) {
        console.error('[Verify] Error:', err.message);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

verifyLikertData();
