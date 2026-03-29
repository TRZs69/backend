const jwt = require('jsonwebtoken');
const prisma = require('../prismaClient');

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

        // Passive Session Start:
        // If the user is authenticated but doesn't have a session started within the last 4 hours, 
        // create a new one to track their return activity.
        if (jwtDecode.id) {
            const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
            const activeSession = await prisma.userSession.findFirst({
                where: {
                    userId: jwtDecode.id,
                    loginAt: { gte: fourHoursAgo }
                }
            });

            if (!activeSession) {
                // We run this in the background (no await) to avoid slowing down every request
                prisma.userSession.create({
                    data: { userId: jwtDecode.id }
                }).catch(err => console.error('[AuthMiddleware] Passive session start failed:', err.message));
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