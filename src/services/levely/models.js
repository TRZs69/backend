const LevelyLearningEventType = Object.freeze({
  QUIZ: 'quiz',
  ASSESSMENT: 'assessment',
  ASSIGNMENT: 'assignment',
});

class LevelyLearningEvent {
  constructor({
    type,
    topic = null,
    correct = null,
    attempted = null,
    score = null,
    referenceId = null,
    at = new Date(),
  }) {
    this.type = type;
    this.topic = topic;
    this.correct = correct;
    this.attempted = attempted;
    this.score = score;
    this.referenceId = referenceId;
    this.at = at instanceof Date ? at : new Date(at);
  }

  get accuracy() {
    if (!this.attempted || this.attempted === 0) {
      return null;
    }
    return (this.correct ?? 0) / this.attempted;
  }

  toJSON() {
    return {
      type: this.type,
      topic: this.topic,
      correct: this.correct,
      attempted: this.attempted,
      score: this.score,
      referenceId: this.referenceId,
      at: this.at.toISOString(),
    };
  }

  static fromJSON(json) {
    return new LevelyLearningEvent({
      type: json.type,
      topic: json.topic ?? null,
      correct: json.correct ?? null,
      attempted: json.attempted ?? null,
      score: json.score ?? null,
      referenceId: json.referenceId ?? null,
      at: json.at,
    });
  }
}

class LevelyTrendPoint {
  constructor({ type, value, at = new Date() }) {
    this.type = type;
    this.value = typeof value === 'number' ? value : Number(value ?? 0);
    this.at = at instanceof Date ? at : new Date(at);
  }

  toJSON() {
    return {
      type: this.type,
      value: this.value,
      at: this.at.toISOString(),
    };
  }

  static fromJSON(json) {
    return new LevelyTrendPoint({
      type: json.type,
      value: json.value,
      at: json.at,
    });
  }
}

const QuizDifficulty = Object.freeze({
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
});

const LevelyBadgeId = Object.freeze({
  CONSISTENCY_3_DAYS: 'consistency3Days',
  FAST_LEARNER: 'fastLearner',
  COMEBACK: 'comeback',
  QUIZ_MASTER: 'quizMaster',
  TOPIC_EXPLORER: 'topicExplorer',
});

class LevelyBadge {
  constructor({ id, title, description }) {
    this.id = id;
    this.title = title;
    this.description = description;
  }
}

class QuizQuestion {
  constructor({ id, topic, difficulty, prompt, choices, correctIndex, explanation }) {
    this.id = id;
    this.topic = topic;
    this.difficulty = difficulty;
    this.prompt = prompt;
    this.choices = choices;
    this.correctIndex = correctIndex;
    this.explanation = explanation;
  }
}

class TopicProgress {
  constructor({
    topic,
    attempted = 0,
    correct = 0,
    correctStreak = 0,
    wrongStreak = 0,
    currentDifficulty = QuizDifficulty.EASY,
  }) {
    this.topic = topic;
    this.attempted = attempted;
    this.correct = correct;
    this.correctStreak = correctStreak;
    this.wrongStreak = wrongStreak;
    this.currentDifficulty = currentDifficulty;
  }

  get accuracy() {
    if (this.attempted === 0) {
      return 0;
    }
    return this.correct / this.attempted;
  }

  cloneWith({
    attempted = this.attempted,
    correct = this.correct,
    correctStreak = this.correctStreak,
    wrongStreak = this.wrongStreak,
    currentDifficulty = this.currentDifficulty,
  } = {}) {
    return new TopicProgress({
      topic: this.topic,
      attempted,
      correct,
      correctStreak,
      wrongStreak,
      currentDifficulty,
    });
  }

  toJSON() {
    return {
      topic: this.topic,
      attempted: this.attempted,
      correct: this.correct,
      correctStreak: this.correctStreak,
      wrongStreak: this.wrongStreak,
      currentDifficulty: this.currentDifficulty,
    };
  }

  static fromJSON(json) {
    return new TopicProgress({
      topic: json.topic,
      attempted: json.attempted,
      correct: json.correct,
      correctStreak: json.correctStreak,
      wrongStreak: json.wrongStreak,
      currentDifficulty: json.currentDifficulty,
    });
  }
}

