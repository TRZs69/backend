const jwt = require('jsonwebtoken');
const prisma = require('../prismaClient');

async function evalAuthMiddleware(req, res, next) {
    // Try evaluation token first (from X-Eval-Token header or Authorization)
    let token = req.headers['x-eval-token'];
    let tokenSource = 'X-Eval-Token';

    // If no eval token header, try Authorization header
    if (!token) {
        token = req.headers['authorization']?.split(' ')[1];
        tokenSource = 'Authorization';
    }

    console.log(`[EvalAuth] Path: ${req.method} ${req.originalUrl}`);
    console.log(`[EvalAuth] Token source: ${tokenSource}, exists: ${!!token}`);

    if (!token) {
        console.log('[EvalAuth] 401: No token provided');
        return res.status(401).json({ message: "No token provided" });
    }

    const secret = process.env.JWT_SECRET;

    if (!secret) {
        console.log('[EvalAuth] 500: JWT secret is not set');
        return res.status(500).json({ message: "JWT secret is not set" });
    }

    try {
        const jwtDecode = jwt.verify(token, secret);
        console.log(`[EvalAuth] Token verified for user ID: ${jwtDecode.id}`);
        req.user = jwtDecode;
        next();
    } catch (error) {
        console.log(`[EvalAuth] 401: Token verification failed - ${error.message}`);
        return res.status(401).json({
            message: 'Unauthorized',
            detail: error.message
        });
    }
}

module.exports = evalAuthMiddleware;
