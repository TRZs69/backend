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

	// 2. Scan and Strip Meta-Commentary (Line by Line)
	const metaKeywords = [
		'User says', 'The user', 'User input', 'Context', 'Reference Material', 
		'Assessment Data', 'System Instructions', 'Name:', 'Tone:', 'Language:', 
		'Pronouns:', 'Constraint', 'Goal:', 'Wait,', 'Greeting:', 'Thinking:', 
		'Analysis:', 'Instruction:', 'Route:', 'Persona:', 'Introduction:',
		'Call to Action:', 'Alignment:', 'Scenario:', 'Recap:', 'Engagement:',
		'I need to', 'I should', 'I will', 'I must', 'Plan:', 'Reflection:',
		'Role:', 'Behavior:', 'Format:', 'Tone:', 'Identity:', 'Question:',
		'System Prompt', 'Core Concept:', 'Purpose:', 'Rule:', 'Emoji', 'Criteria',
		'Checklist', 'Check:', 'Step:', 'Task:', 'Points:', 'Badges:', 'Progress:',
		'Content:', 'Status:', 'Verification:', 'Validation:'
	];

	let lines = normalized.split('\n');
	let firstCleanLineIndex = -1;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) continue;

		const lowerLine = line.toLowerCase();
		const isBullet = line.startsWith('•') || line.startsWith('*') || line.startsWith('-') || /^\d+[).:-]/.test(line);
		const isHeader = line.startsWith('#');
		const hasKeyword = metaKeywords.some(k => lowerLine.includes(k.toLowerCase()));
		
		// Pattern: "Something? Yes/No/Done"
		const isVerificationPattern = /^[^*•\-]*\? (yes|no|done|n\/a)/i.test(lowerLine);
		
		// General 'Key: Value' pattern detection
		const isKeyValuePattern = (isBullet || i < 15) && line.includes(':') && line.indexOf(':') < 50;

		const isMeta = (isBullet && hasKeyword) || (hasKeyword && line.includes(':')) || 
					  (isHeader && hasKeyword) || (isKeyValuePattern && hasKeyword) || 
					  isVerificationPattern;

		const isReasoning = lowerLine.startsWith('wait,') || 
						   lowerLine.startsWith('i need to') || 
						   lowerLine.startsWith('i should') ||
						   lowerLine.startsWith('i will') ||
						   lowerLine.startsWith('i must') ||
						   lowerLine.startsWith('analyzing') ||
						   lowerLine.startsWith('the user') ||
						   lowerLine.startsWith('his is the') ||
						   lowerLine.startsWith('let\'s');

		// Special case: numbered list item or bullet or header without a keyword at the start of response
		// is often a recap if it's in the first 5 lines and short
		const isEarlyListRecap = i < 5 && (isBullet || isHeader) && lowerLine.length < 150;

		const hasGreeting = ['halo', 'hai', 'hi', 'selamat', 'aku levely'].some(g => lowerLine.includes(g));

		// Conversation start markers - if we hit one, we stop stripping
		if (hasGreeting && !hasKeyword && !isBullet && !line.includes(':') && !isVerificationPattern) {
			firstCleanLineIndex = i;
			break;
		}

		if (!isMeta && !isReasoning && !isEarlyListRecap) {
			firstCleanLineIndex = i;
			break;
		}
	}

	if (firstCleanLineIndex !== -1) {
		normalized = lines.slice(firstCleanLineIndex).join('\n').trim();
	} else if (lines.length > 0) {
		// If we couldn't find a clean line, it might be a concatenated mess
		// Try a last-ditch effort to find where Levely actually starts talking
		const splitMarkers = ['Halo', 'Hai', 'Hi', 'Selamat', 'Aku Levely'];
		for (const marker of splitMarkers) {
			const index = normalized.indexOf(marker);
			if (index !== -1) {
				normalized = normalized.slice(index).trim();
				break;
			}
		}
	}

	// 3. Cleanup concatenated patterns that survived (e.g. •User: hi•Persona: Levely)
	const keywordPattern = metaKeywords.map(k => k.replace(/[:]/g, '')).join('|');
	const concatenatedRegex = new RegExp(`[•*\\-]\\s*(${keywordPattern})[\\s\\S]*?(?=[•*\\-]|Halo|Hai|Hi|Selamat|$)`, 'gi');
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
				? entry.content
				: '';
			if (!content) {
				return null;
			}
			return { role, content };
		})
		.filter(Boolean);

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
