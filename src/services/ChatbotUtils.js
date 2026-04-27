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
