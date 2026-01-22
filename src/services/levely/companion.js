const { LevelyEngine } = require('./engine');
const { GeminiApiClient } = require('./llmClient');
const { resolveLevelyLlmConfig } = require('./config');
const { LevelyGamification } = require('./gamification');
const { LevelyRag } = require('./rag');
const {
  LevelyLearningEvent,
  LevelyLearningEventType,
  LevelyTrendPoint,
  QuizDifficulty,
} = require('./models');

class LevelyCompanionObservation {
  constructor({ before, after, event, pointsDelta = null, newlyUnlocked = [] }) {
    this.before = before;
    this.after = after;
    this.event = event;
    this.pointsDelta = pointsDelta;
    this.newlyUnlocked = newlyUnlocked;
  }
}

class LevelyCompanionAutoFeedback {
  constructor({ progress, event, pointsDelta = null, newlyUnlocked = [], feedback }) {
    this.progress = progress;
    this.event = event;
    this.pointsDelta = pointsDelta;
    this.newlyUnlocked = newlyUnlocked;
    this.feedback = feedback;
  }
}

class LevelyCompanionObserver {
  constructor() {
    this.maxHistory = 30;
    this.maxTrend = 12;
  }

  observeQuiz({ progress, question, selectedIndex, now }) {
    const before = progress;
    const result = LevelyGamification.applyQuizResult({
      progress,
      question,
      isCorrect: selectedIndex === question.correctIndex,
      now,
    });

    const event = new LevelyLearningEvent({
      type: LevelyLearningEventType.QUIZ,
      topic: question.topic,
      correct: selectedIndex === question.correctIndex ? 1 : 0,
      attempted: 1,
      at: now,
    });

    const trendValue = result.progress.topicOrDefault(question.topic).accuracy * 100;
    const updated = this.withHistoryAndTrend(result.progress, event, { trendValue, now });

    return new LevelyCompanionObservation({
      before,
      after: updated,
      event,
      pointsDelta: result.pointsDelta,
      newlyUnlocked: result.newlyUnlocked,
    });
  }

  observeAssessment({ progress, correct, attempted, score, now, topic, referenceId }) {
    const before = progress;
    const base = this.updateDailyStreak(progress, now);
    const event = new LevelyLearningEvent({
      type: LevelyLearningEventType.ASSESSMENT,
      topic,
      correct,
      attempted,
      score,
      referenceId,
      at: now,
    });

    if (this.alreadyObserved(base, LevelyLearningEventType.ASSESSMENT, referenceId)) {
      return new LevelyCompanionObservation({ before, after: base, event });
    }

    const trendValue = score > 0 ? score : attempted === 0 ? 0 : (correct / attempted) * 100;
    const updated = this.withHistoryAndTrend(base, event, { trendValue, now });
    return new LevelyCompanionObservation({ before, after: updated, event });
  }

  observeAssignment({ progress, now, score, topic, referenceId }) {
    const before = progress;
    const base = this.updateDailyStreak(progress, now);
    const event = new LevelyLearningEvent({
      type: LevelyLearningEventType.ASSIGNMENT,
      topic,
      score,
      referenceId,
      at: now,
    });

    if (this.alreadyObserved(base, LevelyLearningEventType.ASSIGNMENT, referenceId)) {
      return new LevelyCompanionObservation({ before, after: base, event });
    }

    const trendValue = score && score > 0 ? score : null;
    const updated = this.withHistoryAndTrend(base, event, { trendValue, now });
    return new LevelyCompanionObservation({ before, after: updated, event });
  }

  alreadyObserved(progress, type, referenceId) {
    if (!referenceId || !referenceId.trim()) {
      return false;
    }
    return progress.history.some((entry) => entry.type === type && entry.referenceId === referenceId);
  }

  withHistoryAndTrend(progress, event, { trendValue, now }) {
    const history = [...progress.history, event];
    const trimmedHistory = history.length <= this.maxHistory ? history : history.slice(history.length - this.maxHistory);

    const trend = [...progress.trend];
    if (typeof trendValue === 'number') {
      trend.push(new LevelyTrendPoint({ type: event.type, value: trendValue, at: now }));
    }
    const trimmedTrend = trend.length <= this.maxTrend ? trend : trend.slice(trend.length - this.maxTrend);

    return progress.cloneWith({ history: trimmedHistory, trend: trimmedTrend });
  }

  updateDailyStreak(progress, now) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const last = progress.lastActiveDate
      ? new Date(
          progress.lastActiveDate.getFullYear(),
          progress.lastActiveDate.getMonth(),
          progress.lastActiveDate.getDate(),
        )
      : null;

    if (!last) {
      return progress.cloneWith({ dailyStreak: 1, lastActiveDate: today });
    }

