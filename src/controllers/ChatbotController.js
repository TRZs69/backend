const chatbotService = require('../services/ChatbotService');

exports.sendMessage = async (req, res) => {
  try {
    const { message, history } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ message: 'Message is required' });
    }

    const result = await chatbotService.sendMessage({ message, history });
    return res.status(200).json(result);
  } catch (error) {
    console.error('ChatbotController error:', error.message);
    return res.status(500).json({ message: 'Gagal memproses pesan chatbot' });
  }
};
