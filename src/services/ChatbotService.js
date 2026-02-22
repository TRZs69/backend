const { EMOJI } = require('../misc/emojies.js');
const { GoogleAIClient } = require('./GoogleAIClient');
const chatHistoryStore = require('./ChatHistoryRepository');
const prisma = require('../prismaClient');
const fs = require('fs');
const path = require('path');

const SYSTEM_PROMPT =
	'You are Levely, a friendly study buddy who explains concepts in Indonesian with warm encouragement, rich detail, and at least two short paragraphs unless the user explicitly asks for brevity.';
const FALLBACK_REPLY = `Saat ini Levely lagi kewalahan. Mohon coba lagi nanti ya. ${EMOJI.warm_smile}`;

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

if (!llmClient) {
	console.error('ChatbotService: LLM client not configured. Ensure Gemini API key or Vertex credentials are set.');
}

const scheduleWarmup = () => {
	const intervalMs = Number(process.env.LEVELY_LLM_WARMUP_INTERVAL_MS || 300000);
	if (!llmClient || !Number.isFinite(intervalMs) || intervalMs <= 0) {
		return;
	}

	const legacyPrompt = (process.env.LEVELY_LLM_WARMUP_PROMPT || '').trim();
	const customPrompts = (process.env.LEVELY_LLM_WARMUP_PROMPTS || '')
		.split('|')
		.map((entry) => entry.trim())
		.filter(Boolean);
	if (legacyPrompt) {
		customPrompts.unshift(legacyPrompt);
	}
	const defaultPrompts = [
		'Apa kabar Levely?',
		'Kasih aku fakta sains singkat dong.',
		'Berikan motivasi belajar 1 kalimat.',
		'Apa tips belajar efektif hari ini?',
		'Bisa sapaan pembuka yang hangat?',
	];
	const warmupPrompts = customPrompts.length ? customPrompts : defaultPrompts;
	const pickWarmupPrompt = () => {
		const index = Math.floor(Math.random() * warmupPrompts.length);
		return warmupPrompts[index] || 'ping';
	};
	const runWarmup = async () => {
		try {
			await llmClient.complete({
				system: SYSTEM_PROMPT,
				messages: [{ role: 'user', content: pickWarmupPrompt() }],
			});
			console.log('[LLM warmup] success');
		} catch (error) {
			console.error('[LLM warmup] failed:', error.message);
		}
	};

	setTimeout(runWarmup, Number(process.env.LEVELY_LLM_WARMUP_INITIAL_DELAY_MS || 10000));
	setInterval(runWarmup, intervalMs);
};

scheduleWarmup();

const buildChatContext = async ({ history, sessionId, deviceId, userId, prompt, materialId }) => {
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

	let contextualPrompt = prompt;

	if (userId) {
		try {
			const user = await prisma.user.findUnique({
				where: { id: parseInt(userId, 10) },
				include: {
					enrolledCourses: { include: { course: true } },
					userBadges: true,
				},
			});
			if (user) {
				const coursesText = user.enrolledCourses.map((uc) => `- ${uc.course.name}: ${uc.progress}%`).join('\n');
				const badgesCount = user.userBadges.length;

				const userContext = `Info Pengguna Saat Ini:\n- Nama: ${user.name}\n- Poin: ${user.points}\n- Lencana: ${badgesCount}\n- Progres Belajar:\n${coursesText}\n\n`;
				contextualPrompt = userContext + contextualPrompt;
			}
		} catch (error) {
			console.error('ChatbotService fetch user history error:', error.message);
		}
	}

	let mediaContext = [];

	if (materialId) {
		try {
			const material = await prisma.material.findUnique({
				where: { id: parseInt(materialId, 10) }
			});
			if (material && material.content) {
				// preserve image tags by converting them to text descriptions
				let cleanContent = material.content.replace(/<img[^>]+src="([^">]+)"[^>]*>/g, ' [Image: $1] ');

				// Extract those images to convert to base64
				const imageRegex = /\[Image:\s*([^\]]+)\]/g;
				let match;
				while ((match = imageRegex.exec(cleanContent)) !== null) {
					const imgPath = match[1];
					// Paths look like "asset:lib/assets/alurHCI.png" in the seed
					let relativePath = imgPath.replace('asset:', '');
					// Resolve assuming backend is at c:/Projects/Levelearn/backend and Mobile is alongside it
					const absolutePath = path.resolve(__dirname, '../../../Mobile', relativePath);

					if (fs.existsSync(absolutePath)) {
						const ext = path.extname(absolutePath).toLowerCase();
						let mimeType = 'image/png';
						if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
						else if (ext === '.webp') mimeType = 'image/webp';

						const fileBuffer = fs.readFileSync(absolutePath);
						mediaContext.push({
							inlineData: {
								data: fileBuffer.toString('base64'),
								mimeType,
							}
						});
					}
				}

				// strip remaining HTML tags
				cleanContent = cleanContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
				contextualPrompt = `Konteks materi yang sedang dibaca:\nJudul: ${material.name}\nIsi Materi: ${cleanContent}\n\n${contextualPrompt}`;
			}
		} catch (error) {
			console.error('ChatbotService fetch material error:', error.message);
		}
	}

	const baseHistory = useProvidedHistory ? history : persistedConversation;
	const conversation = normalizeHistory(baseHistory);
	const messages = [...conversation, { role: 'user', content: contextualPrompt, media: mediaContext.length > 0 ? mediaContext : undefined }];

	return { persistedSessionId, messages };
};

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

