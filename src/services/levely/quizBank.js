const { QuizDifficulty, QuizQuestion } = require('./models');

const topics = ['Usability', 'Heuristics', 'User Research'];

function allQuestions() {
  return [...easyQuestions, ...mediumQuestions, ...hardQuestions];
}

function by(topic, difficulty) {
  return allQuestions().filter((question) => question.topic === topic && question.difficulty === difficulty);
}

const easyQuestions = [
  new QuizQuestion({
    id: 'u-e-1',
    topic: 'Usability',
    difficulty: QuizDifficulty.EASY,
    prompt: 'Apa definisi sederhana dari usability?',
    choices: [
      'Seberapa cepat aplikasi berjalan',
      'Seberapa mudah dan efektif pengguna mencapai tujuan',
      'Seberapa mahal biaya pengembangan',
      'Seberapa banyak fitur yang tersedia',
    ],
    correctIndex: 1,
    explanation: 'Usability fokus pada kemudahan, efektivitas, efisiensi, dan kepuasan pengguna saat mencapai tujuan.',
  }),
  new QuizQuestion({
    id: 'u-e-2',
    topic: 'Usability',
    difficulty: QuizDifficulty.EASY,
    prompt: 'Contoh masalah usability yang paling tepat adalah…',
    choices: [
      'Warna brand tidak sesuai',
      'Tombol “Submit” sulit ditemukan sehingga pengguna gagal menyelesaikan form',
      'Server down',
      'Harga langganan terlalu tinggi',
    ],
    correctIndex: 1,
    explanation: 'Masalah usability muncul saat pengguna kesulitan menyelesaikan tugas/tujuan dalam UI.',
  }),
  new QuizQuestion({
    id: 'h-e-1',
    topic: 'Heuristics',
    difficulty: QuizDifficulty.EASY,
    prompt: 'Heuristic evaluation biasanya dilakukan oleh…',
    choices: [
      'Pengguna akhir dalam jumlah besar',
      'Seorang evaluator/ahli UX menggunakan daftar heuristik',
      'Hanya oleh developer',
      'Dengan A/B testing otomatis',
    ],
    correctIndex: 1,
    explanation: 'Heuristic evaluation dilakukan evaluator (biasanya ahli) dengan acuan heuristik (mis. Nielsen).',
  }),
  new QuizQuestion({
    id: 'h-e-2',
    topic: 'Heuristics',
    difficulty: QuizDifficulty.EASY,
    prompt: 'Heuristik “Visibility of system status” berarti…',
    choices: [
      'Aplikasi harus selalu online',
      'Sistem memberi feedback yang jelas tentang apa yang sedang terjadi',
      'Tampilan harus banyak animasi',
      'Sistem harus menyembunyikan informasi',
    ],
    correctIndex: 1,
    explanation: 'Sistem perlu memberi status/progress supaya pengguna tidak bingung (loading, sukses, gagal).',
  }),
  new QuizQuestion({
    id: 'r-e-1',
    topic: 'User Research',
    difficulty: QuizDifficulty.EASY,
    prompt: 'Tujuan utama user research adalah…',
    choices: [
      'Membuktikan ide kita benar',
      'Memahami kebutuhan, konteks, dan perilaku pengguna',
      'Menambah jumlah fitur',
      'Membuat desain terlihat modern',
    ],
    correctIndex: 1,
    explanation: 'User research membantu memahami pengguna agar solusi lebih tepat sasaran.',
  }),
  new QuizQuestion({
    id: 'r-e-2',
    topic: 'User Research',
    difficulty: QuizDifficulty.EASY,
    prompt: 'Metode yang termasuk user research kualitatif adalah…',
    choices: [
      'Wawancara pengguna',
      'Menghitung jumlah klik saja',
      'Mengukur FPS aplikasi',
      'Membaca log error',
    ],
    correctIndex: 0,
    explanation: 'Wawancara menggali alasan/cerita pengguna (kualitatif).',
  }),
];