    const diffDays = Math.floor((today - last) / (24 * 60 * 60 * 1000));
    if (diffDays === 0) {
      return progress.cloneWith({ lastActiveDate: today });
    }
    if (diffDays === 1) {
      return progress.cloneWith({ dailyStreak: progress.dailyStreak + 1, lastActiveDate: today });
    }
    return progress.cloneWith({ dailyStreak: 1, lastActiveDate: today });
  }
}

class LevelyCompanionFeedback {
  guardrails({ prompt, progress, chapterName, materialContent }) {
    const trimmed = prompt.trim();
    if (!trimmed) {
      return 'Tulis pertanyaan singkat. Jika perlu, tambahkan konteks atau contoh.';
    }

    const lower = trimmed.toLowerCase();
    if (this.isPerformanceRequest(lower)) {
      if (!this.hasSubmission(progress)) {
        return 'Feedback performa hanya tersedia setelah kamu submit kuis/assessment/assignment. Selesaikan dulu, lalu aku bantu ringkas hasilnya.';
      }
      if (!this.mentionsSubmissionType(lower)) {
        return 'Aku bisa bahas hasil submission kamu. Mau bahas hasil kuis, assessment, atau assignment yang mana?';
      }
    }
    return null;
  }

  quizFeedback({ observation, question, selectedIndex }) {
    const correct = selectedIndex === question.correctIndex;
    const afterTopic = observation.after.topicOrDefault(question.topic);
    const accuracy = Math.round(afterTopic.accuracy * 100);
    const trendNote = this.trendDeltaNote({
      before: observation.before,
      type: LevelyLearningEventType.QUIZ,
      currentValue: accuracy,
    });

    const summary = correct ? 'Benar' : 'Belum tepat';
    const performance = `${summary}, akurasi topik ${question.topic} sekarang ${accuracy}%${trendNote ? `, ${trendNote}` : ''}.`;
    const weakness = this.weakPointForTopic(afterTopic);
    const nextStep = this.nextStepForTopic(afterTopic);
    return `${performance} ${weakness}${this.nextStepSentence(nextStep)}`;
  }

  assessmentFeedback({ observation, correct, attempted, score, chapterName }) {
    const label = chapterName && chapterName.trim() ? ` di bab ${chapterName.trim()}` : '';
    const trendNote = this.trendDeltaNote({
      before: observation.before,
      type: LevelyLearningEventType.ASSESSMENT,
      currentValue: score,
    });
    const summary = `Assessment selesai${label}. Benar ${correct}/${attempted}, skor ${score}/100${trendNote ? `, ${trendNote}` : ''}.`;
    const weakness = this.weakPointForScore(score, chapterName);
    const nextStep = this.nextStepForScore(score, chapterName);
    return `${summary} ${weakness}${this.nextStepSentence(nextStep)}`;
  }

  assignmentFeedback({ observation, score, chapterName }) {
    const label = chapterName && chapterName.trim() ? ` di bab ${chapterName.trim()}` : '';
    if (!score || score === 0) {
      return `Tugas terkirim${label}. Kelemahan belum bisa dinilai karena nilai belum tersedia. Langkah berikutnya: cek rubrik dan tunggu penilaian.`;
    }
    const trendNote = this.trendDeltaNote({
      before: observation.before,
      type: LevelyLearningEventType.ASSIGNMENT,
      currentValue: score,
    });
    const summary = `Tugas dinilai${label} dengan skor ${score}/100${trendNote ? `, ${trendNote}` : ''}.`;
    const weakness = this.weakPointForScore(score, chapterName);
    const nextStep = this.nextStepForScore(score, chapterName);
    return `${summary} ${weakness}${this.nextStepSentence(nextStep)}`;
  }

  quickAskFallback({ prompt, progress, chapterName }) {
    const lower = prompt.toLowerCase();
    if (this.isPerformanceRequest(lower)) {
      if (!this.hasSubmission(progress)) {
        return 'Feedback performa hanya tersedia setelah kamu submit kuis/assessment/assignment. Selesaikan dulu, lalu aku bantu ringkas hasilnya.';
      }
      if (!this.mentionsSubmissionType(lower)) {
        return 'Aku bisa bahas hasil submission kamu. Mau bahas hasil kuis, assessment, atau assignment yang mana?';
      }
      return 'Sebutkan bagian hasil submission yang ingin kamu bahas.';
    }
    if (lower.includes('ringkas') || lower.includes('summary')) {
      return `Sebutkan bagian${this.chapterSuffix(chapterName)} yang ingin diringkas. Jika ada teksnya, tempelkan di sini; aku rangkum 3-5 poin utama plus istilah pentingnya.`;
    }
    if (lower.includes('contoh') || lower.includes('example')) {
      return `Sebutkan topik${this.chapterSuffix(chapterName)} yang ingin contoh singkatnya, plus konteksnya. Aku akan berikan contoh, jelaskan alasannya, dan bila perlu versi alternatifnya.`;
    }
    if (lower.includes('quiz') || lower.includes('kuis') || lower.includes('latihan')) {
      return `Aku bisa buat 3 soal latihan${this.chapterSuffix(chapterName)}. Sebutkan topik dan tingkat kesulitan; kalau belum yakin, aku buat level mudah dulu dan jelaskan jawabannya.`;
    }
    return 'Aku bisa jawab pertanyaan umum. Jelaskan topik, konteks, atau tujuanmu agar jawabannya lebih detail. Jika ada contoh, sertakan ya. Kalau mau, sebutkan tingkat kedalaman yang kamu inginkan.';
  }

