const chatbotService = require('../services/ChatbotService');

exports.sendMessage = async (req, res) => {
  try {
    const { message, history, sessionId, deviceId, userId } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ message: 'Message is required' });
    }

    const result = await chatbotService.sendMessage({
      message,
      history,
      sessionId,
      deviceId,
      userId,
    });
    return res.status(200).json(result);
  } catch (error) {
    console.error('ChatbotController error:', error.message);
    return res.status(500).json({ message: 'Gagal memproses pesan chatbot' });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const result = await chatbotService.getHistory({ sessionId });
    return res.status(200).json(result);
  } catch (error) {
    console.error('ChatbotController history error:', error.message);
    return res.status(400).json({ message: error.message || 'Gagal mengambil riwayat chat' });
  }
};

exports.getHistoryByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await chatbotService.getHistoryByUser({ userId });
    return res.status(200).json(result);
  } catch (error) {
    console.error('ChatbotController history by user error:', error.message);
    return res.status(400).json({ message: error.message || 'Gagal mengambil riwayat chat' });
  }
};

exports.deleteSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const result = await chatbotService.deleteSession({ sessionId });
    return res.status(200).json(result);
  } catch (error) {
    console.error('ChatbotController delete error:', error.message);
    return res.status(400).json({ message: error.message || 'Gagal menghapus sesi chat' });
  }
};
