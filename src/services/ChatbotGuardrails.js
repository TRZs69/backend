const parseBooleanEnv = (value, defaultValue) => {
	if (value === undefined || value === null || value === '') {
		return defaultValue;
	}
	return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

const DETAILED_KEYWORDS = (process.env.LEVELY_CHAT_DETAILED_KEYWORDS ||
	'detail|rinci|step by step|langkah|jelaskan panjang|contoh lengkap|mendalam|komprehensif|analisis')
	.split('|')
	.map((entry) => entry.trim().toLowerCase())
	.filter(Boolean);

const FOLLOW_UP_KEYWORDS = (process.env.LEVELY_CHAT_FOLLOW_UP_KEYWORDS ||
	'lanjut|lanjutin|jelaskan lagi|detail|lebih detail|rinci|contoh|bagian ini|materi ini')
	.split('|')
	.map((entry) => entry.trim().toLowerCase())
	.filter(Boolean);

const SHORT_CONTINUATION_CUES = (process.env.LEVELY_CHAT_SHORT_CONTINUATION_CUES ||
	'boleh|lanjut|lanjutkan|oke|ok|terus|gas')
	.split('|')
	.map((entry) => String(entry || '').trim().toLowerCase())
	.filter(Boolean);

const FOLLOW_UP_OVERLAP_THRESHOLD = Number(process.env.LEVELY_CHAT_FOLLOW_UP_OVERLAP_THRESHOLD || 0.5);

const normalizeIntentText = (text) => {
	return String(text || '')
		.toLowerCase()
		.replace(/0/g, 'o')
		.replace(/1/g, 'i')
		.replace(/3/g, 'e')
		.replace(/4/g, 'a')
		.replace(/5/g, 's')
		.replace(/7/g, 't')
		.replace(/[^a-z\s]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
};

const toWordSet = (text) => {
	const normalized = normalizeIntentText(text);
	if (!normalized) {
		return new Set();
	}
	return new Set(
		normalized
			.split(' ')
			.filter((token) => token && token.length >= 3),
	);
};

const overlapScore = (leftText, rightText) => {
	const left = toWordSet(leftText);
	const right = toWordSet(rightText);
	if (!left.size || !right.size) {
		return 0;
	}

	let intersection = 0;
	for (const token of left) {
		if (right.has(token)) {
			intersection += 1;
		}
	}

	return intersection / Math.max(left.size, right.size);
};

const isDetailedPrompt = (prompt) => {
	const normalized = normalizeIntentText(prompt);
	if (!normalized) {
		return false;
	}
	return DETAILED_KEYWORDS
		.map((keyword) => normalizeIntentText(keyword))
		.some((keyword) => keyword && normalized.includes(keyword));
};

const isShortContinuationCue = (prompt) => {
	const normalizedPrompt = normalizeIntentText(prompt);
	if (!normalizedPrompt) {
		return false;
	}

	const tokenCount = normalizedPrompt.split(' ').filter(Boolean).length;
	if (tokenCount > 3) {
		return false;
	}

	return SHORT_CONTINUATION_CUES
		.map((cue) => normalizeIntentText(cue))
		.some((cue) => cue && normalizedPrompt === cue);
};

const shouldForceContinuation = ({ prompt, conversation }) => {
	if (!Array.isArray(conversation) || !conversation.length) {
		return false;
	}

	const lastAssistant = [...conversation].reverse().find((item) => item.role === 'assistant');
	if (!lastAssistant || !lastAssistant.content) {
		return false;
	}

	const normalizedPrompt = normalizeIntentText(prompt);
	if (!normalizedPrompt) {
		return false;
	}

	const hasFollowUpKeyword = FOLLOW_UP_KEYWORDS
		.map((keyword) => normalizeIntentText(keyword))
		.some((keyword) => keyword && normalizedPrompt.includes(keyword));

	const lastUser = [...conversation].reverse().find((item) => item.role === 'user');
	const similarity = lastUser ? overlapScore(lastUser.content, normalizedPrompt) : 0;
	const shortContinuationCue = isShortContinuationCue(prompt);

	return hasFollowUpKeyword || shortContinuationCue || similarity >= FOLLOW_UP_OVERLAP_THRESHOLD;
};

const DIRECT_ANSWER_HINTS = [
	'kunci jawaban',
	'jawaban final',
	'jawaban aja',
	'jawaban saja',
	'langsung jawab',
	'answer only',
	'just answer',
	'final answer',
	'tanpa penjelasan',
	'pilihan yang benar',
	'opsi benar',
	'hurufnya aja',
	'hurufnya saja',
	'kasih jawaban',
];

const DIRECT_ANSWER_REGEXES = [
	/jawaban\s+(benar|final|langsung|lansung|aja|saja|mana|what|correct|right)/i,
	/\b(final|correct|right)\s+(answer|jawaban)\b/i,
	/\b(answer|jawaban)\s+(only|aja|saja|doang)\b/i,
];

const GRADED_CONTEXT_HINTS = [
	'kuis',
	'quiz',
	'assessment',
	'ujian',
	'exam',
	'uts',
	'uas',
	'midterm',
	'final exam',
	'final test',
	'tryout',
	'tugas',
	'assignment',
	'soal',
];

const PROMPT_INJECTION_HINTS = [
	'ignore previous instruction',
	'ignore all instruction',
	'ignore system instruction',
	'abaikan instruksi sebelumnya',
	'abaikan semua instruksi',
	'lupakan instruksi sebelumnya',
	'jailbreak',
	'developer mode',
	'dev mode',
	'show system prompt',
	'reveal system prompt',
	'bocorkan system prompt',
	'tampilkan system prompt',
	'forget instructions',
	'bypass safety',
	'disable safety',
	'pretend you are',
	'role play as',
];

const PROMPT_INJECTION_REGEXES = [
	/ignore\s+(all\s+|any\s+|the\s+)?(previous\s+)?(instructions?|rules?|system)/i,
	/abaikan\s+(semua\s+)?(instruksi|aturan|sistem|system)/i,
	/(show|reveal|print|display|bocorkan|tampilkan).{0,30}(system\s*prompts?|prompts?\s*sistem)/i,
	/(jailbreak|dev\s*mode|developer\s*mode)/i,
	/forget\s+(all\s+)?(instructions?|rules?|system)/i,
];

const COMPACT_PROMPT_INJECTION_HINTS = [
	'jailbreak',
	'devmode',
	'developermode',
	'ignoreinstructions',
	'ignorerules',
	'ignoresystem',
	'showsystemprompt',
	'revealsystemprompt',
	'forgetsystem',
	'bypasssafety',
	'disablesafety',
];

const ASSESSMENT_LEAK_REGEXES = [
	/(kunci\s*jawaban|jawaban\s*final|jawaban\s*benar)/i,
	/(^|\n)\s*\d+\s*[).:-]\s*[a-e]\b/i,
	/(^|\s)([a-e]\s*[,;]\s*){2,}[a-e](\s|$)/i,
];

const GUARDED_DIRECT_ANSWER_REPLY =
	'Aku tidak bisa memberikan jawaban final langsung untuk kuis, assessment, atau tugas yang dinilai. Tapi aku bisa bantu dengan petunjuk langkah demi langkah, membahas konsep inti, dan mengecek jawabanmu setelah kamu mencoba dulu.';

const GUARDED_PROMPT_INJECTION_REPLY =
	'Aku tidak bisa mengikuti permintaan untuk mengabaikan aturan sistem atau membocorkan instruksi internal. Kalau kamu mau, aku bisa langsung bantu materi belajarmu atau menjawab pertanyaan konsep yang kamu butuhkan.';

const normalizedIncludesAny = (text, hints) => {
	const normalizedText = normalizeIntentText(text);
	if (!normalizedText) {
		return false;
	}
	return hints
		.map((hint) => normalizeIntentText(hint))
		.some((hint) => hint && normalizedText.includes(hint));
};

const hasGradedContextHint = (prompt) => normalizedIncludesAny(prompt, GRADED_CONTEXT_HINTS);

const hasDirectAnswerHint = (prompt) => {
	const lowerPrompt = String(prompt || '').toLowerCase();
	if (!lowerPrompt) {
		return false;
	}
	if (DIRECT_ANSWER_HINTS.some((hint) => lowerPrompt.includes(hint))) {
		return true;
	}
	return normalizedIncludesAny(prompt, DIRECT_ANSWER_HINTS);
};

const hasDirectAnswerWithRegex = (prompt) => {
	const lowerPrompt = String(prompt || '').toLowerCase();
	if (!lowerPrompt) {
		return false;
	}
	if (hasDirectAnswerHint(prompt)) {
		return true;
	}
	if (DIRECT_ANSWER_REGEXES && DIRECT_ANSWER_REGEXES.some((pattern) => pattern.test(lowerPrompt))) {
		return true;
	}
	return false;
};

const shouldBlockDirectGradedAnswers = (prompt) => {
	return hasDirectAnswerWithRegex(prompt) && hasGradedContextHint(prompt);
};

const shouldBlockPromptInjectionAttempt = (prompt) => {
	if (normalizedIncludesAny(prompt, PROMPT_INJECTION_HINTS)) {
		return true;
	}
	const compactPrompt = normalizeIntentText(prompt).replace(/\s+/g, '');
	if (compactPrompt) {
		const hasCompactInjectionHint = COMPACT_PROMPT_INJECTION_HINTS
			.map((hint) => normalizeIntentText(hint).replace(/\s+/g, ''))
			.some((hint) => hint && compactPrompt.includes(hint));
		if (hasCompactInjectionHint) {
			return true;
		}
	}
	const rawPrompt = String(prompt || '');
	return PROMPT_INJECTION_REGEXES.some((pattern) => pattern.test(rawPrompt));
};

const evaluatePreLlmSafetyGate = ({ prompt }) => {
	if (shouldBlockPromptInjectionAttempt(prompt)) {
		return { blocked: true, reason: 'prompt_injection', reply: GUARDED_PROMPT_INJECTION_REPLY };
	}
	if (shouldBlockDirectGradedAnswers(prompt)) {
		return { blocked: true, reason: 'direct_graded_answer', reply: GUARDED_DIRECT_ANSWER_REPLY };
	}
	return { blocked: false, reason: 'none', reply: null };
};

const shouldSuppressAssessmentLeakReply = ({ reply, hasAssessmentContext }) => {
	if (!hasAssessmentContext || !reply) {
		return false;
	}
	return ASSESSMENT_LEAK_REGEXES.some((pattern) => pattern.test(reply));
};

const COACHING_MODE_HINTS = [
	'jelaskan',
	'bagaimana',
	'kenapa',
	'mengapa',
	'bingung',
	'belum paham',
	'bantu',
	'latihan',
	'contoh',
	'step by step',
	'langkah',
	'tips belajar',
];

const resolveAssistantRoute = ({ prompt }) => {
	const normalized = normalizeIntentText(prompt);
	if (!normalized) {
		return 'normal_qa';
	}
	const isCoaching = COACHING_MODE_HINTS
		.map((hint) => normalizeIntentText(hint))
		.some((hint) => hint && normalized.includes(hint));

	return isCoaching ? 'coaching_mode' : 'normal_qa';
};

module.exports = {
	normalizeIntentText,
	evaluatePreLlmSafetyGate,
	shouldSuppressAssessmentLeakReply,
	GUARDED_DIRECT_ANSWER_REPLY,
	GUARDED_PROMPT_INJECTION_REPLY,
	isDetailedPrompt,
	shouldForceContinuation,
	resolveAssistantRoute,
    parseBooleanEnv,
};