  chapterSuffix(chapterName) {
    if (!chapterName || !chapterName.trim()) {
      return '';
    }
    return ` di bab ${chapterName.trim()}`;
  }

  trendDeltaNote({ before, type, currentValue }) {
    const prev = this.lastTrend(before, type);
    if (!prev) {
      return '';
    }
    const diff = currentValue - prev.value;
    if (Math.abs(diff) < 1) {
      return 'stabil dibanding sebelumnya';
    }
    const direction = diff > 0 ? 'naik' : 'turun';
    return `${direction} sekitar ${Math.round(Math.abs(diff))} poin dari sebelumnya`;
  }

  lastTrend(progress, type) {
    for (let i = progress.trend.length - 1; i >= 0; i -= 1) {
      const point = progress.trend[i];
      if (point.type === type) {
        return point;
      }
    }
    return null;
  }

  weakPointForTopic(topicProgress) {
    const accuracy = topicProgress.accuracy;
    if (topicProgress.attempted < 2) {
      return `Bagian lemah: belum terlihat jelas, butuh lebih banyak latihan di topik ${topicProgress.topic}.`;
    }
    if (accuracy < 0.6) {
      return `Bagian lemah: akurasi topik ${topicProgress.topic} masih rendah.`;
    }
    if (accuracy < 0.8) {
      return `Bagian lemah: konsistensi di topik ${topicProgress.topic} masih naik-turun.`;
    }
    return `Bagian lemah: detail kecil di topik ${topicProgress.topic} masih bisa ditajamkan.`;
  }

  weakPointForScore(score, chapterName) {
    const label = chapterName && chapterName.trim() ? `bab ${chapterName.trim()}` : 'materi ini';
    if (score >= 85) {
      return `Bagian lemah: belum terlihat besar, tapi tetap teliti di ${label}.`;
    }
    if (score >= 60) {
      return `Bagian lemah: beberapa bagian di ${label} masih belum konsisten.`;
    }
    return `Bagian lemah: konsep inti di ${label} masih lemah.`;
  }

  nextStepForTopic(topicProgress) {
    const accuracy = topicProgress.accuracy;
    if (accuracy < 0.6) {
      return `ulang konsep inti topik ${topicProgress.topic} lalu coba 2-3 soal mudah`;
    }
    if (accuracy < 0.8) {
      return `latihan 3 soal lagi di topik ${topicProgress.topic}`;
    }
    return `coba soal tingkat ${this.difficultyLabel(topicProgress.currentDifficulty)} untuk tantangan berikutnya`;
  }

  nextStepForScore(score, chapterName) {
    const label = chapterName && chapterName.trim() ? `bab ${chapterName.trim()}` : 'materi ini';
    if (score >= 85) {
      return `lanjut ke materi berikutnya atau coba soal lebih sulit di ${label}`;
    }
    if (score >= 60) {
      return `ulang bagian yang lemah di ${label} lalu latihan 3-5 soal`;
    }
    return `ulang konsep inti di ${label} lalu latihan dasar sebelum lanjut`;
  }

  difficultyLabel(difficulty) {
    switch (difficulty) {
      case QuizDifficulty.EASY:
        return 'mudah';
      case QuizDifficulty.MEDIUM:
        return 'sedang';
      case QuizDifficulty.HARD:
        return 'sulit';
      default:
        return 'custom';
    }
  }

  nextStepSentence(nextStep) {
    const trimmed = nextStep.trim();
    if (!trimmed) {
      return '';
    }
    return ` Langkah berikutnya: ${trimmed}.`;
  }

  hasSubmission(progress) {
    return progress.history.length > 0 || progress.attemptedTotal > 0;
  }

  mentionsSubmissionType(lowerPrompt) {
    return ['quiz', 'kuis', 'assessment', 'asesmen', 'assignment', 'tugas'].some((keyword) => lowerPrompt.includes(keyword));
  }

  isPerformanceRequest(lowerPrompt) {
    return performanceQuestionRegex.test(lowerPrompt) || selfPerformanceRegex.test(lowerPrompt);
  }

