const express = require('express');
const prisma = require('../prismaClient.js');
const authMiddleware = require('../middlewares/AuthMiddleware.js');
const evaluationService = require('../services/EvaluationService');
const supabase = require('../../supabase/supabase.js');

const router = express.Router();

router.post('/evaluation/session/end', authMiddleware, async (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ message: 'sessionId required' });

    try {
        const session = await prisma.userSession.findUnique({ where: { id: Number(sessionId) } });
        if (!session || session.userId !== req.user.id) {
            return res.status(404).json({ message: 'Session not found' });
        }
        if (session.logoutAt) {
            return res.json({ message: 'Already ended' });
        }

        const logoutAt = new Date();
        const durationSec = Math.round((logoutAt - session.loginAt) / 1000);

        await prisma.userSession.update({
            where: { id: session.id },
            data: { logoutAt, durationSec },
        });

        await evaluationService.syncSummaryToSupabase(req.user.id);

        res.json({ durationSec });
    } catch (err) {
        console.error('[EvaluationRouter] session/end:', err.message);
        res.status(503).json({ message: 'Service temporarily unavailable' });
    }
});

router.post('/evaluation/session/heartbeat', authMiddleware, async (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ message: 'sessionId required' });

    try {
        await prisma.userSession.update({
            where: { id: Number(sessionId) },
            data: { lastActiveAt: new Date() },
        });
        res.sendStatus(204);
    } catch (err) {
        console.error('[EvaluationRouter] heartbeat error:', err.message);
        if (err.code === 'P2028' || err.message.includes('Too many connections')) {
            res.status(503).json({ message: 'Database temporarily unavailable due to high load' });
        } else {
            res.status(500).json({ message: 'Internal server error' });
        }
    }
});

router.get('/evaluation/summary', authMiddleware, async (req, res) => {
    const { role: callerRole } = req.user;
    if (callerRole !== 'INSTRUCTOR' && callerRole !== 'ADMIN') {
        return res.status(403).json({ message: 'Forbidden' });
    }

    const targetUserId = Number(req.query.userId);
    if (!targetUserId) return res.status(400).json({ message: 'userId required' });

    const { start, end } = evaluationService.toDateRange(req.query.startDate, req.query.endDate);
    
    try {
        const summary = await evaluationService.computeSummary(targetUserId, start, end);
        res.json({ source: 'computed', userId: targetUserId, ...summary });
    } catch (err) {
        console.error('[EvaluationRouter] summary:', err.message);
        res.status(503).json({ message: 'Service temporarily unavailable' });
    }
});

router.get('/evaluation/summary/me', authMiddleware, async (req, res) => {
    const { start, end } = evaluationService.toDateRange(req.query.startDate, req.query.endDate);
    try {
        const { data: storedSummary } = await supabase
            .from('student_summaries')
            .select('*')
            .eq('user_id', req.user.id)
            .single();

        if (storedSummary) {
            return res.json({ source: 'supabase', userId: req.user.id, ...storedSummary });
        }

        const summary = await evaluationService.computeSummary(req.user.id, start, end);
        res.json({ source: 'computed', userId: req.user.id, ...summary });
    } catch (err) {
        console.error('[EvaluationRouter] summary/me:', err.message);
        res.status(503).json({ message: 'Service temporarily unavailable' });
    }
});

router.get('/evaluation/summary/all', authMiddleware, async (req, res) => {
    const { role: callerRole } = req.user;
    if (callerRole !== 'INSTRUCTOR' && callerRole !== 'ADMIN') {
        return res.status(403).json({ message: 'Forbidden' });
    }

    const { start, end } = evaluationService.toDateRange(req.query.startDate, req.query.endDate);

    try {
        const students = await prisma.user.findMany({
            where: { role: 'STUDENT' },
            select: { id: true, name: true, studentId: true },
        });

        const { data: storedSummaries } = await supabase
            .from('student_summaries')
            .select('*');

        if (storedSummaries && storedSummaries.length === students.length && !req.query.startDate && !req.query.endDate) {
            return res.json({ source: 'supabase', summaries: storedSummaries });
        }

        const results = await Promise.all(
            students.map(async (s) => {
                const summary = await evaluationService.computeSummary(s.id, start, end);
                return { userId: s.id, name: s.name, studentId: s.studentId, ...summary };
            })
        );

        res.json({ source: 'computed', period: { start, end }, students: results });
    } catch (err) {
        console.error('[EvaluationRouter] summary/all:', err.message);
        res.status(503).json({ message: 'Service temporarily unavailable' });
    }
});

module.exports = router;
