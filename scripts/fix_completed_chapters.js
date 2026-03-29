const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixCompletedChapters() {
    console.log('--- Starting Fix for Completed Chapters ---');
    
    try {
        // Find all user chapters where material and assessment are done but isCompleted is false
        const chaptersToFix = await prisma.userChapter.findMany({
            where: {
                materialDone: true,
                assessmentDone: true,
                isCompleted: false
            }
        });

        console.log(`Found ${chaptersToFix.length} chapters to fix.`);

        for (const uc of chaptersToFix) {
            await prisma.userChapter.update({
                where: { id: uc.id },
                data: { 
                    isCompleted: true,
                    timeFinished: uc.timeFinished || new Date()
                }
            });
            console.log(`  [FIXED] User ID ${uc.userId}, Chapter ID ${uc.chapterId}`);
        }

        console.log('--- Fix Completed ---');
    } catch (err) {
        console.error('Fix failed:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

fixCompletedChapters();
