const express = require('express');
const ChatbotController = require('../controllers/ChatbotController');

const router = express.Router();

router.post('/chat', ChatbotController.sendMessage);
router.post('/chat/stream', ChatbotController.streamMessage);
router.post('/chat/session', ChatbotController.createSession);
router.patch('/chat/session/:sessionId', ChatbotController.renameSession);
router.get('/chat/history/user/:userId', ChatbotController.getHistoryByUser);
router.get('/chat/history/:sessionId', ChatbotController.getHistory);
router.get('/chat/session/user/:userId', ChatbotController.listSessionsByUser);
router.delete('/chat/session/:sessionId', ChatbotController.deleteSession);

module.exports = router;
