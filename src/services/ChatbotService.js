const { GoogleAIClient } = require('./GoogleAIClient');
const chatHistoryStore = require('./ChatHistoryRepository');
const samplingService = require('./SamplingService');
const {
	evaluatePreLlmSafetyGate,
	shouldSuppressAssessmentLeakReply,
	GUARDED_DIRECT_ANSWER_REPLY,
	resolveAssistantRoute,
} = require('./ChatbotGuardrails');
const {
	getFallbackReply,
	MAX_USER_PROMPT_CHARS,
	ENABLE_STREAM_TITLE_GENERATION,
} = require('./ChatbotConfig');
const {
	normalizeChapterId,
	sanitizePromptText,
	postProcessReply,
	logChatPerformance,
} = require('./ChatbotUtils');
const {
	SYSTEM_PROMPT,
	buildSystemPromptForRoute,
	pickGenerationSettings,
	buildTitlePrompt,
	cleanTitle,
} = require('./ChatbotMessageBuilder');
const { buildChatContext } = require('./ChatbotContextService');
const supabase = require('../../supabase/supabase');
const evaluationService = require('./EvaluationService');

const ensureGoogleCredentials = () => {
	if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return;
	const fallbackPath = process.env.LEVELY_GOOGLE_APPLICATION_CREDENTIALS || process.env.LEVELY_GOOGLE_APPLICATION_CREDENTIALS_PATH;
	if (fallbackPath) process.env.GOOGLE_APPLICATION_CREDENTIALS = fallbackPath;
};

const buildGoogleAIClient = () => {
	ensureGoogleCredentials();
	const apiKey = (process.env.GOOGLE_AI_API_KEY || '').trim();
	const model = process.env.LEVELY_LLM_MODEL;
	const baseUrl = process.env.LEVELY_LLM_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/models';
	const isVertex = baseUrl.includes('aiplatform.googleapis.com');
	if (!apiKey && !isVertex) return null;
	return new GoogleAIClient({ apiKey, model, baseUrl });
};

const llmClient = buildGoogleAIClient();
if (!llmClient) console.error('ChatbotService: LLM client not configured.');

