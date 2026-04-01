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

        // Sync to Supabase Live
        await evaluationService.syncSummaryToSupabase(req.user.id);

        res.json({ durationSec });
    } catch (err) {
        console.error('[EvaluationRouter] session/end:', err.message);
        res.sendStatus(503);
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
        if (err.code === 'P2025') {
            return res.status(404).json({ message: 'Session not found' });
        }
        console.error('[EvaluationRouter] session/heartbeat:', err.message);
        res.sendStatus(503);
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
        res.sendStatus(503);
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
        res.sendStatus(503);
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

        // Only return from Supabase if we have data for all students and no specific date range was requested
        // that might differ from what's stored. 
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
        res.sendStatus(503);
    }
});

router.post('/evaluation/questionnaire', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const { q1, q2, q3, q4, q5, q6, q7, q8 } = req.body;

    const values = [q1, q2, q3, q4, q5, q6, q7, q8];
    if (values.some((v) => !Number.isInteger(Number(v)) || Number(v) < 1 || Number(v) > 5)) {
        return res.status(400).json({ message: 'Each answer must be an integer 1-5' });
    }

    try {
        const existing = await prisma.evaluationQuestionnaire.findFirst({
            where: { userId },
        });
        if (existing) {
            return res.status(409).json({ message: 'Questionnaire already submitted' });
        }

        const record = await prisma.evaluationQuestionnaire.create({
            data: {
                userId,
                q1Autonomy:    Number(q1),
                q2Competence1: Number(q2),
                q3Competence2: Number(q3),
                q4Relatedness: Number(q4),
                q5Behavioral:  Number(q5),
                q6Cognitive:   Number(q6),
                q7Emotional:   Number(q7),
                q8Overall:     Number(q8),
            },
        });

        // Sync to Supabase Live
        await evaluationService.syncSummaryToSupabase(userId);

        res.status(201).json({ id: record.id, submittedAt: record.submittedAt });
    } catch (err) {
        console.error('[EvaluationRouter] questionnaire:', err.message);
        res.sendStatus(503);
    }
});

router.get('/evaluation/questionnaire/all', authMiddleware, async (req, res) => {
    const { role: callerRole } = req.user;
    if (callerRole !== 'INSTRUCTOR' && callerRole !== 'ADMIN') {
        return res.status(403).json({ message: 'Forbidden' });
    }

    try {
        const rows = await prisma.evaluationQuestionnaire.findMany({
            include: { user: { select: { name: true, studentId: true } } },
            orderBy: { submittedAt: 'asc' },
        });

        const result = rows.map((r) => ({
            id: r.id,
            userId: r.userId,
            studentId: r.user?.studentId,
            studentName: r.user?.name,
            submittedAt: r.submittedAt,
            q1Autonomy:    r.q1Autonomy,
            q2Competence1: r.q2Competence1,
            q3Competence2: r.q3Competence2,
            q4Relatedness: r.q4Relatedness,
            q5Behavioral:  r.q5Behavioral,
            q6Cognitive:   r.q6Cognitive,
            q7Emotional:   r.q7Emotional,
            q8Overall:     r.q8Overall,
            avgSDT: parseFloat(
                ((r.q1Autonomy + r.q2Competence1 + r.q3Competence2 + r.q4Relatedness) / 4).toFixed(2)
            ),
            avgEngagement: parseFloat(
                ((r.q5Behavioral + r.q6Cognitive + r.q7Emotional) / 3).toFixed(2)
            ),
        }));

        res.json({ total: result.length, responses: result });
    } catch (err) {
        console.error('[EvaluationRouter] questionnaire/all:', err.message);
        res.sendStatus(503);
    }
});

module.exports = router;
