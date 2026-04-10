const prisma = require('../src/prismaClient');
const supabase = require('../supabase/supabase.js');

const ORIGINAL_STUDENTS = [
    'Sri Intan Ivana Pasaribu',
    'Jelita Sibarani',
    'Yosep Mangadu Simatupang',
    'Elkana Sitorus',
    'Wesly Fery Wanda Ambarita',
    'Marshall Manurung',
    'Grace Evelin Siallagan',
    'Maharani Sitorus',
    'Kevin Aditia',
    'Ralphael Siahaan',
];

async function fixOriginalChapters() {
    console.log('[Fix] Updating chapters_completed for original students...\n');

    try {
        const { data: summaries } = await supabase
            .from('student_summaries')
            .select('user_id, student_name')
            .in('student_name', ORIGINAL_STUDENTS);

        for (const s of summaries) {
            const { error } = await supabase
                .from('student_summaries')
                .update({
                    chapters_completed: 8,
                    updated_at: new Date().toISOString(),
                })
                .eq('user_id', s.user_id);

            if (error) {
                console.error(`❌ ${s.student_name}: ${error.message}`);
            } else {
                console.log(`✅ ${s.student_name} → Ch:8`);
            }
        }

        console.log('\n✅ Done!');
    } catch (err) {
        console.error('[Fix] Error:', err.message);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

fixOriginalChapters();
