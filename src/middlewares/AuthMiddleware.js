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
        next();
    } catch (error) {
        return res.status(401).json({
            message: 'Unauthorized',
            detail: error.message
        });
    }
}

module.exports = authMiddleware;

module.exports = authMiddleware;