const mediumQuestions = [
  new QuizQuestion({
    id: 'u-m-1',
    topic: 'Usability',
    difficulty: QuizDifficulty.MEDIUM,
    prompt: 'Jika waktu menyelesaikan tugas turun namun error meningkat, metrik usability yang paling “konflik” adalah…',
    choices: [
      'Efisiensi vs efektivitas',
      'Learnability vs memorability',
      'Kepuasan vs aksesibilitas',
      'Brand vs estetika',
    ],
    correctIndex: 0,
    explanation: 'Lebih cepat (efisiensi) tetapi lebih banyak error (efektivitas) menunjukkan trade-off.',
  }),
  new QuizQuestion({
    id: 'u-m-2',
    topic: 'Usability',
    difficulty: QuizDifficulty.MEDIUM,
    prompt: 'Metrik yang paling cocok untuk mengukur “learnability” adalah…',
    choices: [
      'Waktu yang dibutuhkan pengguna baru untuk menyelesaikan tugas pertama',
      'Jumlah server request',
      'Jumlah fitur premium',
      'Jumlah halaman di aplikasi',
    ],
    correctIndex: 0,
    explanation: 'Learnability sering diukur dari performa pengguna baru saat first-time use.',
  }),
  new QuizQuestion({
    id: 'h-m-1',
    topic: 'Heuristics',
    difficulty: QuizDifficulty.MEDIUM,
    prompt: 'Pesan error yang hanya berbunyi “Error 0x0001” melanggar heuristik…',
    choices: [
      'Match between system and the real world',
      'Help users recognize, diagnose, and recover from errors',
      'Aesthetic and minimalist design',
      'Flexibility and efficiency of use',
    ],
    correctIndex: 1,
    explanation: 'Error harus membantu pengguna memahami masalah dan cara memperbaikinya.',
  }),
  new QuizQuestion({
    id: 'h-m-2',
    topic: 'Heuristics',
    difficulty: QuizDifficulty.MEDIUM,
    prompt: 'Skenario: user tidak sengaja menghapus file dan tidak ada undo. Ini melanggar…',
    choices: [
      'User control and freedom',
      'Recognition rather than recall',
      'Consistency and standards',
      'Help and documentation',
    ],
    correctIndex: 0,
    explanation: 'Undo/redo memberi kontrol dan kebebasan saat pengguna melakukan tindakan tidak sengaja.',
  }),
  new QuizQuestion({
    id: 'r-m-1',
    topic: 'User Research',
    difficulty: QuizDifficulty.MEDIUM,
    prompt: 'Perbedaan utama survei vs wawancara adalah…',
    choices: [
      'Survei untuk data kuantitatif skala besar; wawancara untuk insight mendalam',
      'Survei selalu lebih akurat',
      'Wawancara tidak butuh panduan',
      'Survei hanya untuk UX writer',
    ],
    correctIndex: 0,
    explanation: 'Survei cocok untuk breadth, wawancara untuk depth.',
  }),
  new QuizQuestion({
    id: 'r-m-2',
    topic: 'User Research',
    difficulty: QuizDifficulty.MEDIUM,
    prompt: 'Jika Anda ingin melihat perilaku nyata saat user memakai aplikasi, metode yang tepat adalah…',
    choices: [
      'Usability testing (task-based)',
      'Hanya brainstorming internal',
      'Menebak persona',
      'Membaca review kompetitor saja',
    ],
    correctIndex: 0,
    explanation: 'Usability testing mengamati user mengerjakan tugas, termasuk kesalahan dan kebingungan.',
  }),
];

const hardQuestions = [
  new QuizQuestion({
    id: 'u-h-1',
    topic: 'Usability',
    difficulty: QuizDifficulty.HARD,
    prompt: 'Skor SUS (System Usability Scale) 68 biasanya diinterpretasikan sebagai…',
    choices: [
      'Di bawah rata-rata (poor)',
      'Sekitar rata-rata (OK/average)',
      'Sangat tinggi (excellent)',
      'Tidak bisa diinterpretasikan',
    ],
    correctIndex: 1,
    explanation: 'SUS 68 sering dianggap sekitar rata-rata (benchmark umum).',
  }),
  new QuizQuestion({
    id: 'u-h-2',
    topic: 'Usability',
    difficulty: QuizDifficulty.HARD,
    prompt: 'Dalam usability testing, “think-aloud” terutama membantu mengungkap…',
    choices: [
      'Kecepatan internet pengguna',
      'Proses mental, asumsi, dan alasan di balik tindakan user',
      'Jumlah user yang aktif',
      'Bug pada backend',
    ],
    correctIndex: 1,
    explanation: 'Think-aloud memunculkan reasoning user saat berinteraksi dengan UI.',
  }),
  new QuizQuestion({
    id: 'h-h-1',
    topic: 'Heuristics',
    difficulty: QuizDifficulty.HARD,
    prompt: 'Saat melakukan heuristic evaluation, praktik yang paling tepat adalah…',
    choices: [
      '1 evaluator saja agar konsisten',
      'Beberapa evaluator independen lalu gabungkan temuan',
      'Tidak perlu severity rating',
      'Langsung redesign tanpa catat temuan',
    ],
    correctIndex: 1,
    explanation: 'Beberapa evaluator mengurangi blind spot; temuan digabungkan dan biasanya diberi severity.',
  }),
  new QuizQuestion({
    id: 'h-h-2',
    topic: 'Heuristics',
    difficulty: QuizDifficulty.HARD,
    prompt: '“Recognition rather than recall” dapat diperbaiki dengan…',
    choices: [
      'Memaksa user mengingat shortcut',
      'Menampilkan opsi/riwayat/petunjuk agar user tidak perlu mengingat',
      'Menghapus label tombol',
      'Menyembunyikan menu',
    ],
    correctIndex: 1,
    explanation: 'Kurangi beban memori: tampilkan pilihan, auto-complete, riwayat, hint, dsb.',
  }),
  new QuizQuestion({
    id: 'r-h-1',
    topic: 'User Research',
    difficulty: QuizDifficulty.HARD,
    prompt: 'Bias yang umum saat user research dan cara mitigasinya yang tepat adalah…',
    choices: [
      'Confirmation bias; buat pertanyaan netral dan cari data yang berlawanan',
      'Recency bias; tanya hanya 1 user',
      'Selection bias; pilih user yang paling mirip kita',
      'Observer effect; hilangkan catatan',
    ],
    correctIndex: 0,
    explanation: 'Mitigasi bias: pertanyaan netral, triangulasi, cari counter-evidence, sampling lebih baik.',
  }),
  new QuizQuestion({
    id: 'r-h-2',
    topic: 'User Research',
    difficulty: QuizDifficulty.HARD,
    prompt: 'Kapan Anda lebih cocok memakai diary study?',
    choices: [
      'Untuk memahami perilaku dan pengalaman pengguna dalam jangka waktu panjang',
      'Untuk memilih warna UI',
      'Untuk mengukur performa server',
      'Untuk debugging crash',
    ],
    correctIndex: 0,
    explanation: 'Diary study cocok untuk perilaku/aktivitas yang terjadi berulang dan kontekstual dalam waktu lama.',
  }),
];

module.exports = {
  topics,
  allQuestions,
  by,
};
