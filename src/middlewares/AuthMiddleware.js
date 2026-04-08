const jwt = require('jsonwebtoken');
const prisma = require('../prismaClient');
const evaluationService = require('../services/EvaluationService');

async function authMiddleware(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) { 
        return res.status(401).json({ message: "No token provided" });
    }

    const secret = process.env.JWT_SECRET;

    if (!secret) {
        return res.status(500).json({ message: "JWT secret is not set" });
    }

    try {
        const jwtDecode = jwt.verify(token, secret);
        req.user = jwtDecode;

        // Passive Session Start & Extension:
        // If the user is authenticated but doesn't have a session started within the last 4 hours, 
        // create a new one. Also, automatically extend the lastActiveAt to keep sessions alive
        // even if the client doesn't send heartbeat calls.
        if (jwtDecode.id) {
            const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
            try {
                const activeSession = await prisma.userSession.findFirst({
                    where: {
                        userId: jwtDecode.id,
                        loginAt: { gte: fourHoursAgo }
                    },
                    orderBy: { loginAt: 'desc' }
                });

                if (!activeSession) {
                    // We run this in the background (no await) to avoid slowing down every request
                    prisma.userSession.create({
                        data: { userId: jwtDecode.id }
                    }).then(async (newSession) => {
                        // Sync to Supabase Live when a new session starts
                        await evaluationService.syncSummaryToSupabase(jwtDecode.id).catch(e => console.error('[AuthMiddleware] Supabase sync failed:', e.message));
                    }).catch(err => console.error('[AuthMiddleware] Passive session start failed:', err.message));
                } else {
                    // Auto-extend the active session in the background (don't await to avoid blocking)
                    // Only extend if lastActiveAt is older than 5 minutes to reduce database load
                    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
                    if (!activeSession.lastActiveAt || activeSession.lastActiveAt < fiveMinutesAgo) {
                        prisma.userSession.update({
                            where: { id: activeSession.id },
                            data: { lastActiveAt: new Date() }
                        }).catch(err => console.error('[AuthMiddleware] Session extension failed:', err.message));
                    }
                }
            } catch (dbErr) {
                console.error('[AuthMiddleware] Session query failed:', dbErr.message);
                // Don't block the request on database errors
            }
        }

        next();
    } catch (error) {
        return res.status(401).json({
            message: 'Unauthorized',
            detail: error.message
        });
    }
}

module.exports = authMiddleware;