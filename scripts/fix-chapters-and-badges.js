const prisma = require('../src/prismaClient');
const evaluationService = require('../src/services/EvaluationService');
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

async function fixChaptersAndBadges() {
    console.log('[Fix] Updating chapters_completed and badges_earned...\n');

    try {
        const students = await prisma.user.findMany({
            where: { role: 'STUDENT' },
            select: { id: true, name: true, studentId: true, elo: true },
        });

        console.log(`Found ${students.length} students\n`);

        let updatedCount = 0;

        for (const student of students) {
            try {
                // Count completed chapters 1-8 only
                const chapter8 = await prisma.chapter.findFirst({
                    where: { level: 8 },
                    select: { id: true },
                });

                const chapters1to8 = await prisma.chapter.findMany({
                    where: { level: { lte: 8 } },
                    select: { id: true, level: true },
                    orderBy: { level: 'asc' },
                });

                let completedChapters = 0;
                for (const ch of chapters1to8) {
                    const userChapter = await prisma.userChapter.findFirst({
                        where: {
                            userId: student.id,
                            chapterId: ch.id,
                            isCompleted: true,
                        },
                    });
                    if (userChapter) {
                        completedChapters++;
                    }
                }

                // Cap at 8
                completedChapters = Math.min(completedChapters, 8);

                // Calculate badges based on ELO
                const userElo = student.elo || 750;
                const badgeCount = ELO_BADGE_BANDS.filter((band) => userElo >= band.min).length;

                // Update Supabase
                const { error } = await supabase
                    .from('student_summaries')
                    .update({
                        chapters_completed: completedChapters,
                        badges_earned: badgeCount,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('user_id', student.id);

                if (error) {
                    console.error(`❌ ${student.name}: ${error.message}`);
                } else {
                    console.log(`✅ ${student.name} | Chapters: ${completedChapters}/8 | ELO: ${userElo} | Badges: ${badgeCount}`);
                    updatedCount++;
                }
            } catch (err) {
                console.error(`❌ ${student.name}: ${err.message}`);
            }
        }

        console.log(`\n✅ Done! Updated ${updatedCount} students`);
    } catch (err) {
        console.error('[Fix] Fatal error:', err.message);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

fixChaptersAndBadges();
