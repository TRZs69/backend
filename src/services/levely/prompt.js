const { LevelyLearningEventType } = require('./models');

function systemPrompt({ appName, assistantName, language }) {
  return `Kamu adalah ${assistantName}, personal learning companion di aplikasi ${appName}.
Bahasa utama: ${language}. Gunakan gaya ramah, jelas, dan tidak terlalu singkat.

Tujuan:
1) Menjawab pertanyaan pengguna secara umum dengan jelas, termasuk yang terkait materi.
2) Memberi feedback reflektif berbasis progres (benar/salah, tren, langkah berikutnya).
3) Mendorong belajar aktif: tanya klarifikasi jika konteks kurang.

Aturan:
- Jangan mengaku manusia.
- Boleh menjawab pertanyaan umum. Jika relevan, hubungkan jawaban dengan course/bab/topik yang sedang aktif.
- Jawaban tidak terlalu singkat; untuk pertanyaan terbuka, beri 4-7 kalimat yang mencakup poin inti dan contoh singkat bila perlu.
- Jika tidak yakin, jelaskan keterbatasan dan ajukan pertanyaan klarifikasi.
- Jangan mengarang referensi/rumus yang tidak diminta.
- Feedback performa hanya setelah submission (quiz/assessment/assignment); jangan memberi evaluasi spontan di Quick-Ask.`;
}

function contextPrompt({ courseId, level, chapterName, progress, materialSnippet }) {
  const parts = [];
  if (typeof courseId === 'number') parts.push(`courseId=${courseId}`);
  if (typeof level === 'number') parts.push(`level=${level}`);
  if (chapterName && chapterName.trim().length > 0) parts.push(`chapter="${chapterName.trim()}"`);

  const topTopics = Object.values(progress.topics).sort((a, b) => b.attempted - a.attempted);
  const topicSummary = topTopics
    .slice(0, 3)
    .map((topic) => `${topic.topic}:${topic.correct}/${topic.attempted}(${Math.round(topic.accuracy * 100)}%)`)
    .join(', ');
  const topicAttempted = progress.topicsAttempted.slice(0, 3).join(', ');
  const recentTrend = trendSummary(progress);
  const lastFeedback = trimText(progress.lastFeedback ?? '', 160);
  const lastFeedbackAt = progress.lastFeedbackAt ? progress.lastFeedbackAt.toISOString() : '-';
  const recentScores = recentScoreSummary(progress);

  const materialContext = materialSnippet && materialSnippet.trim().length > 0 ? `

MATERI TERKAIT (cuplikan):
${materialSnippet.trim()}` : '';

  return `KONTEKS APP:
- ${parts.length === 0 ? 'no_context' : parts.join(' ')}

PROGRES RINGKAS:
- poin=${progress.points}
- totalQuiz=${progress.correctTotal}/${progress.attemptedTotal} (${Math.round(progress.accuracy * 100)}%)
- streakHarian=${progress.dailyStreak}
- topikTeratas=${topicSummary || '-'}
- topikDicoba=${topicAttempted || '-'}
- skorTerbaru=${recentScores || '-'}
- trenTerakhir=${recentTrend || '-'}
- feedbackTerakhir=${lastFeedback || '-'}
- feedbackTerakhirAt=${lastFeedbackAt}${materialContext}
`;
}

function trendSummary(progress) {
  if (!progress.trend.length) {
    return '';
  }
  const start = progress.trend.length <= 3 ? 0 : progress.trend.length - 3;
  return progress.trend
    .slice(start)
    .map((point) => `${trendLabel(point.type)}:${Math.round(point.value)}%`)
    .join(', ');
}

function trendLabel(type) {
  switch (type) {
    case LevelyLearningEventType.QUIZ:
      return 'quiz';
    case LevelyLearningEventType.ASSESSMENT:
      return 'assessment';
    case LevelyLearningEventType.ASSIGNMENT:
      return 'assignment';
    default:
      return 'event';
  }
}

function recentScoreSummary(progress) {
  if (!progress.history.length) {
    return '';
  }
  const recent = progress.history.slice(-3);
  return recent
    .map((event) => {
      const label = trendLabel(event.type);
      if (typeof event.score === 'number' && event.score > 0) {
        return `${label}:${event.score}`;
      }
      if (typeof event.attempted === 'number' && event.attempted > 0 && typeof event.correct === 'number') {
        const pct = Math.round((event.correct / event.attempted) * 100);
        return `${label}:${pct}%`;
      }
      return `${label}:-`;
    })
    .join(', ');
}

function trimText(text, maxLength) {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.substring(0, maxLength).trim()}...`;
}

module.exports = {
  systemPrompt,
  contextPrompt,
};
