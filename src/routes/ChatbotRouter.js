const express = require('express');
const ChatbotController = require('../controllers/ChatbotController');

const router = express.Router();

router.post('/chat', ChatbotController.sendMessage);

module.exports = router;
