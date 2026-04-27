const { EMOJI } = require('../misc/emojies.js');
const { parseBooleanEnv } = require('./ChatbotGuardrails');

const FALLBACK_REPLY = `Saat ini Levely lagi kewalahan. Mohon coba lagi nanti ya. ${EMOJI.warm_smile}`;

const MAX_HISTORY_MESSAGES = Number(process.env.LEVELY_CHAT_MAX_HISTORY_MESSAGES || 10);
const MAX_HISTORY_CHARS_PER_MESSAGE = Number(process.env.LEVELY_CHAT_MAX_HISTORY_CHARS || 800);
const MAX_USER_CONTEXT_COURSES = Number(process.env.LEVELY_CHAT_MAX_USER_COURSES || 8);
const MAX_MATERIAL_CONTEXT_CHARS = Number(process.env.LEVELY_CHAT_MAX_MATERIAL_CONTEXT_CHARS || 4500);
const MAX_ASSESSMENT_CONTEXT_CHARS = Number(process.env.LEVELY_CHAT_MAX_ASSESSMENT_CONTEXT_CHARS || 2500);
const MAX_USER_PROMPT_CHARS = Number(process.env.LEVELY_CHAT_MAX_USER_PROMPT_CHARS || 2200);
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

module.exports = {
	FALLBACK_REPLY,
	MAX_HISTORY_MESSAGES,
	MAX_HISTORY_CHARS_PER_MESSAGE,
	MAX_USER_CONTEXT_COURSES,
	MAX_MATERIAL_CONTEXT_CHARS,
	MAX_ASSESSMENT_CONTEXT_CHARS,
	MAX_USER_PROMPT_CHARS,
	MAX_MATERIAL_IMAGES,
	IMAGE_DOWNLOAD_TIMEOUT_MS,
	ENABLE_STREAM_TITLE_GENERATION,
	ENABLE_ADAPTIVE_RESPONSE_MODE,
	FAST_MAX_OUTPUT_TOKENS,
	FAST_TEMPERATURE,
	FAST_TOP_P,
	DETAILED_MAX_OUTPUT_TOKENS,
	DETAILED_TEMPERATURE,
	DETAILED_TOP_P,
	DETAILED_KEYWORDS,
	FOLLOW_UP_KEYWORDS,
	SHORT_CONTINUATION_CUES,
	FOLLOW_UP_OVERLAP_THRESHOLD,
};
