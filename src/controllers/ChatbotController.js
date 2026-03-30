const chatbotService = require('../services/ChatbotService');

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
};

const detachListener = (emitter, event, handler) => {
  if (!emitter) {
    return;
  }
  if (typeof emitter.off === 'function') {
    emitter.off(event, handler);
  } else {
    emitter.removeListener(event, handler);
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { message, history, sessionId, deviceId, userId, materialId, chapterId } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ message: 'Message is required' });
    }

    const result = await chatbotService.sendMessage({
      message,
      history,
      sessionId,
      deviceId,
      userId,
      materialId,
      chapterId,
    });
    return res.status(200).json(result);
  } catch (error) {
    console.error('ChatbotController error:', error.message);
    return res.status(500).json({ message: 'Gagal memproses pesan chatbot' });
  }
};

exports.streamMessage = async (req, res) => {
  const { message, history, sessionId, deviceId, userId, materialId, chapterId } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ message: 'Message is required' });
  }

  res.writeHead(200, SSE_HEADERS);
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }
  if (typeof res.flush === 'function') {
    res.flush();
  }

  const sendEvent = (payload) => {
    if (res.writableEnded) {
      return;
    }
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  const abortController = new AbortController();
  const handleToken = (delta) => {
    if (!delta) {
      return;
    }
    if (typeof delta === 'object') {
      sendEvent(delta);
    } else {
      sendEvent({ delta });
    }
  };
  const handleClose = () => {
    abortController.abort();
  };

  res.on('close', handleClose);
  sendEvent({ status: 'started' });

  // Heartbeat to keep connection alive on Vercel/proxies
  const heartbeatInterval = setInterval(() => {
    if (!res.writableEnded) {
      res.write(': heartbeat\n\n');
      if (typeof res.flush === 'function') res.flush();
    }
  }, 5000);

  try {
    const result = await chatbotService.streamMessage({
      message,
      history,
      sessionId,
      deviceId,
      userId,
      materialId,
      chapterId,
      onToken: handleToken,
      abortSignal: abortController.signal,
    });
    sendEvent({ status: 'done', sessionId: result.sessionId, reply: result.reply });
  } catch (error) {
    console.error('ChatbotController stream error:', error.message);
    sendEvent({ error: 'Gagal memproses pesan chatbot' });
  } finally {
    clearInterval(heartbeatInterval);
    detachListener(res, 'close', handleClose);
    if (!res.writableEnded) {
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
};

exports.createSession = async (req, res) => {
  try {
    const { userId, deviceId, title, metadata, chapterId } = req.body || {};
    if (userId === undefined || userId === null) {
      return res.status(400).json({ message: 'UserId is required' });
    }
    const result = await chatbotService.createChatSession({
      userId,
      deviceId,
      title,
      metadata,
      chapterId,
    });
    return res.status(201).json(result);
  } catch (error) {
    console.error('ChatbotController create session error:', error.message);
    return res.status(400).json({ message: error.message || 'Gagal membuat sesi chat' });
  }
};

exports.listSessionsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit, offset, chapterId } = req.query;
    if (userId === undefined) {
      return res.status(400).json({ message: 'UserId is required' });
    }
    const parsedLimit = Number(limit) || 20;
    const parsedOffset = Number(offset) || 0;
    const sessions = await chatbotService.listChatSessions({
      userId: Number(userId),
      chapterId,
      limit: parsedLimit,
      offset: parsedOffset,
    });
    return res.status(200).json({ sessions });
  } catch (error) {
    console.error('ChatbotController list sessions error:', error.message);
    return res.status(400).json({ message: error.message || 'Gagal mengambil daftar sesi chat' });
  }
};

exports.renameSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { title } = req.body || {};
    if (!sessionId) {
      return res.status(400).json({ message: 'SessionId is required' });
    }
    const session = await chatbotService.renameChatSession({ sessionId, title });
    return res.status(200).json({ session });
  } catch (error) {
    console.error('ChatbotController rename session error:', error.message);
    return res.status(400).json({ message: error.message || 'Gagal mengganti judul sesi chat' });
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
    const { chapterId, limit } = req.query;
    const parsedLimit = Number(limit) || 100;
    const result = await chatbotService.getHistoryByUser({ userId, chapterId, limit: parsedLimit });
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