class LevelyProgress {
  constructor({
    points = 0,
    correctTotal = 0,
    attemptedTotal = 0,
    dailyStreak = 0,
    lastActiveDate = null,
    topics = {},
    badges = new Set(),
    history = [],
    trend = [],
    lastFeedback = null,
    lastFeedbackAt = null,
  } = {}) {
    this.points = points;
    this.correctTotal = correctTotal;
    this.attemptedTotal = attemptedTotal;
    this.dailyStreak = dailyStreak;
    this.lastActiveDate = lastActiveDate ? new Date(lastActiveDate) : null;
    this.topics = {};
    Object.entries(topics).forEach(([key, value]) => {
      this.topics[key] = value instanceof TopicProgress ? value : TopicProgress.fromJSON(value);
    });
    this.badges = valueToSet(badges);
    this.history = history.map((entry) => (entry instanceof LevelyLearningEvent ? entry : LevelyLearningEvent.fromJSON(entry)));
    this.trend = trend.map((entry) => (entry instanceof LevelyTrendPoint ? entry : LevelyTrendPoint.fromJSON(entry)));
    this.lastFeedback = lastFeedback;
    this.lastFeedbackAt = lastFeedbackAt ? new Date(lastFeedbackAt) : null;
  }

  static empty() {
    return new LevelyProgress();
  }

  get accuracy() {
    if (this.attemptedTotal === 0) {
      return 0;
    }
    return this.correctTotal / this.attemptedTotal;
  }

  get topicsAttempted() {
    return Object.keys(this.topics);
  }

  topicOrDefault(topic) {
    if (this.topics[topic]) {
      return this.topics[topic];
    }
    return new TopicProgress({ topic });
  }

  cloneWith({
    points = this.points,
    correctTotal = this.correctTotal,
    attemptedTotal = this.attemptedTotal,
    dailyStreak = this.dailyStreak,
    lastActiveDate = this.lastActiveDate,
    topics = this.topics,
    badges = this.badges,
    history = this.history,
    trend = this.trend,
    lastFeedback = this.lastFeedback,
    lastFeedbackAt = this.lastFeedbackAt,
  } = {}) {
    return new LevelyProgress({
      points,
      correctTotal,
      attemptedTotal,
      dailyStreak,
      lastActiveDate,
      topics,
      badges,
      history,
      trend,
      lastFeedback,
      lastFeedbackAt,
    });
  }

  toJSON() {
    return {
      points: this.points,
      correctTotal: this.correctTotal,
      attemptedTotal: this.attemptedTotal,
      dailyStreak: this.dailyStreak,
      lastActiveDate: this.lastActiveDate ? this.lastActiveDate.toISOString() : null,
      topics: Object.fromEntries(Object.entries(this.topics).map(([key, value]) => [key, value.toJSON()])),
      badges: Array.from(this.badges),
      history: this.history.map((entry) => entry.toJSON()),
      trend: this.trend.map((entry) => entry.toJSON()),
      lastFeedback: this.lastFeedback,
      lastFeedbackAt: this.lastFeedbackAt ? this.lastFeedbackAt.toISOString() : null,
    };
  }

  static fromJSON(json) {
    return new LevelyProgress({
      points: json.points ?? 0,
      correctTotal: json.correctTotal ?? 0,
      attemptedTotal: json.attemptedTotal ?? 0,
      dailyStreak: json.dailyStreak ?? 0,
      lastActiveDate: json.lastActiveDate ?? null,
      topics: json.topics ?? {},
      badges: new Set(json.badges ?? []),
      history: (json.history ?? []).map((entry) => LevelyLearningEvent.fromJSON(entry)),
      trend: (json.trend ?? []).map((entry) => LevelyTrendPoint.fromJSON(entry)),
      lastFeedback: json.lastFeedback ?? null,
      lastFeedbackAt: json.lastFeedbackAt ?? null,
    });
  }
}

class LevelyChatMessage {
  constructor({ fromUser, text }) {
    this.fromUser = fromUser;
    this.text = text;
  }

  static user(text) {
    return new LevelyChatMessage({ fromUser: true, text });
  }

  static assistant(text) {
    return new LevelyChatMessage({ fromUser: false, text });
  }
}

function valueToSet(value) {
  if (value instanceof Set) {
    return new Set(Array.from(value));
  }
  if (Array.isArray(value)) {
    return new Set(value);
  }
  return new Set();
}

module.exports = {
  LevelyLearningEventType,
  LevelyLearningEvent,
  LevelyTrendPoint,
  QuizDifficulty,
  LevelyBadgeId,
  LevelyBadge,
  QuizQuestion,
  TopicProgress,
  LevelyProgress,
  LevelyChatMessage,
};
