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
        // First decode without verification to get payload
        const decoded = jwt.decode(token);
        if (!decoded) {
            return res.status(401).json({ message: "Invalid token structure" });
        }

        // Verify the token
        const jwtDecode = jwt.verify(token, secret);
        req.user = jwtDecode;
        next();
    } catch (error) {
        // If token is expired or invalid, try to end the session
        try {
            const decoded = jwt.decode(token);
            if (decoded && decoded.sessionId) {
                const session = await prisma.userSession.findUnique({ where: { id: Number(decoded.sessionId) } });
                if (session && !session.logoutAt) {
                    const logoutAt = new Date();
                    const durationSec = Math.round((logoutAt - session.loginAt) / 1000);
                    await prisma.userSession.update({
                        where: { id: session.id },
                        data: { logoutAt, durationSec },
                    });
                }
            }
        } catch (sessionError) {
            console.error('Error ending session:', sessionError.message);
        }

        return res.status(401).json({
            message: 'Unauthorized',
            detail: error.message
        });
    }
}

module.exports = authMiddleware;

module.exports = authMiddleware;