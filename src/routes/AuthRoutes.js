const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../prismaClient.js')
const evaluationService = require('../services/EvaluationService');

const router = express.Router()

router.post('/register', async (req, res) => {
    const { username, password, name } = req.body

    const hashedPassword = bcrypt.hashSync(password, 8)

    try {
        const user = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                name,
                role: "STUDENT",
                studentId: null,
                points: 0,
                totalCourses: 0,
                badges: 0,
                instructorId: null,
                instructorCourses: null
            }
        })

        const expiresIn = 60 * 60 * 24 * 30;
        const token = jwt.sign(
            { id: user.id, name: user.name, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn }
        )

        res.status(201).json({
            data: {
                id: user.id,
                name: user.name,
                role: user.role,
            },
            token: token
        })
    } catch (err) {
        console.error('Register error:', err.message)
        res.status(500).json({ message: 'Failed to register user. ' + err.message })
    }
})

router.post('/login', async (req, res) => {

    const { username, password } = req.body

    if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" })
    }

    try {
        const user = await prisma.user.findUnique({
            where: {
                username: username
            }
        })

        if (!user) {
            return res.status(404).json({ message: "User not found" })
        }

        const passwordIsValid = await bcrypt.compareSync(password, user.password)

        if (!passwordIsValid) {
            return res.status(403).json({ message: "Invalid password" })
        }

        const payload = {
            id: user.id,
            name: user.name,
            role: user.role
        }

        const expiresIn = 60 * 60 * 24 * 30;
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: expiresIn })

        const session = await prisma.userSession.create({
            data: { userId: user.id }
        });

        
        void Promise.allSettled([
            evaluationService.recordActivityEvent({
                userId: user.id,
                eventName: evaluationService.EVENT_NAMES.USER_LOGIN,
                sessionId: session.id,
                metadata: { username },
                eventIdempotencyKey: `user_login:${user.id}:${session.id}`,
                triggerRecompute: true,
            }),
            evaluationService.recordActivityEvent({
                userId: user.id,
                eventName: evaluationService.EVENT_NAMES.SESSION_START,
                sessionId: session.id,
                metadata: { source: 'login' },
                eventIdempotencyKey: `session_start:${user.id}:${session.id}`,
                triggerRecompute: true,
            }),
        ]);

        res.json({
            data: {
                id: user.id,
                name: user.name,
                role: user.role,
                sessionId: session.id
            },
            token: token
        })
    } catch (err) {
        console.error('Login error:', err.message)
        res.status(500).json({ message: 'Internal server error during login' })
    }

})

router.post('/refresh-token', async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ message: 'Token required' });
    }

    const secret = process.env.JWT_SECRET;

    if (!secret) {
        return res.status(500).json({ message: 'JWT secret is not set' });
    }

    try {
        const payload = jwt.verify(token, secret);

        const expiresIn = 60 * 60 * 24 * 30;
        const newToken = jwt.sign(
            { id: payload.id, name: payload.name, role: payload.role },
            secret,
            { expiresIn: expiresIn }
        );

        return res.json({ token: newToken });
    } catch (err) {
        console.log(err.message);
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
});

module.exports = router;
