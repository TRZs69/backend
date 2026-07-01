-- ============================================================
-- evaluation_logs.sql
-- Tabel-tabel evaluation logging untuk analisis Tugas Akhir Bab 6
--
-- Seluruh tabel bersifat APPEND-ONLY (tidak ada DELETE/UPDATE).
-- Data digunakan untuk:
--   - Analisis perkembangan Elo Rating mahasiswa
--   - Perubahan tingkat kesulitan soal berdasarkan interaksi
--   - Perkembangan band kemampuan mahasiswa
--   - Pola pemilihan soal berdasarkan Elo Rating
--   - Keputusan adaptasi yang diambil oleh sistem
--
-- Jalankan script ini di Supabase SQL Editor.
-- ============================================================


-- ============================================================
-- 1. ASSESSMENT LOGS
-- Pencatatan utama: setiap interaksi mahasiswa dengan soal objektif.
-- Sumber utama untuk analisis perubahan Elo Rating per soal.
-- ============================================================
CREATE TABLE IF NOT EXISTS assessment_logs (
    id                    BIGSERIAL PRIMARY KEY,

    -- Identitas sesi
    assessment_id         INTEGER       NOT NULL,   -- AssessmentAttempt.id
    student_id            INTEGER       NOT NULL,   -- User.id
    chapter_id            INTEGER       NOT NULL,   -- Chapter.id

    -- Identitas soal (nullable untuk soal AI-generated yang belum punya source)
    question_id           INTEGER       NULL,       -- Question.id (bank), NULL jika AI-generated tanpa source

    -- Elo sebelum dan sesudah interaksi
    student_rating_before INTEGER       NOT NULL,   -- Rating mahasiswa sebelum soal ini
    student_rating_after  INTEGER       NOT NULL,   -- Rating mahasiswa sesudah pembaruan Elo
    question_rating_before INTEGER      NOT NULL,   -- Rating soal sebelum interaksi
    question_rating_after  INTEGER      NOT NULL,   -- Rating soal sesudah pembaruan

    -- Probabilitas dan hasil
    expected_score        DOUBLE PRECISION NOT NULL, -- P(s,i) = 1 / (1 + 10^(-(R_s - D_i)/400))
    actual_score          SMALLINT      NOT NULL,   -- 1 = benar, 0 = salah

    -- K-Factor yang digunakan
    k_student             INTEGER       NOT NULL,   -- K-Factor mahasiswa saat interaksi ini
    k_question            INTEGER       NOT NULL,   -- K-Factor soal saat interaksi ini

    -- Kategori kesulitan soal saat diberikan
    difficulty_level      TEXT          NOT NULL,   -- Nama band Elo soal (misal: 'Beginner', 'Intermediate')

    created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Indeks untuk query analisis
CREATE INDEX IF NOT EXISTS idx_assessment_logs_student_id    ON assessment_logs (student_id);
CREATE INDEX IF NOT EXISTS idx_assessment_logs_assessment_id ON assessment_logs (assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_logs_chapter_id    ON assessment_logs (chapter_id);
CREATE INDEX IF NOT EXISTS idx_assessment_logs_created_at    ON assessment_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_assessment_logs_student_time  ON assessment_logs (student_id, created_at);


-- ============================================================
-- 2. ADAPTIVE DECISION LOGS
-- Keputusan adaptif setelah setiap attempt selesai.
-- Mencatat transisi band kemampuan dan alasan perubahan tingkat kesulitan.
-- ============================================================
CREATE TABLE IF NOT EXISTS adaptive_decision_logs (
    id                    BIGSERIAL PRIMARY KEY,

    -- Identitas
    student_id            INTEGER       NOT NULL,   -- User.id
    assessment_id         INTEGER       NOT NULL,   -- AssessmentAttempt.id
    chapter_id            INTEGER       NOT NULL,   -- Chapter.id

    -- Band kemampuan sebelum dan sesudah attempt
    student_band_before   TEXT          NOT NULL,   -- Band berdasarkan Elo awal attempt
    student_band_after    TEXT          NOT NULL,   -- Band berdasarkan Elo akhir attempt

    -- Tingkat kesulitan (dari UserChapter.currentDifficulty)
    difficulty_before     TEXT          NOT NULL,   -- Difficulty sebelum attempt ini
    difficulty_after      TEXT          NOT NULL,   -- Difficulty setelah attempt ini

    -- Alasan perubahan (enum + detail bebas)
    -- reason_code values:
    --   BAND_THRESHOLD_CROSSED_UP   : Rating naik melewati threshold band
    --   BAND_THRESHOLD_CROSSED_DOWN : Rating turun melewati threshold band
    --   RATING_INCREASED            : Rating naik tapi masih dalam band yang sama
    --   RATING_DECREASED            : Rating turun tapi masih dalam band yang sama
    --   STABLE                      : Rating tidak berubah
    reason_code           TEXT          NOT NULL,
    reason_detail         TEXT          NULL,       -- Deskripsi naratif opsional

    created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Indeks untuk query analisis
CREATE INDEX IF NOT EXISTS idx_adaptive_decision_student_id    ON adaptive_decision_logs (student_id);
CREATE INDEX IF NOT EXISTS idx_adaptive_decision_assessment_id ON adaptive_decision_logs (assessment_id);
CREATE INDEX IF NOT EXISTS idx_adaptive_decision_chapter_id    ON adaptive_decision_logs (chapter_id);
CREATE INDEX IF NOT EXISTS idx_adaptive_decision_student_time  ON adaptive_decision_logs (student_id, created_at);
CREATE INDEX IF NOT EXISTS idx_adaptive_decision_reason_code   ON adaptive_decision_logs (reason_code);


-- ============================================================
-- 3. QUESTION SELECTION LOGS
-- Pencatatan pemilihan soal yang diberikan kepada mahasiswa.
-- Membuktikan bahwa pemilihan soal berdasarkan Elo Rating adaptif.
-- ============================================================
CREATE TABLE IF NOT EXISTS question_selection_logs (
    id                      BIGSERIAL PRIMARY KEY,

    -- Identitas
    student_id              INTEGER       NOT NULL,   -- User.id
    assessment_id           INTEGER       NOT NULL,   -- AssessmentAttempt.id
    chapter_id              INTEGER       NOT NULL,   -- Chapter.id

    -- Rating mahasiswa saat pemilihan
    student_rating          INTEGER       NOT NULL,

    -- Rentang rating soal yang ditargetkan (dua kolom terpisah untuk analisis)
    target_rating_min       INTEGER       NOT NULL,   -- Batas bawah band Elo target
    target_rating_max       INTEGER       NOT NULL,   -- Batas atas band Elo target

    -- Soal yang dipilih
    selected_question_id    INTEGER       NULL,       -- Question.id (source bank), NULL jika pure AI
    selected_question_rating INTEGER      NOT NULL,   -- Rating soal yang dipilih

    -- Apakah attempt ini menggunakan soal yang di-generate oleh AI
    generated_by_ai         BOOLEAN       NOT NULL DEFAULT FALSE,

    created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Indeks untuk query analisis
CREATE INDEX IF NOT EXISTS idx_question_selection_student_id    ON question_selection_logs (student_id);
CREATE INDEX IF NOT EXISTS idx_question_selection_assessment_id ON question_selection_logs (assessment_id);
CREATE INDEX IF NOT EXISTS idx_question_selection_chapter_id    ON question_selection_logs (chapter_id);
CREATE INDEX IF NOT EXISTS idx_question_selection_student_time  ON question_selection_logs (student_id, created_at);


-- ============================================================
-- 4. STUDENT BAND HISTORY
-- Snapshot band kemampuan mahasiswa setiap kali attempt selesai.
-- Digunakan untuk visualisasi perkembangan kompetensi dari waktu ke waktu.
-- ============================================================
CREATE TABLE IF NOT EXISTS student_band_history (
    id                    BIGSERIAL PRIMARY KEY,

    -- Identitas
    student_id            INTEGER       NOT NULL,   -- User.id
    assessment_id         INTEGER       NOT NULL,   -- AssessmentAttempt.id
    chapter_id            INTEGER       NOT NULL,   -- Chapter.id

    -- Urutan assessment (per chapter, 1-indexed)
    assessment_number     INTEGER       NOT NULL,   -- Ke-N submission di chapter ini

    -- Snapshot Elo dan band
    elo_rating            INTEGER       NOT NULL,   -- Rating mahasiswa saat attempt selesai
    band                  TEXT          NOT NULL,   -- Band kemampuan berdasarkan elo_rating
    k_student             INTEGER       NOT NULL,   -- K-Factor mahasiswa pada saat itu

    timestamp             TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Indeks untuk query analisis
CREATE INDEX IF NOT EXISTS idx_student_band_history_student_id    ON student_band_history (student_id);
CREATE INDEX IF NOT EXISTS idx_student_band_history_assessment_id ON student_band_history (assessment_id);
CREATE INDEX IF NOT EXISTS idx_student_band_history_chapter_id    ON student_band_history (chapter_id);
CREATE INDEX IF NOT EXISTS idx_student_band_history_student_time  ON student_band_history (student_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_student_band_history_student_ch    ON student_band_history (student_id, chapter_id);


-- ============================================================
-- CATATAN PENGGUNAAN
-- ============================================================
-- Query contoh: Perkembangan Elo Rating mahasiswa per chapter
--   SELECT student_id, chapter_id, assessment_number, elo_rating, band, timestamp
--   FROM student_band_history
--   WHERE student_id = <id>
--   ORDER BY timestamp;

-- Query contoh: Pola pemilihan soal vs rating mahasiswa
--   SELECT qs.student_rating, qs.target_rating_min, qs.target_rating_max,
--          qs.selected_question_rating, qs.generated_by_ai
--   FROM question_selection_logs qs
--   WHERE qs.student_id = <id>
--   ORDER BY qs.created_at;

-- Query contoh: Keputusan adaptif per mahasiswa
--   SELECT student_band_before, student_band_after, reason_code, reason_detail, created_at
--   FROM adaptive_decision_logs
--   WHERE student_id = <id>
--   ORDER BY created_at;
