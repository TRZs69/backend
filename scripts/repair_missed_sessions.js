const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const supabase = require('../supabase/supabase.js');

async function repairSessions() {
    console.log('--- Starting Session Repair Script ---');
    const start = new Date('2026-03-26T00:00:00Z');
    const end = new Date('2026-03-28T23:59:59Z');

    try {
        const students = await prisma.user.findMany({
            where: { role: 'STUDENT' },
            select: { id: true, name: true }
        });

        for (const student of students) {
            console.log(`Checking activity for: ${student.name} (ID: ${student.id})`);
            
            // 1. Get all existing session dates for this student
            const sessions = await prisma.userSession.findMany({
                where: { userId: student.id, loginAt: { gte: start, lte: end } }
            });
            const sessionDates = new Set(sessions.map(s => s.loginAt.toISOString().slice(0, 13))); // Accuracy to the hour

            // 2. Gather activity timestamps from other tables
            const activities = [];

            // Activity from Assessment Attempts
            const assessments = await prisma.assessmentAttempt.findMany({
                where: { userId: student.id, submittedAt: { gte: start, lte: end } },
                select: { submittedAt: true }
            });
            assessments.forEach(a => activities.push(a.submittedAt));

            // Activity from Chapter Progress
            const chapters = await prisma.userChapter.findMany({
                where: { userId: student.id, timeFinished: { gte: start, lte: end } },
                select: { timeFinished: true }
            });
            chapters.forEach(c => activities.push(c.timeFinished));

            // Activity from Supabase (Chat)
            const { data: chatSessions } = await supabase
                .from('chat_sessions')
                .select('id, created_at')
                .eq('user_id', student.id)
                .gte('created_at', start.toISOString())
                .lte('created_at', end.toISOString());
            
            if (chatSessions) {
                chatSessions.forEach(s => activities.push(new Date(s.created_at)));
            }

            // 3. Create missing sessions
            let createdCount = 0;
            const processedHours = new Set();

            for (const activityTime of activities) {
                const hourKey = activityTime.toISOString().slice(0, 13);
                
                // If no session exists for this hour and we haven't created one for this hour yet
                if (!sessionDates.has(hourKey) && !processedHours.has(hourKey)) {
                    await prisma.userSession.create({
                        data: {
                            userId: student.id,
                            loginAt: activityTime,
                            logoutAt: new Date(activityTime.getTime() + 15 * 60 * 1000), // Assume 15 mins
                            durationSec: 900
                        }
                    });
                    processedHours.add(hourKey);
                    createdCount++;
                }
            }

            if (createdCount > 0) {
                console.log(`  [REPAIRED] Created ${createdCount} synthetic sessions for ${student.name}`);
            }
        }

        console.log('--- Session Repair Completed ---');
    } catch (err) {
        console.error('Repair failed:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

repairSessions();
