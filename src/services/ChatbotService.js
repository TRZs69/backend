const { GoogleAIClient } = require('./GoogleAIClient');
const chatHistoryStore = require('./ChatHistoryRepository');

const ensureGoogleCredentials = () => {
	if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
		return;
	}

	const fallbackPath =
		process.env.LEVELY_GOOGLE_APPLICATION_CREDENTIALS ||
		process.env.LEVELY_GOOGLE_APPLICATION_CREDENTIALS_PATH;

	if (fallbackPath) {
		process.env.GOOGLE_APPLICATION_CREDENTIALS = fallbackPath;
	}
};

const buildGoogleAIClient = () => {
	ensureGoogleCredentials();
	const apiKey = process.env.LEVELY_GEMINI_API_KEY;
	const model = process.env.LEVELY_GEMINI_MODEL || 'gemma-3-12b-it';
	const baseUrl = process.env.LEVELY_GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/models';
	const isVertex = baseUrl.includes('aiplatform.googleapis.com');

	if (!apiKey && !isVertex) {
		return null;
	}

	return new GoogleAIClient({ apiKey, model, baseUrl });
};

const llmClient = buildGoogleAIClient();

const normalizeHistory = (history = []) => {
	if (!Array.isArray(history)) {
		return [];
	}

	return history
		.map((entry) => {
			if (!entry || typeof entry !== 'object') {
				return null;
			}
			const role = entry.role === 'assistant' ? 'assistant' : 'user';
			const content = typeof entry.content === 'string' ? entry.content.trim() : '';
			if (!content) {
				return null;
			}
			return { role, content };
		})
		.filter(Boolean)
		.slice(-10);
};

exports.sendMessage = async ({ message, history = [], sessionId, deviceId, userId }) => {
	const prompt = (message || '').trim();
	if (!prompt) {
		throw new Error('Message is required');
	}

	const fallback = 'Saat ini chatbot belum siap menjawab. Coba lagi nanti ya.';

	if (!llmClient) {
		return { reply: fallback, sessionId };
	}

	let persistedSessionId = sessionId;
	let persistedConversation = [];
	const useProvidedHistory = Array.isArray(history) && history.length > 0;

	if (chatHistoryStore.isEnabled) {
		try {
			persistedSessionId = await chatHistoryStore.ensureSession({
				sessionId,
				userId,
				deviceId,
			});
			if (!useProvidedHistory && persistedSessionId) {
				const stored = await chatHistoryStore.fetchMessages({
					sessionId: persistedSessionId,
					limit: 20,
				});
				persistedConversation = stored.map((entry) => ({
					role: entry.role,
					content: entry.content,
				}));
			}
		} catch (error) {
			console.error('ChatbotService history error:', error.message);
		}
	}

	const baseHistory = useProvidedHistory ? history : persistedConversation;
	const conversation = normalizeHistory(baseHistory);
	const messages = [...conversation, { role: 'user', content: prompt }];

	try {
		const reply = await llmClient.complete({
			system:
				'You are Levely, a friendly study buddy who explains concepts in Indonesian with warm encouragement, rich detail, and at least two short paragraphs unless the user explicitly asks for brevity.',
			messages,
		});

		if (!reply) {
			return { reply: fallback, sessionId: persistedSessionId };
		}

		if (chatHistoryStore.isEnabled && persistedSessionId) {
			chatHistoryStore
				.appendMessages({
					sessionId: persistedSessionId,
					messages: [
						{ role: 'user', content: prompt },
						{ role: 'assistant', content: reply },
					],
				})
				.catch((error) => console.error('ChatbotService history persist error:', error.message));
		}

		return { reply, sessionId: persistedSessionId };
	} catch (error) {
		const status = error?.response?.status;
		const body = error?.response?.data;
		if (status || body) {
			console.error('ChatbotService error:', status || error.message, body || '');
		} else {
			console.error('ChatbotService error:', error.message);
		}
		return { reply: fallback, sessionId: persistedSessionId };
	}
};


exports.getHistory = async ({ sessionId, limit = 100 }) => {
	const trimmedSessionId = (sessionId || '').trim();
	if (!trimmedSessionId) {
		throw new Error('SessionId is required');
	}

	if (!chatHistoryStore.isEnabled) {
		return { sessionId: trimmedSessionId, messages: [] };
	}

	const messages = await chatHistoryStore.fetchMessages({
		sessionId: trimmedSessionId,
		limit,
	});

	return { sessionId: trimmedSessionId, messages };
};

exports.getHistoryByUser = async ({ userId, limit = 100 }) => {
	const normalizedUserId = userId ?? null;
	if (normalizedUserId === null || normalizedUserId === undefined) {
		throw new Error('UserId is required');
	}

	if (!chatHistoryStore.isEnabled) {
		return { sessionId: null, messages: [] };
	}

	const sessionId = await chatHistoryStore.findLatestSessionForUser({ userId: normalizedUserId });
	if (!sessionId) {
		return { sessionId: null, messages: [] };
	}

	const messages = await chatHistoryStore.fetchMessages({
		sessionId,
		limit,
	});

	return { sessionId, messages };
};

exports.deleteSession = async ({ sessionId }) => {
	const trimmedSessionId = (sessionId || '').trim();
	if (!trimmedSessionId) {
		throw new Error('SessionId is required');
	}

	if (!chatHistoryStore.isEnabled) {
		return { deleted: false };
	}

	return chatHistoryStore.deleteSession({ sessionId: trimmedSessionId });
};
