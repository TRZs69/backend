const {
	MAX_HISTORY_MESSAGES,
	MAX_HISTORY_CHARS_PER_MESSAGE,
} = require('./ChatbotConfig');

const normalizeChapterId = (chapterId) => {
	const parsed = Number(chapterId);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return null;
	}
	return Math.trunc(parsed);
};

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

const sanitizePromptText = (text, { limit } = {}) => {
	if (typeof text !== 'string') {
		return '';
	}
	const cleaned = text
		.replace(/[\u0000-\u001F\u007F]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	return truncateText(cleaned, limit);
};

const sanitizeContextText = (text) => {
	if (typeof text !== 'string') {
		return '';
	}
	return text
		.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
		.replace(/\r/g, '')
		.trim();
};

const stripTrailingEmptyOrderedListItems = (text) => {
	if (typeof text !== 'string' || !text.trim()) {
		return '';
	}

	const lines = text.split('\n');
	let end = lines.length - 1;

	while (end >= 0 && !String(lines[end]).trim()) {
		end -= 1;
	}

	while (end >= 0 && /^\s*\d+\s*[).:-]?\s*$/.test(String(lines[end]))) {
		end -= 1;
		while (end >= 0 && !String(lines[end]).trim()) {
			end -= 1;
		}
	}

	if (end < 0) {
		return '';
	}

	return lines.slice(0, end + 1).join('\n');
};

const hasUnpairedDoubleAsterisk = (line) => {
	const matches = String(line || '').match(/\*\*/g);
	return Boolean(matches) && matches.length % 2 === 1;
};

const isLikelyTruncatedTrailingListLine = (line) => {
	const trimmed = String(line || '').trim();
	if (!trimmed) {
		return false;
	}

	const listPrefixMatch = /^(\d+\s*[).:-]\s+|[-*]\s+)/.exec(trimmed);
	if (!listPrefixMatch) {
		return false;
	}

	const content = trimmed.slice(listPrefixMatch[0].length).trim();
	if (!content) {
		return true;
	}

	if (hasUnpairedDoubleAsterisk(content)) {
		return true;
	}

	const words = content.split(/\s+/).filter(Boolean);
	const looksLikeShortFragment = words.length === 1 && content.length <= 6 && !/[.!?:)]$/.test(content);
	return looksLikeShortFragment;
};

const stripTrailingTruncatedListItems = (text) => {
	if (typeof text !== 'string' || !text.trim()) {
		return '';
	}

	const lines = text.split('\n');
	let end = lines.length - 1;

	while (end >= 0 && !String(lines[end]).trim()) {
		end -= 1;
	}

	while (end >= 0 && isLikelyTruncatedTrailingListLine(lines[end])) {
		end -= 1;
		while (end >= 0 && !String(lines[end]).trim()) {
			end -= 1;
		}
	}

	if (end < 0) {
		return '';
	}

	return lines.slice(0, end + 1).join('\n');
};

const postProcessReply = (reply) => {
	if (typeof reply !== 'string') {
		return '';
	}

	let normalized = reply.replace(/\r/g, '').trim();

	// 1. Strip out thinking/thought blocks (e.g., <thought>...</thought>)
	normalized = normalized.replace(/<(thought|think)[^>]*>[\s\S]*?<\/\1>/gi, '').trim();
	normalized = normalized.replace(/<(thought|think)[^>]*>[\s\S]*/gi, '').trim();

	// 2. Aggressive Keyword-based Line Stripping
	const metaKeywords = [
		'User says', 'The user', 'Context', 'Reference Material', 'Assessment Data', 
		'System Instructions', 'Name:', 'Tone:', 'Language:', 'Pronouns:', 
		'Constraint', 'Goal:', 'Wait,', 'Greeting:', 'Thinking:', 
		'Analysis:', 'Instruction:', 'Route:', 'Persona:', 'Introduction:',
		'Call to Action:', 'Alignment:', 'Scenario:', 'Recap:', 'Engagement:'
	];

	const lines = normalized.split('\n');
	let firstCleanLineIndex = -1;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) continue;

		const lowerLine = line.toLowerCase();
		const isBullet = line.startsWith('•') || line.startsWith('*') || line.startsWith('-') || /^\d+\./.test(line);
		const hasKeyword = metaKeywords.some(k => lowerLine.includes(k.toLowerCase()));
		
		const isMeta = (isBullet && hasKeyword) || (hasKeyword && line.includes(':'));
		const isReasoning = lowerLine.startsWith('wait,') || 
						   lowerLine.startsWith('i need to') || 
						   lowerLine.startsWith('i should') ||
						   lowerLine.startsWith('i will');

		// Special case: if it's a bullet but contains a greeting, it's likely NOT meta anymore
		const hasGreeting = ['halo', 'hai', 'hi', 'selamat'].some(g => lowerLine.includes(g));
		
		if ((!isMeta && !isReasoning) || (isBullet && hasGreeting && !hasKeyword)) {
			firstCleanLineIndex = i;
			break;
		}
	}

	if (firstCleanLineIndex !== -1) {
		normalized = lines.slice(firstCleanLineIndex).join('\n').trim();
	} else {
		// If no clean line found, try splitting at greeting as last resort
		const splitMarkers = ['Halo', 'Hai', 'Hi', 'Selamat', 'Aku Levely', 'Levely:'];
		for (const marker of splitMarkers) {
			const index = normalized.indexOf(marker);
			if (index !== -1) {
				normalized = normalized.slice(index).trim();
				break;
			}
		}
	}

	// 3. Final cleanup of concatenated "•User says: ...•Context: ..." strings
	const keywordPattern = metaKeywords.map(k => k.replace(':', '')).join('|');
	const concatenatedRegex = new RegExp(`[•*\\-]\\s*(${keywordPattern})[\\s\\S]*?(?=[•*\\-]|$)`, 'gi');
	normalized = normalized.replace(concatenatedRegex, '').trim();

	normalized = stripTrailingEmptyOrderedListItems(normalized);
	normalized = stripTrailingTruncatedListItems(normalized);
	normalized = normalized.replace(/\n{3,}/g, '\n\n').trim();
	return normalized;
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

const normalizeHistory = (history = []) => {
	if (!Array.isArray(history)) {
		return [];
	}

	const normalized = history
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

	// Google AI API requires the first message to be from the 'user' role.
	// If slicing results in a leading assistant message, drop it.
	while (normalized.length > 0 && normalized[0].role === 'assistant') {
		normalized.shift();
	}

	return normalized;
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

module.exports = {
	normalizeChapterId,
	truncateText,
	sanitizePromptText,
	sanitizeContextText,
	stripTrailingEmptyOrderedListItems,
	hasUnpairedDoubleAsterisk,
	isLikelyTruncatedTrailingListLine,
	stripTrailingTruncatedListItems,
	postProcessReply,
	shouldIncludeImageContext,
	isFinitePositive,
	normalizeHistory,
	logChatPerformance,
};
