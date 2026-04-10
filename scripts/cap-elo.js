const prisma = require('../src/prismaClient');
const evaluationService = require('../src/services/EvaluationService');
const supabase = require('../supabase/supabase.js');

const MAX_REALISTIC_ELO = 1300;
const MIN_ELO = 750;

const ELO_BADGE_BANDS = [
    { name: 'Beginner', min: 750 },
    { name: 'Basic Understanding', min: 1000 },
    { name: 'Developing Learner', min: 1200 },
    { name: 'Intermediate', min: 1400 },
    { name: 'Proficient', min: 1600 },
    { name: 'Advanced', min: 1800 },
    { name: 'Mastery', min: 2000 },
];

async function capELO() {
    console.log(`[Fix] Capping ELO to max ${MAX_REALISTIC_ELO}...\n`);

    try {
        const students = await prisma.user.findMany({
            where: { role: 'STUDENT' },
            select: { id: true, name: true, studentId: true, elo: true },
        });

        console.log(`Found ${students.length} students\n`);

        let cappedCount = 0;
        let totalReduction = 0;

        for (const student of students) {
            const currentElo = student.elo || MIN_ELO;
            
            if (currentElo > MAX_REALISTIC_ELO) {
                // Cap the ELO
                const newElo = MAX_REALISTIC_ELO;
                const reduction = currentElo - newElo;
                
                await prisma.user.update({
                    where: { id: student.id },
                    data: { elo: newElo },
                });

                // Update badges
                const badgeCount = ELO_BADGE_BANDS.filter((band) => newElo >= band.min).length;

                // Update Supabase
                await supabase
                    .from('student_summaries')
                    .update({
                        badges_earned: badgeCount,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('user_id', student.id);

                console.log(`📉 ${student.name}: ${currentElo} → ${newElo} (-${reduction}) | Badges: ${badgeCount}`);
                cappedCount++;
                totalReduction += reduction;
            } else {
                // Just update badges to be safe
                const badgeCount = ELO_BADGE_BANDS.filter((band) => currentElo >= band.min).length;
                
                await supabase
                    .from('student_summaries')
                    .update({
                        badges_earned: badgeCount,
                    })
                    .eq('user_id', student.id);
            }
        }

        console.log(`\n✅ Done! Capped ${cappedCount} students, total ELO reduction: ${totalReduction}`);
    } catch (err) {
        console.error('[Fix] Fatal error:', err.message);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

capELO();