exports.createChatSession = async ({ userId, deviceId, title, metadata }) => {
	if (!chatHistoryStore.isEnabled) {
		throw new Error('Chat history belum diaktifkan');
	}

	const session = await chatHistoryStore.createSession({
		userId,
		deviceId,
		title,
		metadata,
	});

	return { session };
};

exports.listChatSessions = async ({ userId, limit = 20, offset = 0 }) => {
	if (!chatHistoryStore.isEnabled) {
		return [];
	}
	return chatHistoryStore.listSessions({ userId, limit, offset });
};

exports.renameChatSession = async ({ sessionId, title }) => {
	if (!chatHistoryStore.isEnabled) {
		throw new Error('Chat history belum diaktifkan');
	}
	if (!sessionId) {
		throw new Error('SessionId is required');
	}
	return chatHistoryStore.renameSession({ sessionId, title });
};

exports.sendMessage = async ({ message, history = [], sessionId, deviceId, userId, materialId }) => {
	const prompt = (message || '').trim();
	if (!prompt) {
		throw new Error('Message is required');
	}

	if (!llmClient) {
		return { reply: FALLBACK_REPLY, sessionId };
	}

	const { persistedSessionId, messages } = await buildChatContext({
		history,
		sessionId,
		deviceId,
		userId,
		prompt,
		materialId,
	});

	try {
		const reply = await llmClient.complete({
			system: SYSTEM_PROMPT,
			messages,
		});

		if (!reply) {
			return { reply: FALLBACK_REPLY, sessionId: persistedSessionId };
		}

		if (chatHistoryStore.isEnabled && persistedSessionId) {
			await chatHistoryStore.appendMessages({
				sessionId: persistedSessionId,
				messages: [
					{ role: 'user', content: prompt },
					{ role: 'assistant', content: reply },
				],
			});
			await maybeUpdateSessionTitle({ sessionId: persistedSessionId });
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
		return { reply: FALLBACK_REPLY, sessionId: persistedSessionId };
	}
};

exports.streamMessage = async ({
	message,
	history = [],
	sessionId,
	deviceId,
	userId,
	materialId,
	onToken,
	abortSignal,
}) => {
	const prompt = (message || '').trim();
	if (!prompt) {
		throw new Error('Message is required');
	}

	const emitChunk = (chunk) => {
		if (!chunk || typeof onToken !== 'function') {
			return;
		}
		onToken(chunk);
	};

	if (!llmClient) {
		emitChunk(FALLBACK_REPLY);
		return { reply: FALLBACK_REPLY, sessionId };
	}

	const { persistedSessionId, messages } = await buildChatContext({
		history,
		sessionId,
		deviceId,
		userId,
		prompt,
		materialId,
	});

	try {
		let reply = '';
		if (typeof llmClient.streamComplete === 'function') {
			reply = await llmClient.streamComplete({
				system: SYSTEM_PROMPT,
				messages,
				onChunk: emitChunk,
				abortSignal,
			});
		} else {
			reply = await llmClient.complete({ system: SYSTEM_PROMPT, messages });
			emitChunk(reply);
		}

		if (!reply) {
			emitChunk(FALLBACK_REPLY);
			return { reply: FALLBACK_REPLY, sessionId: persistedSessionId };
		}

		if (chatHistoryStore.isEnabled && persistedSessionId) {
			await chatHistoryStore.appendMessages({
				sessionId: persistedSessionId,
				messages: [
					{ role: 'user', content: prompt },
					{ role: 'assistant', content: reply },
				],
			});
			await maybeUpdateSessionTitle({ sessionId: persistedSessionId });
		}

		return { reply, sessionId: persistedSessionId };
	} catch (error) {
		const status = error?.response?.status;
		const body = error?.response?.data;
		if (!abortSignal?.aborted) {
			if (status || body) {
				console.error('ChatbotService stream error:', status || error.message, body || '');
			} else {
				console.error('ChatbotService stream error:', error.message);
			}
			emitChunk(FALLBACK_REPLY);
			return { reply: FALLBACK_REPLY, sessionId: persistedSessionId };
		}
		throw error;
	}
};

const maybeUpdateSessionTitle = async ({ sessionId }) => {
	if (!chatHistoryStore.isEnabled || !llmClient || !sessionId) {
		return;
	}

	try {
		const messages = await chatHistoryStore.fetchMessages({ sessionId, limit: 5 });
		// Only generate title if it's the beginning of a conversation (e.g. <= 2 exchanges)
		// and the session likely doesn't have a custom title yet.
		// We'll trust the caller or check if the title is default/empty if we had access to session details here.
		// For now, let's just do it if we have 2-4 messages (1-2 turns).
		if (messages.length >= 2 && messages.length <= 4) {
			await generateSessionTitle({ sessionId, messages });
		}
	} catch (error) {
		console.error('maybeUpdateSessionTitle error:', error.message);
	}
};

const generateSessionTitle = async ({ sessionId, messages }) => {
	const conversationText = messages
		.map((m) => `${m.role}: ${m.content}`)
		.join('\n')
		.slice(0, 2000); // Limit context

	const titlePrompt = `
Buatkan judul pendek (maksimal 5 kata) yang menarik untuk percakapan berikut.
Langsung berikan judulnya saja tanpa tanda kutip.

Percakapan:
${conversationText}
	`.trim();

	try {
		const title = await llmClient.complete({
			messages: [{ role: 'user', content: titlePrompt }],
		});

		if (title) {
			const cleanTitle = title.replace(/^["']|["']$/g, '').trim();
			await chatHistoryStore.renameSession({ sessionId, title: cleanTitle });
		}
	} catch (error) {
		console.error('generateSessionTitle error:', error.message);
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
