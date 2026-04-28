const { EMOJI } = require('../misc/emojies.js');
const { parseBooleanEnv } = require('./ChatbotGuardrails');

const FALLBACK_REPLIES = [
	`Waduh, server Levely lagi antre panjang nih! Sambil nunggu, tahukah kamu kalau madu tidak pernah basi? Arkeolog pernah menemukan pot madu di makam Mesir kuno yang usianya 3.000 tahun dan masih bisa dimakan lho! Coba tanya aku lagi sebentar ya! ${EMOJI.warm_smile}`,
	`Serverku lagi penuh nih. Sambil nunggu, tahu nggak? Gurita punya 3 jantung dan darahnya berwarna biru! Keren kan? Yuk, coba kirim pertanyaanmu lagi dalam beberapa detik. 🐙`,
	`Sistem Levely lagi agak sibuk nih. Tahukah kamu? DNA manusia 50% mirip dengan pisang! Sambil mencerna fakta itu, coba kirim ulang pertanyaanmu ya! 🍌`,
	`Lagi ada antrean nih di serverku. Sambil nunggu, tahu nggak kalau sidik jari koala itu sangat mirip dengan sidik jari manusia? Coba tanyakan lagi sebentar lagi ya! 🐨`,
	`Waduh, Levely lagi kewalahan. Tahukah kamu? Luar angkasa itu benar-benar sunyi karena tidak ada udara untuk merambatkan suara. Coba tanya lagi dalam beberapa detik ya! 🚀`,
	`Server sedang padat merayap! Tahukah kamu? Siput bisa tidur selama tiga tahun non-stop lho! Daripada ikut ketiduran, coba tanya pertanyaanmu lagi bentar ya. 🐌`,
	`Sistemku lagi narik napas nih. Sambil nunggu, tahu nggak? Jerapah punya lidah berwarna biru kehitaman yang panjangnya bisa sampai 50 cm! 🦒`,
	`Antrean pesannya lagi panjang! Ngomong-ngomong, Bintang laut itu unik lho, mereka tidak punya otak dan juga tidak punya darah. Coba kirim pesannya lagi ya! ⭐`,
	`Lagi loading sebentar... Fakta unik nih: Manusia rata-rata memproduksi air liur yang cukup untuk mengisi dua kolam renang sepanjang hidupnya! 🏊`,
	`Levely lagi memproses data yang menumpuk! Tahukah kamu kalau Venus adalah satu-satunya planet di tata surya kita yang berputar searah jarum jam? 🪐`,
	`Waduh, koneksinya agak macet. Sambil nunggu, tahu nggak kalau jantung udang itu letaknya ada di kepalanya? 🦐`,
	`Server lagi butuh waktu nih. Tahukah kamu? Berlian bisa turun seperti hujan di planet Jupiter dan Saturnus karena tekanan yang sangat ekstrem! 💎`,
	`Sistem sedang sibuk! Sambil santai sejenak, tahu nggak kalau unta itu tidak bisa berjalan mundur? Coba kirim ulang pertanyaanmu ya! 🐪`,
	`Antrean sedang padat! Fakta keren: Lumba-lumba kalau tidur sebelah matanya tetap terbuka lho supaya tetap waspada. 🐬`,
	`Lagi proses sebentar ya! Ngomong-ngomong, burung unta punya ukuran mata yang lebih besar daripada ukuran otaknya lho! 👁️`,
	`Levely lagi agak lambat nih. Tahukah kamu secara botani, stroberi itu bukan kelompok buah beri, tapi pisang dan semangka justru iya! 🍓`,
	`Server lagi berat! Sambil nunggu, tahu nggak kalau satu awan putih yang kelihatan ringan di langit itu beratnya bisa mencapai 500 ton? ☁️`,
	`Lagi kewalahan sedikit! Fakta unik: Warna asli matahari dari luar angkasa sebenarnya putih lho, bukan kuning atau oranye. ☀️`,
	`Waduh, lagi ada penumpukan pesan. Tahukah kamu? Kuda laut jantan adalah yang mengandung dan melahirkan anak-anaknya, bukan betina! 🐎`,
	`Sistem sedang memulihkan diri! Sambil nunggu, tahu nggak kalau tulang paha manusia itu lebih kuat daripada beton? 💪`
];

const getFallbackReply = () => FALLBACK_REPLIES[Math.floor(Math.random() * FALLBACK_REPLIES.length)];

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
	getFallbackReply,
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