const scheduleWarmup = () => {
	const intervalMs = Number(process.env.LEVELY_LLM_WARMUP_INTERVAL_MS);
	if (!llmClient || !Number.isFinite(intervalMs) || intervalMs <= 0) return;

	const customPrompts = (process.env.LEVELY_LLM_WARMUP_PROMPTS || '').split('|').map(p => p.trim()).filter(Boolean);
	const warmupPrompts = customPrompts.length ? customPrompts : ['Apa kabar Levely?', 'Kasih aku fakta sains singkat dong.'];

	const runWarmup = async () => {
		try {
			await llmClient.complete({
				system: SYSTEM_PROMPT,
				messages: [{ role: 'user', content: warmupPrompts[Math.floor(Math.random() * warmupPrompts.length)] }],
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

const logChatbotInteractionEvent = ({ userId, sessionId, storedMessages = [] }) => {
	const normalizedUserId = Number(userId);
	if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) return;
	if (!sessionId) return;
	if (!Array.isArray(storedMessages) || storedMessages.length === 0) return;

	const userMessages = storedMessages.filter((message) => message?.role === 'user');
	if (userMessages.length === 0) return;

	const assistantMessages = storedMessages.filter((message) => message?.role === 'assistant');
	const userMessageId = userMessages[userMessages.length - 1]?.id || null;
	const assistantMessageId = assistantMessages[assistantMessages.length - 1]?.id || null;
	const dedupeKey = userMessageId || assistantMessageId || Date.now();

	void evaluationService.recordActivityEvent({
		userId: normalizedUserId,
		eventName: evaluationService.EVENT_NAMES.CHATBOT_INTERACTION,
		chatSessionId: sessionId,
		metadata: {
			messages_total: storedMessages.length,
			user_messages: userMessages.length,
			assistant_messages: assistantMessages.length,
			user_message_id: userMessageId,
			assistant_message_id: assistantMessageId,
		},
		eventIdempotencyKey: `chatbot_interaction:${normalizedUserId}:${sessionId}:${dedupeKey}`,
		triggerRecompute: true,
	});
};

exports.sendMessage = async ({ message, history = [], sessionId, userId, materialId, chapterId }) => {
	const prompt = sanitizePromptText(message, { limit: MAX_USER_PROMPT_CHARS });
	if (!prompt) throw new Error('Message is required');

	const preLlmSafety = evaluatePreLlmSafetyGate({ prompt });
	if (preLlmSafety.blocked) return { reply: preLlmSafety.reply, sessionId };
	if (!llmClient) return { reply: getFallbackReply(), sessionId };

	const startedAt = Date.now();
	const { persistedSessionId, messages, hasMaterialContext, hasAssessmentContext, isContinuationRequest } =
		await buildChatContext({ history, sessionId, userId, prompt, materialId, chapterId });

	const assistantRoute = resolveAssistantRoute({ prompt });
	const isFirstMessage = messages.length <= 1;
	const effectiveSystemPrompt = buildSystemPromptForRoute({ route: assistantRoute, hasMaterialContext, isFirstMessage });
	const responseSettings = pickGenerationSettings(prompt, { forceDetailed: isContinuationRequest });

	try {
		const llmStartedAt = Date.now();
		const { text: rawReply, metadata: llmMetadata } = await llmClient.complete({
			system: effectiveSystemPrompt,
			messages,
			generationConfig: responseSettings.generationConfig,
		});

		const safeReply = shouldSuppressAssessmentLeakReply({ prompt, reply: rawReply, hasAssessmentContext }) ? GUARDED_DIRECT_ANSWER_REPLY : rawReply;
		const reply = postProcessReply(safeReply);

		logChatPerformance({ kind: 'non-stream', mode: responseSettings.mode, contextMs: llmStartedAt - startedAt, llmMs: Date.now() - llmStartedAt, totalMs: Date.now() - startedAt, replyChars: reply.length });

		if (!reply) return { reply: getFallbackReply(), sessionId: persistedSessionId };

		if (chatHistoryStore.isEnabled) {
			let activeSessionId = persistedSessionId;
			if (!activeSessionId) {
				activeSessionId = await chatHistoryStore.ensureSession({ userId, chapterId });
			}

				const storedMessages = await chatHistoryStore.appendMessages({
					sessionId: activeSessionId,
					messages: [
						{ role: 'user', content: prompt },
						{ role: 'assistant', content: reply, tokenCount: llmMetadata?.candidatesTokenCount || llmMetadata?.totalTokenCount, metadata: { route: assistantRoute, mode: responseSettings.mode } },
					],
				});
				logChatbotInteractionEvent({
					userId,
					sessionId: activeSessionId,
					storedMessages,
				});
				await maybeUpdateSessionTitle({ sessionId: activeSessionId });
				return {
					reply,
				sessionId: activeSessionId,
				userMessageId: storedMessages.find(m => m.role === 'user')?.id,
				assistantMessageId: storedMessages.find(m => m.role === 'assistant')?.id
			};
		}
		return { reply, sessionId: persistedSessionId };
	} catch (error) {
		console.error('ChatbotService error:', error.message);
		return { reply: getFallbackReply(), sessionId: persistedSessionId };
	}
};

exports.streamMessage = async ({ message, history = [], sessionId, userId, materialId, chapterId, onToken, abortSignal, isEdit = false, existingUserMessageId = null }) => {
	const prompt = sanitizePromptText(message, { limit: MAX_USER_PROMPT_CHARS });
	if (!prompt) throw new Error('Message is required');

	const emitChunk = (chunk) => onToken?.(chunk);
	const preLlmSafety = evaluatePreLlmSafetyGate({ prompt });
	if (preLlmSafety.blocked) {
		emitChunk(preLlmSafety.reply);
		return { reply: preLlmSafety.reply, sessionId };
	}
	if (!llmClient) {
		emitChunk(getFallbackReply());
		return { reply: getFallbackReply(), sessionId };
	}

	const startedAt = Date.now();
	const { persistedSessionId, messages, hasMaterialContext, hasAssessmentContext, isContinuationRequest } =
		await buildChatContext({ history, sessionId, userId, prompt, materialId, chapterId });

	// In edit mode, remove duplicate user prompt from history
	if (isEdit && messages.length >= 2 && messages[messages.length - 2].role === 'user') {
		messages.splice(messages.length - 2, 1);
	}

	const assistantRoute = resolveAssistantRoute({ prompt });
	const isFirstMessage = messages.length <= 1;
	const effectiveSystemPrompt = buildSystemPromptForRoute({ route: assistantRoute, hasMaterialContext, isFirstMessage });
	const responseSettings = pickGenerationSettings(prompt, { forceDetailed: isContinuationRequest });

	try {
		const shouldGenerateLiveTitle = ENABLE_STREAM_TITLE_GENERATION && chatHistoryStore.isEnabled && persistedSessionId && messages.length <= 3;
		emitChunk({ mode: responseSettings.mode });
		if (shouldGenerateLiveTitle) emitChunk({ sessionId: persistedSessionId });

		let reply = '', llmMetadata = {}, firstTokenMs;
		const llmStartedAt = Date.now();

		let isLeaking = false;
		let accumulatedText = '';
		const internalAbortController = new AbortController();
		if (abortSignal) {
			abortSignal.addEventListener('abort', () => internalAbortController.abort());
		}

		if (typeof llmClient.streamComplete === 'function') {
			try {
				let isThinking = false;
				const streamResult = await llmClient.streamComplete({
					system: effectiveSystemPrompt,
					messages,
					onChunk: (chunk) => {
						if (isLeaking) return;
						if (!firstTokenMs && chunk && String(chunk).trim()) firstTokenMs = Date.now() - startedAt;

						const previousAccumulated = accumulatedText;
						accumulatedText += chunk;

						let textToEmit = chunk;
						const lowerAccumulated = accumulatedText.toLowerCase();
						
						const lastThoughtOpen = Math.max(lowerAccumulated.lastIndexOf('<thought'), lowerAccumulated.lastIndexOf('<think'));
						const lastThoughtClose = Math.max(lowerAccumulated.lastIndexOf('</thought>'), lowerAccumulated.lastIndexOf('</think>'));

						const metaKeywords = [
							'user says', 'the user', 'user input', 'context provided', 'system instructions', 
							'reference material', 'assessment data', 'goal:', 
							'wait,', 'constraint', 'persona:', 'introduction:',
							'call to action:', 'alignment:', 'scenario:', 'recap:', 'engagement:',
							'i need to', 'i should', 'i will', 'i must', 'role:', 'behavior:',
							'format:', 'tone:', 'identity:', 'question:', 'system prompt',
							'core concept:', 'purpose:', 'rule:', 'emoji', 'criteria', 'checklist',
							'check:', 'step:', 'task:', 'plan:', 'reflection:', 'points:', 'badges:',
							'progress:', 'content:', 'status:', 'verification:', 'validation:'
						];

						const lines = accumulatedText.split('\n');
						const lastLine = lines[lines.length - 1].toLowerCase();
						const secondToLastLine = lines.length >= 2 ? lines[lines.length - 2].toLowerCase() : '';
						
						const isBullet = (l) => l.trim().startsWith('•') || l.trim().startsWith('*') || l.trim().startsWith('-') || /^\d+[).:-]/.test(l.trim());
						const hasGreeting = (l) => ['halo', 'hai', 'hi', 'selamat', 'aku levely'].some(g => l.includes(g));
						const isMetaBlock = (l) => metaKeywords.some(k => l.includes(k));
						
						// Verification pattern check: "Something? Yes"
						const isVerification = (l) => /[?]\s*(yes|no|done|n\/a)/i.test(l);
						
						const isLineTrulyMeta = (l) => {
							const trimmed = l.trim();
							if (!trimmed) return false;
							return (isBullet(l) || isMetaBlock(l) || isVerification(l)) && 
								   (!hasGreeting(l) || l.includes(':') || isVerification(l));
						};

						const isStartOfMessage = lines.length <= 40;
						const isMetaPhase = isStartOfMessage && (isLineTrulyMeta(lastLine) || isLineTrulyMeta(secondToLastLine));

						if ((lastThoughtOpen > lastThoughtClose) || isMetaPhase) {
							isThinking = true;
							return;
						} else if (isThinking) {
							isThinking = false;
							
							if (lastThoughtClose >= previousAccumulated.length) {
								const closeTagLength = lowerAccumulated.endsWith('</thought>') ? 10 : 8;
								textToEmit = accumulatedText.slice(lastThoughtClose + closeTagLength);
							} else {
								// Exited meta-block phase: find the first line that doesn't look like meta-commentary
								const firstCleanLineIndex = lines.findIndex((l, idx) => {
									const trimmed = l.trim().toLowerCase();
									if (!trimmed) return false;
									const isM = isBullet(trimmed) || metaKeywords.some(k => trimmed.includes(k)) || isVerification(trimmed);
									const hasG = ['halo', 'hai', 'hi', 'selamat', 'aku levely'].some(g => trimmed.includes(g));
									return (!isM) || (hasG && !trimmed.includes(':') && !isBullet(trimmed) && !isVerification(trimmed));
								});
								
								if (firstCleanLineIndex !== -1) {
									textToEmit = lines.slice(firstCleanLineIndex).join('\n');
								} else {
									return;
								}
							}
						}

						if (hasAssessmentContext && shouldSuppressAssessmentLeakReply({ prompt, reply: accumulatedText, hasAssessmentContext })) {
							isLeaking = true;
							internalAbortController.abort();
							emitChunk('\n\n' + GUARDED_DIRECT_ANSWER_REPLY);
						} else if (!isThinking && textToEmit) {
							emitChunk(textToEmit);
						}
					},
					abortSignal: internalAbortController.signal,
					generationConfig: responseSettings.generationConfig,
				});
				reply = streamResult.text;
				llmMetadata = streamResult.metadata;
			} catch (error) {
				if (isLeaking) {
					reply = accumulatedText;
				} else {
					throw error;
				}
			}
		} else {
			const completeResult = await llmClient.complete({ system: effectiveSystemPrompt, messages, generationConfig: responseSettings.generationConfig });
			reply = completeResult.text;
			llmMetadata = completeResult.metadata;

			const safeReply = shouldSuppressAssessmentLeakReply({ prompt, reply, hasAssessmentContext }) ? GUARDED_DIRECT_ANSWER_REPLY : reply;
			emitChunk(safeReply);
		}

		reply = shouldSuppressAssessmentLeakReply({ prompt, reply, hasAssessmentContext }) ? GUARDED_DIRECT_ANSWER_REPLY : reply;
		if (isLeaking) reply = GUARDED_DIRECT_ANSWER_REPLY;
		reply = postProcessReply(reply);

		logChatPerformance({ kind: 'stream', mode: responseSettings.mode, contextMs: llmStartedAt - startedAt, firstTokenMs, llmMs: Date.now() - llmStartedAt, totalMs: Date.now() - startedAt, replyChars: reply.length });

		if (!reply) {
			emitChunk(getFallbackReply());
			return { reply: getFallbackReply(), sessionId: persistedSessionId };
		}

		if (chatHistoryStore.isEnabled) {
			let activeSessionId = persistedSessionId;
			let isNewSession = false;
			if (!activeSessionId) {
				activeSessionId = await chatHistoryStore.ensureSession({ userId, chapterId });
				emitChunk({ sessionId: activeSessionId });
				isNewSession = true;
			}

			const messagesToAppend = [];
			if (!isEdit) {
				messagesToAppend.push({ role: 'user', content: prompt });
			}
			messagesToAppend.push({ role: 'assistant', content: reply, tokenCount: llmMetadata?.candidatesTokenCount || llmMetadata?.totalTokenCount, metadata: { route: assistantRoute, mode: responseSettings.mode } });

				const storedMessages = await chatHistoryStore.appendMessages({
					sessionId: activeSessionId,
					messages: messagesToAppend,
				});
				logChatbotInteractionEvent({
					userId,
					sessionId: activeSessionId,
					storedMessages,
				});
				if (shouldGenerateLiveTitle || (isNewSession && ENABLE_STREAM_TITLE_GENERATION)) {
					void generateSessionTitle({ sessionId: activeSessionId, messages: await chatHistoryStore.fetchMessages({ sessionId: activeSessionId, limit: 5 }), emitChunk });
				} else {
				await maybeUpdateSessionTitle({ sessionId: activeSessionId });
			}
			return {
				reply,
				sessionId: activeSessionId,
				userMessageId: isEdit ? existingUserMessageId : storedMessages.find(m => m.role === 'user')?.id,
				assistantMessageId: storedMessages.find(m => m.role === 'assistant')?.id
			};
		}
		return { reply, sessionId: persistedSessionId };
	} catch (error) {
		if (abortSignal?.aborted) throw error;
		console.error('ChatbotService stream error:', error.message);
		emitChunk(getFallbackReply());
		return { reply: getFallbackReply(), sessionId: persistedSessionId };
	}
};

const maybeUpdateSessionTitle = async ({ sessionId }) => {
	if (!chatHistoryStore.isEnabled || !llmClient || !sessionId) return;
	try {
		const messages = await chatHistoryStore.fetchMessages({ sessionId, limit: 5 });
		if (messages.length >= 2 && messages.length <= 4) {
			await generateSessionTitle({ sessionId, messages });
		}
	} catch (error) {
		console.error('maybeUpdateSessionTitle error:', error.message);
	}
};

const generateSessionTitle = async ({ sessionId, messages, emitChunk }) => {
	const titlePrompt = buildTitlePrompt(messages);
	try {
		let finalTitle = '';
		if (emitChunk && typeof llmClient.streamComplete === 'function') {
			const streamResult = await llmClient.streamComplete({
				messages: [{ role: 'user', content: titlePrompt }],
				onChunk: (chunk) => emitChunk({ titleDelta: chunk })
			});
			finalTitle = streamResult.text;
		} else {
			const completeResult = await llmClient.complete({
				messages: [{ role: 'user', content: titlePrompt }]
			});
			finalTitle = completeResult.text;
			if (emitChunk && finalTitle) {
				emitChunk({ titleDelta: finalTitle });
			}
		}

		if (finalTitle) {
			const sanitizedTitle = cleanTitle(finalTitle);
			await chatHistoryStore.renameSession({ sessionId, title: sanitizedTitle });
			if (emitChunk) {
				emitChunk({ title: sanitizedTitle });
			}
		}
	} catch (error) {
		console.error('generateSessionTitle error:', error.message);
	}
};

exports.editAndRegenerate = async ({ messageId, newMessage, sessionId, userId, materialId, chapterId, onToken, abortSignal }) => {
	if (!messageId || !newMessage) throw new Error('Message ID and new content are required');

	// 1. Truncate history and update content
	await chatHistoryStore.truncateAfterMessage({ sessionId, messageId });
	await chatHistoryStore.updateMessageContent({ messageId, content: newMessage });

	// 2. Pure streaming response
	return exports.streamMessage({
		message: newMessage,
		sessionId,
		userId,
		materialId,
		chapterId,
		onToken,
		abortSignal,
		isEdit: true,
		existingUserMessageId: messageId
	});
};

exports.createChatSession = async ({ userId, title, metadata, chapterId }) => {
	if (!chatHistoryStore.isEnabled) throw new Error('Chat history belum diaktifkan');
	return { session: await chatHistoryStore.createSession({ userId, title, metadata, chapterId: normalizeChapterId(chapterId) }) };
};

exports.listChatSessions = async ({ userId, chapterId, limit = 20, offset = 0 }) =>
	chatHistoryStore.isEnabled ? chatHistoryStore.listSessions({ userId, chapterId: normalizeChapterId(chapterId), limit, offset }) : [];

exports.renameChatSession = async ({ sessionId, title }) => {
	if (!chatHistoryStore.isEnabled) throw new Error('Chat history belum diaktifkan');
	if (!sessionId) throw new Error('SessionId is required');
	return chatHistoryStore.renameSession({ sessionId, title });
};

exports.getHistory = async ({ sessionId, limit = 100 }) => {
	const trimmedSessionId = (sessionId || '').trim();
	if (!trimmedSessionId) throw new Error('SessionId is required');
	return { sessionId: trimmedSessionId, messages: chatHistoryStore.isEnabled ? await chatHistoryStore.fetchMessages({ sessionId: trimmedSessionId, limit }) : [] };
};

exports.getHistoryByUser = async ({ userId, chapterId, limit = 100 }) => {
	if (userId === null || userId === undefined) throw new Error('UserId is required');
	const normalizedChapterId = normalizeChapterId(chapterId);
	if (!chatHistoryStore.isEnabled) return { sessionId: null, messages: [] };
	const sessionId = await chatHistoryStore.findLatestSessionForUser({ userId, chapterId: normalizedChapterId });
	return { sessionId, chapterId: normalizedChapterId, messages: sessionId ? await chatHistoryStore.fetchMessages({ sessionId, limit }) : [] };
};

exports.deleteSession = async ({ sessionId }) => {
	if (!sessionId?.trim()) throw new Error('SessionId is required');
	return chatHistoryStore.isEnabled ? chatHistoryStore.deleteSession({ sessionId: sessionId.trim() }) : { deleted: false };
};

exports.getUnratedPair = async ({ userId, chapterId }) => {
	const normalizedUserId = Number(userId);
	if (isNaN(normalizedUserId)) throw new Error('UserId is required and must be a number');
	const history = await this.getHistoryByUser({ userId: normalizedUserId, chapterId: normalizeChapterId(chapterId), limit: 100 });
	const messages = history.messages || [];
	if (messages.length < 2) return { message: 'Belum ada riwayat chat untuk dinilai.' };

	const { data: existingRatings } = await supabase.from('chatbot_ratings').select('user_request, bot_response').eq('user_id', normalizedUserId);
	const ratedPairs = new Set((existingRatings || []).map(r => `${r.user_request.trim().replace(/\s+/g, ' ')}|${r.bot_response.trim().replace(/\s+/g, ' ')}`));
	const samplePlan = await samplingService.getUserSamplePlan();
	if (existingRatings?.length >= (samplePlan.samplesPerUser || 1)) return { message: 'Terima kasih sudah merating Levely! 😊', limitReached: true };

	const unratedPairs = [];
	for (let i = messages.length - 1; i >= 1; i--) {
		if (messages[i].role === 'assistant' && messages[i - 1].role === 'user') {
			const pairKey = `${messages[i - 1].content.trim().replace(/\s+/g, ' ')}|${messages[i].content.trim().replace(/\s+/g, ' ')}`;
			if (!ratedPairs.has(pairKey)) unratedPairs.push({ userRequest: messages[i - 1].content, botResponse: messages[i].content });
		}
	}
	if (unratedPairs.length === 0) return { message: 'Terima kasih sudah merating Levely! 😊', allRated: true };
	return { ...unratedPairs[Math.floor(Math.random() * unratedPairs.length)], found: true, userSampleLimit: samplePlan.samplesPerUser || 1, alreadyRated: existingRatings ? existingRatings.length : 0 };
};

exports.saveRating = async ({ userId, userRequest, botResponse, rating, comment }) => {
	const { data, error } = await supabase.from('chatbot_ratings').insert([{ user_id: userId, user_request: userRequest.trim(), bot_response: botResponse.trim(), rating: Number(rating), comment: comment || null }]).select();
	if (error) throw new Error('Gagal menyimpan rating chatbot');
	return data?.[0] || null;
};

