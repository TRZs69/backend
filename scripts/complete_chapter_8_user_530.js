const prisma = require('../src/prismaClient');

async function completeChaptersUpTo8() {
    const userId = 530;
    const courseId = 19;
    const maxLevel = 8;
    const nextChapterLevel = 9;
    const totalChapters = 16;

    console.log(`--- Completing Chapters up to Level ${maxLevel} for User ${userId} ---`);

    try {
        // Find all chapters up to Level 8 for course 19
        const chapters = await prisma.chapter.findMany({
            where: { courseId, level: { lte: maxLevel } }
        });

        const chapterIds = chapters.map(c => c.id);

        for (const chapterId of chapterIds) {
            console.log(`Processing Chapter ID ${chapterId} (Level ${chapters.find(c => c.id === chapterId).level})`);
            
            // 1. Deduplicate UserChapter records for this user and chapter
            const userChapters = await prisma.userChapter.findMany({
                where: { userId, chapterId }
            });

            if (userChapters.length > 1) {
                console.log(`  Found ${userChapters.length} records. Deduplicating...`);
                for (let i = 1; i < userChapters.length; i++) {
                    await prisma.userChapter.delete({ where: { id: userChapters[i].id } });
                }
            }

            // 2. Update or create the UserChapter record
            const updateData = {
                isStarted: true,
                isCompleted: true,
                materialDone: true,
                assessmentDone: true,
                assignmentDone: true,
                timeFinished: new Date()
            };

            const result = await prisma.userChapter.upsert({
                where: { 
                    id: userChapters[0]?.id || -1 
                },
                update: updateData,
                create: {
                    ...updateData,
                    userId,
                    chapterId
                }
            });
            console.log(`  UserChapter ${result.id} set to COMPLETED.`);
        }

        // 3. Update UserCourse
        const progress = Math.round((maxLevel / totalChapters) * 100);
        
        await prisma.userCourse.updateMany({
            where: { userId, courseId },
            data: {
                currentChapter: nextChapterLevel,
                progress: progress
            }
        });

        console.log(`UserCourse for course ${courseId} updated: currentChapter=${nextChapterLevel}, progress=${progress}%`);

        // 4. Clean up other potential duplicates for user 530
        const allUserChapters = await prisma.userChapter.findMany({
            where: { userId }
        });

        const seenChapters = new Set();
        for (const uc of allUserChapters) {
            if (seenChapters.has(uc.chapterId)) {
                console.log(`Deleting duplicate UserChapter ID ${uc.id} (Chapter ${uc.chapterId})`);
                await prisma.userChapter.delete({ where: { id: uc.id } });
            } else {
                seenChapters.add(uc.chapterId);
            }
        }

        console.log('--- Done ---');
    } catch (err) {
        console.error('Failed to complete chapters:', err);
    } finally {
        await prisma.$disconnect();
    }
}

completeChaptersUpTo8();
