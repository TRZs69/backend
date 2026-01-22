const {
  LevelyBadge,
  LevelyBadgeId,
  LevelyProgress,
  QuizDifficulty,
  TopicProgress,
} = require('./models');

const badgeCatalog = [
  new LevelyBadge({
    id: LevelyBadgeId.CONSISTENCY_3_DAYS,
    title: 'Consistency',
    description: 'Belajar 3 hari berturut-turut.',
  }),
  new LevelyBadge({
    id: LevelyBadgeId.FAST_LEARNER,
    title: 'Fast Learner',
    description: 'Banyak jawaban benar di awal latihan.',
  }),
  new LevelyBadge({
    id: LevelyBadgeId.COMEBACK,
    title: 'Comeback',
    description: 'Berhasil bangkit setelah beberapa kali salah.',
  }),
  new LevelyBadge({
    id: LevelyBadgeId.QUIZ_MASTER,
    title: 'Quiz Master',
    description: 'Total 20 jawaban benar.',
  }),
  new LevelyBadge({
    id: LevelyBadgeId.TOPIC_EXPLORER,
    title: 'Topic Explorer',
    description: 'Mencoba kuis di 3 topik berbeda.',
  }),
];

class LevelyGamification {
  static pointsForAnswer({ difficulty, isCorrect, correctStreak, wrongStreak }) {
    const base = (() => {
      switch (difficulty) {
        case QuizDifficulty.MEDIUM:
          return 20;
        case QuizDifficulty.HARD:
          return 30;
        case QuizDifficulty.EASY:
        default:
          return 10;
      }
    })();

    if (!isCorrect) {
      const attempt = Math.round(base * 0.15);
      const penalty = clamp(1 - clamp(wrongStreak, 0, 4) * 0.15, 0.4, 1);
      return Math.round(attempt * penalty);
    }

    const streakBonus = 1 + clamp(correctStreak, 0, 6) * 0.12;
    return Math.round(base * streakBonus);
  }

  static adjustDifficulty(topicProgress) {
    const tp = topicProgress instanceof TopicProgress ? topicProgress : new TopicProgress(topicProgress);
    if (tp.correctStreak >= 3 || (tp.attempted >= 6 && tp.accuracy >= 0.8)) {
      switch (tp.currentDifficulty) {
        case QuizDifficulty.EASY:
          return QuizDifficulty.MEDIUM;
        case QuizDifficulty.MEDIUM:
          return QuizDifficulty.HARD;
        default:
          return QuizDifficulty.HARD;
      }
    }
    if (tp.wrongStreak >= 2 || (tp.attempted >= 6 && tp.accuracy <= 0.45)) {
      switch (tp.currentDifficulty) {
        case QuizDifficulty.HARD:
          return QuizDifficulty.MEDIUM;
        case QuizDifficulty.MEDIUM:
          return QuizDifficulty.EASY;
        default:
          return QuizDifficulty.EASY;
      }
    }
    return tp.currentDifficulty;
  }

  static applyQuizResult({ progress, question, isCorrect, now }) {
    const updated = updateDailyStreak(progress, now);
    const beforeTopic = updated.topicOrDefault(question.topic);
    const comebackTrigger = isCorrect && beforeTopic.wrongStreak >= 3;

    const attempted = beforeTopic.attempted + 1;
    const correct = beforeTopic.correct + (isCorrect ? 1 : 0);
    const correctStreak = isCorrect ? beforeTopic.correctStreak + 1 : 0;
    const wrongStreak = isCorrect ? 0 : beforeTopic.wrongStreak + 1;
    const pointsDelta = LevelyGamification.pointsForAnswer({
      difficulty: question.difficulty,
      isCorrect,
      correctStreak,
      wrongStreak,
    });

    const afterTopicBase = beforeTopic.cloneWith({
      attempted,
      correct,
      correctStreak,
      wrongStreak,
    });
    const nextDifficulty = LevelyGamification.adjustDifficulty(afterTopicBase);
    const afterTopic = afterTopicBase.cloneWith({ currentDifficulty: nextDifficulty });

    const nextTopics = { ...updated.topics, [question.topic]: afterTopic };
    let nextProgress = updated.cloneWith({
      points: updated.points + pointsDelta,
      attemptedTotal: updated.attemptedTotal + 1,
      correctTotal: updated.correctTotal + (isCorrect ? 1 : 0),
      topics: nextTopics,
    });

    const unlocked = [];
    nextProgress = checkBadges({
      progress: nextProgress,
      newlyUnlocked: unlocked,
      comebackTrigger,
    });

    return { progress: nextProgress, newlyUnlocked: unlocked, pointsDelta };
  }

  static buildRecommendation(progress) {
    if (progress.attemptedTotal < 3) {
      return 'Mulai dengan kuis mudah dulu. Setelah itu, Levely bisa kasih rekomendasi berdasarkan progresmu.';
    }

    let weakest = null;
    let strongest = null;
    Object.values(progress.topics).forEach((topicProgress) => {
      if (topicProgress.attempted < 3) {
        return;
      }
      if (!weakest || topicProgress.accuracy < weakest.accuracy) {
        weakest = topicProgress;
      }
      if (!strongest || topicProgress.accuracy > strongest.accuracy) {
        strongest = topicProgress;
      }
    });

    if (weakest && weakest.accuracy <= 0.55) {
      return `Kamu masih sering salah di topik ${weakest.topic}. Coba ulangi materi inti topik itu, lalu latihan kuis ${weakest.currentDifficulty} lagi.`;
    }
    if (strongest && strongest.accuracy >= 0.85) {
      return `Kamu sudah kuat di topik ${strongest.topic}. Kamu bisa lanjut ke level berikutnya atau coba kuis yang lebih sulit.`;
    }
    return 'Progresmu stabil. Lanjutkan latihan, dan fokuskan 1 topik sampai akurasimu naik.';
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function updateDailyStreak(progress, now) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const last = progress.lastActiveDate
    ? new Date(progress.lastActiveDate.getFullYear(), progress.lastActiveDate.getMonth(), progress.lastActiveDate.getDate())
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

function checkBadges({ progress, newlyUnlocked, comebackTrigger }) {
  const unlocked = new Set(progress.badges);

  const award = (id) => {
    if (unlocked.has(id)) {
      return;
    }
    unlocked.add(id);
    const badge = badgeCatalog.find((item) => item.id === id);
    if (badge) {
      newlyUnlocked.push(badge);
    }
  };

  if (progress.dailyStreak >= 3) award(LevelyBadgeId.CONSISTENCY_3_DAYS);
  if (progress.correctTotal >= 20) award(LevelyBadgeId.QUIZ_MASTER);
  if (Object.keys(progress.topics).length >= 3) award(LevelyBadgeId.TOPIC_EXPLORER);
  if (progress.attemptedTotal <= 7 && progress.correctTotal >= 5) award(LevelyBadgeId.FAST_LEARNER);
  if (comebackTrigger) award(LevelyBadgeId.COMEBACK);

  return progress.cloneWith({ badges: unlocked });
}

module.exports = {
  LevelyGamification,
  badgeCatalog,
};