  limitSentences(text, { maxSentences = 8 } = {}) {
    const trimmed = text.trim();
    if (!trimmed) {
      return trimmed;
    }
    const parts = trimmed.split(/(?<=[.!?])\s+/);
    if (parts.length <= maxSentences) {
      return trimmed;
    }
    return parts.slice(0, maxSentences).join(' ').trim();
  }
}

const performanceQuestionRegex = /(gimana|bagaimana|seberapa|cek|lihat|review|evaluasi)\s+(progres|progress|performa|hasil|nilai|skor|score|kemajuan|akurasi|poin|streak)/i;
const selfPerformanceRegex = /(progres|progress|performa|hasil|nilai|skor|score|kemajuan|akurasi|poin|streak)(ku|\s*(saya|aku))/i;

class LevelyCompanion {
  constructor({ engine, observer, feedback, allowOverrides = process.env.NODE_ENV !== 'production', overrides = {} } = {}) {
    this.allowOverrides = allowOverrides;
    this.overrides = overrides;
    this.engine = engine || this.buildEngine();
    this.observer = observer || new LevelyCompanionObserver();
    this.feedback = feedback || new LevelyCompanionFeedback();
  }

  buildEngine() {
    const config = resolveLevelyLlmConfig({ allowOverrides: this.allowOverrides, overrides: this.overrides });
    if (!config.apiKey) {
      return new LevelyEngine();
    }
    const llm = new GeminiApiClient({ apiKey: config.apiKey, model: config.model, baseUrl: config.baseUrl });
    return new LevelyEngine({ llmClient: llm });
  }

  async loadProgress(userId = 'default') {
    return this.engine.loadProgress(userId);
  }

  async saveProgress(userId = 'default', progress) {
    return this.engine.saveProgress(userId, progress);
  }

  async observeQuiz({ userId = 'default', progress, question, selectedIndex, now = new Date() }) {
    const base = progress ?? (await this.loadProgress(userId));
    const observation = this.observer.observeQuiz({
      progress: base,
      question,
      selectedIndex,
      now,
    });
    const feedbackText = this.feedback.quizFeedback({
      observation,
      question,
      selectedIndex,
    });
    const updated = observation.after.cloneWith({ lastFeedback: feedbackText, lastFeedbackAt: now });
    await this.saveProgress(userId, updated);
    return new LevelyCompanionAutoFeedback({
      progress: updated,
      event: observation.event,
      pointsDelta: observation.pointsDelta,
      newlyUnlocked: observation.newlyUnlocked,
      feedback: feedbackText,
    });
  }

  async observeAssessment({ userId = 'default', progress, correct, attempted, score, now = new Date(), chapterName, referenceId }) {
    const base = progress ?? (await this.loadProgress(userId));
    const observation = this.observer.observeAssessment({
      progress: base,
      correct,
      attempted,
      score,
      now,
      topic: chapterName,
      referenceId,
    });
    const feedbackText = this.feedback.assessmentFeedback({
      observation,
      correct,
      attempted,
      score,
      chapterName,
    });
    const updated = observation.after.cloneWith({ lastFeedback: feedbackText, lastFeedbackAt: now });
    await this.saveProgress(userId, updated);
    return new LevelyCompanionAutoFeedback({
      progress: updated,
      event: observation.event,
      feedback: feedbackText,
    });
  }

  async observeAssignment({ userId = 'default', progress, now = new Date(), score, chapterName, referenceId }) {
    const base = progress ?? (await this.loadProgress(userId));
    const observation = this.observer.observeAssignment({
      progress: base,
      now,
      score,
      topic: chapterName,
      referenceId,
    });
    const feedbackText = this.feedback.assignmentFeedback({ observation, score, chapterName });
    const updated = observation.after.cloneWith({ lastFeedback: feedbackText, lastFeedbackAt: now });
    await this.saveProgress(userId, updated);
    return new LevelyCompanionAutoFeedback({
      progress: updated,
      event: observation.event,
      feedback: feedbackText,
    });
  }

  async quickAsk({
    userId = 'default',
    prompt,
    progress,
    history = [],
    courseId,
    level,
    chapterName,
    materialContent,
  }) {
    const base = progress ?? (await this.loadProgress(userId));
    const guardrail = this.feedback.guardrails({ prompt, progress: base, chapterName, materialContent });
    if (guardrail) {
      return guardrail;
    }

    const snippet = materialContent && materialContent.trim().length
      ? LevelyRag.buildSnippet({ material: materialContent })
      : '';

    const reply = await this.engine.answerChat({
      userMessage: prompt,
      progress: base,
      courseId,
      level,
      chapterName,
      materialSnippet: snippet,
      history,
      userId,
    });
    return this.feedback.limitSentences(reply);
  }
}

module.exports = {
  LevelyCompanion,
  LevelyCompanionObserver,
  LevelyCompanionFeedback,
};
