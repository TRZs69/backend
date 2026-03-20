const { EMOJI } = require('../misc/emojies.js');
const { GoogleAIClient } = require('./GoogleAIClient');
const chatHistoryStore = require('./ChatHistoryRepository');
const prisma = require('../prismaClient');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const SYSTEM_PROMPT =
	'You are Levely, a friendly study buddy who explains concepts in Indonesian with warm encouragement, rich detail, and at least two short paragraphs unless the user explicitly asks for brevity.';
const FALLBACK_REPLY = `Saat ini Levely lagi kewalahan. Mohon coba lagi nanti ya. ${EMOJI.warm_smile}`;

const parseBooleanEnv = (value, defaultValue) => {
	if (value === undefined || value === null || value === '') {
		return defaultValue;
	}
	return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

const MAX_HISTORY_MESSAGES = Number(process.env.LEVELY_CHAT_MAX_HISTORY_MESSAGES || 10);
const MAX_HISTORY_CHARS_PER_MESSAGE = Number(process.env.LEVELY_CHAT_MAX_HISTORY_CHARS || 800);
const MAX_USER_CONTEXT_COURSES = Number(process.env.LEVELY_CHAT_MAX_USER_COURSES || 8);
const MAX_MATERIAL_CONTEXT_CHARS = Number(process.env.LEVELY_CHAT_MAX_MATERIAL_CONTEXT_CHARS || 4500);
const MAX_ASSESSMENT_CONTEXT_CHARS = Number(process.env.LEVELY_CHAT_MAX_ASSESSMENT_CONTEXT_CHARS || 2500);
const MAX_MATERIAL_IMAGES = Number(process.env.LEVELY_CHAT_MAX_MATERIAL_IMAGES || 2);
const IMAGE_DOWNLOAD_TIMEOUT_MS = Number(process.env.LEVELY_CHAT_IMAGE_DOWNLOAD_TIMEOUT_MS || 1500);
const ENABLE_STREAM_TITLE_GENERATION = parseBooleanEnv(
	process.env.LEVELY_CHAT_STREAM_TITLE_GENERATION,
	false,
);
const ENABLE_ADAPTIVE_RESPONSE_MODE = parseBooleanEnv(
	process.env.LEVELY_CHAT_ENABLE_ADAPTIVE_RESPONSE_MODE,
	true,
);

const FAST_MAX_OUTPUT_TOKENS = Number(process.env.LEVELY_CHAT_FAST_MAX_OUTPUT_TOKENS || 320);
const FAST_TEMPERATURE = Number(process.env.LEVELY_CHAT_FAST_TEMPERATURE || 0.25);
const FAST_TOP_P = Number(process.env.LEVELY_CHAT_FAST_TOP_P || 0.9);

const DETAILED_MAX_OUTPUT_TOKENS = Number(process.env.LEVELY_CHAT_DETAILED_MAX_OUTPUT_TOKENS || 900);
const DETAILED_TEMPERATURE = Number(process.env.LEVELY_CHAT_DETAILED_TEMPERATURE || 0.35);
const DETAILED_TOP_P = Number(process.env.LEVELY_CHAT_DETAILED_TOP_P || 0.95);
const DETAILED_KEYWORDS = (process.env.LEVELY_CHAT_DETAILED_KEYWORDS ||
	'detail|rinci|step by step|langkah|jelaskan panjang|contoh lengkap|mendalam|komprehensif|analisis')
	.split('|')
	.map((entry) => entry.trim().toLowerCase())
	.filter(Boolean);

const truncateText = (text, limit) => {
	if (typeof text !== 'string') {
		return '';
	}
	const normalized = text.trim();
	if (!Number.isFinite(limit) || limit <= 0 || normalized.length <= limit) {
		return normalized;
	}
	return `${normalized.slice(0, limit)} ...`;
};

const shouldIncludeImageContext = (prompt) => {
	const normalized = String(prompt || '').toLowerCase();
	if (!normalized) {
		return false;
	}
	const imageKeywords = [
		'gambar',
		'image',
		'diagram',
		'bagan',
		'chart',
		'grafik',
		'ilustrasi',
		'foto',
		'visual',
	];
	return imageKeywords.some((keyword) => normalized.includes(keyword));
};

const isFinitePositive = (value) => Number.isFinite(value) && value > 0;

const isDetailedPrompt = (prompt) => {
	const normalized = String(prompt || '').toLowerCase();
	if (!normalized) {
		return false;
	}
	return DETAILED_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

const pickGenerationSettings = (prompt) => {
	if (!ENABLE_ADAPTIVE_RESPONSE_MODE) {
		return { mode: 'default', generationConfig: null };
	}

	const detailed = isDetailedPrompt(prompt);
	const generationConfig = {};

	if (detailed) {
		if (isFinitePositive(DETAILED_MAX_OUTPUT_TOKENS)) {
			generationConfig.maxOutputTokens = DETAILED_MAX_OUTPUT_TOKENS;
		}
		if (Number.isFinite(DETAILED_TEMPERATURE)) {
			generationConfig.temperature = DETAILED_TEMPERATURE;
		}
		if (isFinitePositive(DETAILED_TOP_P) && DETAILED_TOP_P <= 1) {
			generationConfig.topP = DETAILED_TOP_P;
		}
		return {
			mode: 'detailed',
			generationConfig: Object.keys(generationConfig).length ? generationConfig : null,
		};
	}

	if (isFinitePositive(FAST_MAX_OUTPUT_TOKENS)) {
		generationConfig.maxOutputTokens = FAST_MAX_OUTPUT_TOKENS;
	}
	if (Number.isFinite(FAST_TEMPERATURE)) {
		generationConfig.temperature = FAST_TEMPERATURE;
	}
	if (isFinitePositive(FAST_TOP_P) && FAST_TOP_P <= 1) {
		generationConfig.topP = FAST_TOP_P;
	}

	return {
		mode: 'fast',
		generationConfig: Object.keys(generationConfig).length ? generationConfig : null,
	};
};

const logChatPerformance = ({
	kind,
	mode,
	contextMs,
	firstTokenMs,
	llmMs,
	totalMs,
	replyChars,
	error,
}) => {
	const parts = [
		`kind=${kind}`,
		`mode=${mode || 'unknown'}`,
		`contextMs=${contextMs}`,
		`llmMs=${llmMs}`,
		`totalMs=${totalMs}`,
		`replyChars=${replyChars}`,
	];

	if (firstTokenMs !== undefined && firstTokenMs !== null) {
		parts.push(`firstTokenMs=${firstTokenMs}`);
	}

	if (error) {
		parts.push(`error=${error}`);
	}

	console.log(`[ChatbotPerf] ${parts.join(' ')}`);
};

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
	const intervalMs = Number(process.env.LEVELY_LLM_WARMUP_INTERVAL_MS);
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

	setTimeout(runWarmup, Number(process.env.LEVELY_LLM_WARMUP_INITIAL_DELAY_MS));
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
				const coursesText = user.enrolledCourses
					.slice(0, Math.max(0, MAX_USER_CONTEXT_COURSES))
					.map((uc) => `- ${uc.course.name}: ${uc.progress}%`)
					.join('\n');
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
				where: { id: parseInt(materialId, 10) },
				include: { chapter: true } // Include chapter for assessment context
			});
			if (material) {
				if (material.content) {
					// preserve image tags by converting them to text descriptions
					let cleanContent = material.content.replace(/<img[^>]+src="([^">]+)"[^>]*>/g, ' [Image: $1] ');

					const includeImageContext = shouldIncludeImageContext(prompt);

					// Extract a small number of images and only when user asks visual questions.
					if (includeImageContext && MAX_MATERIAL_IMAGES > 0) {
						const imageRegex = /\[Image:\s*([^\]]+)\]/g;
						let match;
						let imageCount = 0;
						while ((match = imageRegex.exec(cleanContent)) !== null && imageCount < MAX_MATERIAL_IMAGES) {
							const imgPath = match[1];

							if (imgPath.startsWith('http')) {
								try {
									const response = await axios.get(imgPath, {
										responseType: 'arraybuffer',
										timeout: IMAGE_DOWNLOAD_TIMEOUT_MS,
									});
									const ext = path.extname(imgPath.split('?')[0]).toLowerCase();
									let mimeType = 'image/png';
									if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
									else if (ext === '.webp') mimeType = 'image/webp';
									else if (ext === '.gif') mimeType = 'image/gif';

									const base64Str = Buffer.from(response.data, 'binary').toString('base64');
									mediaContext.push({
										inlineData: {
											data: base64Str,
											mimeType,
										}
									});
									imageCount += 1;
								} catch (downloadError) {
									console.error('Failed to download image from', imgPath, downloadError.message);
								}
							} else {
								// Paths look like "asset:lib/assets/alurHCI.png" in the old seed
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
									imageCount += 1;
								}
							}
						}
					}

					// strip remaining HTML tags
					cleanContent = cleanContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
					cleanContent = truncateText(cleanContent, MAX_MATERIAL_CONTEXT_CHARS);
					contextualPrompt = `Konteks materi yang sedang dibaca:\nJudul: ${material.name}\nIsi Materi: ${cleanContent}\n\n${contextualPrompt}`;
				}

				// If we have a chapter, look up if user has assessment data for this chapter
				if (material.chapter && userId) {
					try {
						const userChapter = await prisma.userChapter.findFirst({
							where: {
								userId: parseInt(userId, 10),
								chapterId: material.chapter.id
							}
						});

						if (userChapter && userChapter.assessmentDone) {
							const assessment = await prisma.assessment.findFirst({
								where: { chapterId: material.chapter.id }
							});

							if (assessment) {
								let assessmentStats = `Informasi Kuis Bab "${material.chapter.name}":\n`;
								assessmentStats += `- Nilai: ${userChapter.assessmentGrade}\n`;

								if (userChapter.assessmentAnswer && Array.isArray(userChapter.assessmentAnswer)) {
									assessmentStats += `- Jawaban Siswa:\n`;
									userChapter.assessmentAnswer.forEach((ans, i) => {
										assessmentStats += `  ${i + 1}. ${ans}\n`;
									});
								}

								assessmentStats += `\nReferensi Soal & Kunci Jawaban Lengkap:\n`;
								if (assessment.questions) {
									assessmentStats += truncateText(
										JSON.stringify(assessment.questions, null, 2),
										MAX_ASSESSMENT_CONTEXT_CHARS,
									) + '\n';
								}

								contextualPrompt = `${assessmentStats}\n(Berdasarkan nilai kuis di atas, berikan evaluasi atau pujian yang relevan kepada pengguna jika ditanya atau jika sesuai konteks)\n\n${contextualPrompt}`;
							}
						}
					} catch (userChapterError) {
						console.error('ChatbotService fetch userChapter/assessment error:', userChapterError.message);
					}
				}
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
			const content = typeof entry.content === 'string'
				? truncateText(entry.content, MAX_HISTORY_CHARS_PER_MESSAGE)
				: '';
			if (!content) {
				return null;
			}
			return { role, content };
		})
		.filter(Boolean)
		.slice(-Math.max(1, MAX_HISTORY_MESSAGES));
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

	const startedAt = Date.now();
	const contextStartedAt = Date.now();
	const { persistedSessionId, messages } = await buildChatContext({
		history,
		sessionId,
		deviceId,
		userId,
		prompt,
		materialId,
	});
	const contextMs = Date.now() - contextStartedAt;
	const responseSettings = pickGenerationSettings(prompt);

	try {
		const llmStartedAt = Date.now();
		const reply = await llmClient.complete({
			system: SYSTEM_PROMPT,
			messages,
			generationConfig: responseSettings.generationConfig,
		});
		const llmMs = Date.now() - llmStartedAt;
		const totalMs = Date.now() - startedAt;
		logChatPerformance({
			kind: 'non-stream',
			mode: responseSettings.mode,
			contextMs,
			llmMs,
			totalMs,
			replyChars: reply.length,
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
		const totalMs = Date.now() - startedAt;
		logChatPerformance({
			kind: 'non-stream',
			mode: responseSettings.mode,
			contextMs,
			llmMs: totalMs - contextMs,
			totalMs,
			replyChars: 0,
			error: error.message,
		});
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

	const startedAt = Date.now();
	const contextStartedAt = Date.now();
	const { persistedSessionId, messages } = await buildChatContext({
		history,
		sessionId,
		deviceId,
		userId,
		prompt,
		materialId,
	});
	const contextMs = Date.now() - contextStartedAt;
	const responseSettings = pickGenerationSettings(prompt);

	try {
		let titlePromise = Promise.resolve();
		emitChunk({ mode: responseSettings.mode });
		if (ENABLE_STREAM_TITLE_GENERATION && chatHistoryStore.isEnabled && persistedSessionId && messages.length <= 3) {
			emitChunk({ sessionId: persistedSessionId });
			titlePromise = generateSessionTitleStream({ sessionId: persistedSessionId, messages, emitChunk });
		}

		let reply = '';
		if (typeof llmClient.streamComplete === 'function') {
			const llmStartedAt = Date.now();
			let firstTokenMs;
			reply = await llmClient.streamComplete({
				system: SYSTEM_PROMPT,
				messages,
				onChunk: (chunk) => {
					if (typeof firstTokenMs !== 'number' && chunk && String(chunk).trim()) {
						firstTokenMs = Date.now() - startedAt;
					}
					emitChunk(chunk);
				},
				abortSignal,
				generationConfig: responseSettings.generationConfig,
			});
			const llmMs = Date.now() - llmStartedAt;
			const totalMs = Date.now() - startedAt;
			logChatPerformance({
				kind: 'stream',
				mode: responseSettings.mode,
				contextMs,
				firstTokenMs,
				llmMs,
				totalMs,
				replyChars: reply.length,
			});
		} else {
			const llmStartedAt = Date.now();
			reply = await llmClient.complete({
				system: SYSTEM_PROMPT,
				messages,
				generationConfig: responseSettings.generationConfig,
			});
			emitChunk(reply);
			const llmMs = Date.now() - llmStartedAt;
			const totalMs = Date.now() - startedAt;
			logChatPerformance({
				kind: 'stream-fallback',
				mode: responseSettings.mode,
				contextMs,
				firstTokenMs: totalMs,
				llmMs,
				totalMs,
				replyChars: reply.length,
			});
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
			// When streaming, we run title generation concurrently instead of waiting till end
		}

		await titlePromise;
		return { reply, sessionId: persistedSessionId };
	} catch (error) {
		const totalMs = Date.now() - startedAt;
		logChatPerformance({
			kind: 'stream',
			mode: responseSettings.mode,
			contextMs,
			llmMs: totalMs - contextMs,
			totalMs,
			replyChars: 0,
			error: error.message,
		});
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

const generateSessionTitleStream = async ({ sessionId, messages, emitChunk }) => {
	const conversationText = messages
		.map((m) => `${m.role}: ${m.content}`)
		.join('\n')
		.slice(0, 2000);

	const titlePrompt = `
Buatkan judul pendek (maksimal 5 kata) yang menarik untuk percakapan berikut.
Langsung berikan judulnya saja tanpa tanda kutip.

Percakapan:
${conversationText}
	`.trim();

	try {
		let finalTitle = '';
		if (typeof llmClient.streamComplete === 'function') {
			finalTitle = await llmClient.streamComplete({
				messages: [{ role: 'user', content: titlePrompt }],
				onChunk: (chunk) => {
					emitChunk({ titleDelta: chunk });
				}
			});
		} else {
			finalTitle = await llmClient.complete({
				messages: [{ role: 'user', content: titlePrompt }],
			});
			if (finalTitle) {
				emitChunk({ titleDelta: finalTitle });
			}
		}

		if (finalTitle) {
			const cleanTitle = finalTitle.replace(/^["']|["']$/g, '').trim();
			await chatHistoryStore.renameSession({ sessionId, title: cleanTitle });
			emitChunk({ title: cleanTitle });
		}
	} catch (error) {
		console.error('generateSessionTitleStream error:', error.message);
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
