const { GeminiClient } = require('./GeminiClient');

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

const buildGeminiClient = () => {
	ensureGoogleCredentials();
	const apiKey = process.env.LEVELY_GEMINI_API_KEY;
	const model = process.env.LEVELY_GEMINI_MODEL || 'gemma-3-12b-it';
	const baseUrl = process.env.LEVELY_GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/models';
	const isVertex = baseUrl.includes('aiplatform.googleapis.com');

	if (!apiKey && !isVertex) {
		return null;
	}

	return new GeminiClient({ apiKey, model, baseUrl });
};

const llmClient = buildGeminiClient();

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

const formatReply = (text = '') => {
	if (typeof text !== 'string') {
		return '';
	}

	let output = text.replace(/\r\n/g, '\n');
	output = output.replace(/```([\s\S]*?)```/g, (_, block) => block.trim());
	output = output.replace(/`([^`]+)`/g, '$1');
	output = output.replace(/\*\*([^*]+)\*\*/g, '$1');
	output = output.replace(/__([^_]+)__/g, '$1');
	output = output.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).]|$)/g, '$1$2');
	output = output.replace(/(^|[\s(])_([^_\n]+)_(?=[\s).]|$)/g, '$1$2');

	output = output
		.split('\n')
		.map((line) => {
			const trimmed = line.trim();
			if (!trimmed) {
				return '';
			}
			if (/^[-*+]\s+/.test(trimmed)) {
				return `• ${trimmed.replace(/^[-*+]\s+/, '')}`;
			}
			return trimmed;
		})
		.join('\n');

	return output.replace(/\n{3,}/g, '\n\n').trim();
};

exports.sendMessage = async ({ message, history = [] }) => {
	const prompt = (message || '').trim();
	if (!prompt) {
		throw new Error('Message is required');
	}

	const fallback = 'Saat ini chatbot belum siap menjawab. Coba lagi nanti ya.';

	if (!llmClient) {
		return { reply: fallback };
	}

	const conversation = normalizeHistory(history);
	const messages = [...conversation, { role: 'user', content: prompt }];

	try {
		const reply = await llmClient.complete({
			system:
				'You are Levely, a friendly study buddy who explains concepts in Indonesian with warm encouragement, rich detail, and at least two short paragraphs unless the user explicitly asks for brevity.',
			messages,
		});

		if (!reply) {
			return { reply: fallback };
		}

		return { reply: formatReply(reply) };
	} catch (error) {
		const status = error?.response?.status;
		const body = error?.response?.data;
		if (status || body) {
			console.error('ChatbotService error:', status || error.message, body || '');
		} else {
			console.error('ChatbotService error:', error.message);
		}
		return { reply: fallback };
	}
};
