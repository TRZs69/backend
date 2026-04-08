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

        // Session management in serverless has connection issues
        // Just verify JWT is valid; sessions are managed separately
        // Fire-and-forget session update if needed
        if (jwtDecode.id && process.env.NODE_ENV !== 'production') {
            // Only do session management in non-production
            const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
            prisma.userSession.findFirst({
                where: {
                    userId: jwtDecode.id,
                    loginAt: { gte: fourHoursAgo }
                },
                orderBy: { loginAt: 'desc' }
            }).then(activeSession => {
                if (!activeSession) {
                    prisma.userSession.create({
                        data: { userId: jwtDecode.id }
                    }).then(async (newSession) => {
                        await evaluationService.syncSummaryToSupabase(jwtDecode.id).catch(() => {});
                    }).catch(() => {});
                } else {
                    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
                    if (!activeSession.lastActiveAt || activeSession.lastActiveAt < fiveMinutesAgo) {
                        prisma.userSession.update({
                            where: { id: activeSession.id },
                            data: { lastActiveAt: new Date() }
                        }).catch(() => {});
                    }
                }
            }).catch(() => {});
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