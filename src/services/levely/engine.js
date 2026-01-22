const { LevelyGamification } = require('./gamification');
const { LevelyRag } = require('./rag');
const { systemPrompt, contextPrompt } = require('./prompt');
const quizBank = require('./quizBank');
const { InMemoryLevelyProgressRepository } = require('./progressRepository');

class LevelyEngine {
	constructor({ llmClient = null, progressRepository } = {}) {
		this.llm = llmClient;
		this.progressRepository = progressRepository || new InMemoryLevelyProgressRepository();
	}

	async loadProgress(userId = 'default') {
		return this.progressRepository.load(userId);
	}

	async saveProgress(userId = 'default', progress) {
		return this.progressRepository.save(userId, progress);
	}

	nextQuestion({ progress, topic }) {
		const topicProgress = progress.topicOrDefault(topic);
		const candidates = quizBank.by(topic, topicProgress.currentDifficulty);
		if (!candidates.length) {
			const any = quizBank.allQuestions().filter((question) => question.topic === topic);
			if (!any.length) {
				throw new Error(`No quiz found for topic ${topic}`);
			}
			return any[Math.floor(Math.random() * any.length)];
		}
		return candidates[Math.floor(Math.random() * candidates.length)];
	}

	async submitAnswer({ userId = 'default', progress, question, selectedIndex, now = new Date() }) {
		const base = progress ?? (await this.loadProgress(userId));
		const isCorrect = selectedIndex === question.correctIndex;
		const result = LevelyGamification.applyQuizResult({
			progress: base,
			question,
			isCorrect,
			now,
		});
		await this.saveProgress(userId, result.progress);
		return result;
	}

	feedbackForQuiz({ question, selectedIndex, pointsDelta }) {
		const correct = selectedIndex === question.correctIndex;
		if (correct) {
			return `Jawaban kamu sudah benar. +${pointsDelta} poin.\n\n${question.explanation}`;
		}
		const chosen = question.choices[selectedIndex];
		const correctChoice = question.choices[question.correctIndex];
		return `Sepertinya kamu masih bingung. Jawaban kamu: "${chosen}".\nYang benar: "${correctChoice}". +${pointsDelta} poin.\n\n${question.explanation}\n\nMau coba contoh lain atau lanjut soal berikutnya?`;
	}

	recommendation(progress) {
		return LevelyGamification.buildRecommendation(progress);
	}

	async answerChat({
		userMessage,
		progress,
		courseId,
		level,
		chapterName,
		materialSnippet,
		history = [],
		userId = 'default',
	}) {
		const baseProgress = progress ?? (await this.loadProgress(userId));
		const system = systemPrompt({ appName: 'LeveLearn', assistantName: 'Levely', language: 'Indonesia' });
		const context = contextPrompt({
			courseId,
			level,
			chapterName,
			progress: baseProgress,
			materialSnippet,
		});

		const recent = history.slice(-10).map((message) => {
			const role = message.role
				? message.role
				: message.fromUser
					? 'user'
					: 'assistant';
			const content = message.content ?? message.text ?? '';
			return { role, content };
		});
		const messages = [...recent, { role: 'user', content: userMessage }];

		if (!this.llm) {
			return this.offlineAnswer(userMessage);
		}

		try {
			const reply = await this.llm.complete({ system, context, messages });
			if (!reply || !reply.trim()) {
				return this.offlineAnswer(userMessage);
			}
			return reply.trim();
		} catch (error) {
			// Log once the rest of the stack is in place.
			return this.offlineAnswer(userMessage);
		}
	}

	offlineAnswer(userMessage) {
		const lower = userMessage.toLowerCase();
		if (lower.includes('heuristik') || lower.includes('heuristics')) {
			return 'Heuristik adalah aturan praktis untuk mengevaluasi UI (misalnya Nielsen). Contohnya mencakup visibilitas status sistem, konsistensi, dan pencegahan error. Mau bahas prinsip tertentu atau contoh penerapannya?';
		}
		if (lower.includes('usability')) {
			return 'Usability adalah seberapa mudah dan efektif user mencapai tujuan. Biasanya diukur lewat efektivitas, efisiensi, dan kepuasan pengguna. Kamu mau bahas metrik seperti task success rate, waktu penyelesaian, atau error rate?';
		}
		return 'Aku bisa jawab dengan lebih detail, tapi butuh konteks tambahan. Jelaskan topik, tujuan, atau batasannya, lalu aku susun jawaban yang lebih lengkap. Jika ada contoh atau data, sertakan ya.';
	}
}

module.exports = {
	LevelyEngine,
};