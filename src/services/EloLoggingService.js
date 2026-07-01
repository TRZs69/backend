'use strict';

/**
 * EloLoggingService
 *
 * Service append-only untuk mencatat seluruh data evaluasi adaptif ke Supabase.
 * Digunakan untuk mendukung analisis pada Bab 6 Tugas Akhir (LeveLearn).
 *
 * Semua fungsi bersifat fire-and-forget: error internal tidak melempar exception
 * ke caller, sehingga logging tidak memblokir atau merusak alur utama aplikasi.
 *
 * Tabel yang dikelola (lihat supabase/evaluation_logs.sql):
 *   - assessment_logs         : interaksi mahasiswa per soal objektif
 *   - adaptive_decision_logs  : keputusan DDA setelah attempt selesai
 *   - question_selection_logs : pemilihan soal per interaksi
 *   - student_band_history    : snapshot band kemampuan per attempt selesai
 */

const supabase = require('../../supabase/supabase.js');

// ── Konstanta nama tabel ──────────────────────────────────────────────────────
const TABLE = Object.freeze({
    ASSESSMENT_LOGS:       'assessment_logs',
    ADAPTIVE_DECISION_LOGS: 'adaptive_decision_logs',
    QUESTION_SELECTION_LOGS: 'question_selection_logs',
    STUDENT_BAND_HISTORY:  'student_band_history',
});

// ── Enum reason_code untuk adaptive_decision_logs ────────────────────────────
const REASON_CODE = Object.freeze({
    BAND_THRESHOLD_CROSSED_UP:   'BAND_THRESHOLD_CROSSED_UP',
    BAND_THRESHOLD_CROSSED_DOWN: 'BAND_THRESHOLD_CROSSED_DOWN',
    RATING_INCREASED:            'RATING_INCREASED',
    RATING_DECREASED:            'RATING_DECREASED',
    STABLE:                      'STABLE',
});

// ── Helper internal ───────────────────────────────────────────────────────────

/**
 * Menentukan reason_code dan reason_detail berdasarkan perubahan Elo dan band.
 * @param {number} eloStart  - Elo mahasiswa sebelum attempt
 * @param {number} eloEnd    - Elo mahasiswa setelah attempt
 * @param {string} bandBefore - Band sebelum attempt
 * @param {string} bandAfter  - Band setelah attempt
 * @returns {{ reasonCode: string, reasonDetail: string }}
 */
function resolveAdaptiveReason(eloStart, eloEnd, bandBefore, bandAfter) {
    const bandChanged   = bandBefore !== bandAfter;
    const eloIncreased  = eloEnd > eloStart;
    const eloDecreased  = eloEnd < eloStart;

    if (bandChanged && eloIncreased) {
        return {
            reasonCode:   REASON_CODE.BAND_THRESHOLD_CROSSED_UP,
            reasonDetail: `Rating naik dari ${eloStart} ke ${eloEnd}; band berubah dari "${bandBefore}" ke "${bandAfter}"`,
        };
    }
    if (bandChanged && eloDecreased) {
        return {
            reasonCode:   REASON_CODE.BAND_THRESHOLD_CROSSED_DOWN,
            reasonDetail: `Rating turun dari ${eloStart} ke ${eloEnd}; band berubah dari "${bandBefore}" ke "${bandAfter}"`,
        };
    }
    if (eloIncreased) {
        return {
            reasonCode:   REASON_CODE.RATING_INCREASED,
            reasonDetail: `Rating naik dari ${eloStart} ke ${eloEnd}; band "${bandAfter}" dipertahankan`,
        };
    }
    if (eloDecreased) {
        return {
            reasonCode:   REASON_CODE.RATING_DECREASED,
            reasonDetail: `Rating turun dari ${eloStart} ke ${eloEnd}; band "${bandAfter}" dipertahankan`,
        };
    }
    return {
        reasonCode:   REASON_CODE.STABLE,
        reasonDetail: `Rating tidak berubah (${eloStart}); band "${bandAfter}" dan kesulitan dipertahankan`,
    };
}

// ── Fungsi logging publik ─────────────────────────────────────────────────────

/**
 * Mencatat satu interaksi mahasiswa–soal (hasil duel Elo).
 * Dipanggil untuk setiap soal objektif yang dijawab dalam mode interaktif.
 *
 * @param {object} params
 * @param {number}  params.assessmentId         - AssessmentAttempt.id
 * @param {number}  params.studentId            - User.id
 * @param {number}  params.chapterId            - Chapter.id
 * @param {number|null} params.questionId       - Question.id (bank), null jika AI-generated
 * @param {number}  params.studentRatingBefore  - Rating mahasiswa sebelum soal ini
 * @param {number}  params.studentRatingAfter   - Rating mahasiswa sesudah pembaruan
 * @param {number}  params.questionRatingBefore - Rating soal sebelum interaksi
 * @param {number}  params.questionRatingAfter  - Rating soal sesudah pembaruan
 * @param {number}  params.expectedScore        - Probabilitas Elo P(s,i)
 * @param {0|1}     params.actualScore          - 1 = benar, 0 = salah
 * @param {number}  params.kStudent             - K-Factor mahasiswa
 * @param {number}  params.kQuestion            - K-Factor soal
 * @param {string}  params.difficultyLevel      - Nama band Elo soal (e.g. 'Beginner')
 */
async function logAssessmentInteraction({
    assessmentId,
    studentId,
    chapterId,
    questionId,
    studentRatingBefore,
    studentRatingAfter,
    questionRatingBefore,
    questionRatingAfter,
    expectedScore,
    actualScore,
    kStudent,
    kQuestion,
    difficultyLevel,
}) {
    try {
        const { error } = await supabase.from(TABLE.ASSESSMENT_LOGS).insert({
            assessment_id:          assessmentId,
            student_id:             studentId,
            chapter_id:             chapterId,
            question_id:            questionId ?? null,
            student_rating_before:  studentRatingBefore,
            student_rating_after:   studentRatingAfter,
            question_rating_before: questionRatingBefore,
            question_rating_after:  questionRatingAfter,
            expected_score:         expectedScore,
            actual_score:           actualScore,
            k_student:              kStudent,
            k_question:             kQuestion,
            difficulty_level:       difficultyLevel,
            created_at:             new Date().toISOString(),
        });
        if (error) {
            console.error('[EloLoggingService] logAssessmentInteraction error:', error.message);
        }
    } catch (err) {
        console.error('[EloLoggingService] logAssessmentInteraction exception:', err.message);
    }
}

/**
 * Mencatat keputusan adaptif setelah attempt selesai.
 * Merekam transisi band kemampuan dan alasan perubahan tingkat kesulitan.
 *
 * @param {object} params
 * @param {number}  params.studentId        - User.id
 * @param {number}  params.assessmentId     - AssessmentAttempt.id
 * @param {number}  params.chapterId        - Chapter.id
 * @param {string}  params.studentBandBefore - Band berdasarkan Elo awal attempt
 * @param {string}  params.studentBandAfter  - Band berdasarkan Elo akhir attempt
 * @param {string}  params.difficultyBefore  - Difficulty dari UserChapter sebelum attempt
 * @param {string}  params.difficultyAfter   - Difficulty yang disimpan setelah attempt
 * @param {number}  params.eloStart         - Elo awal attempt (untuk kalkulasi reason)
 * @param {number}  params.eloEnd           - Elo akhir attempt (untuk kalkulasi reason)
 */
async function logAdaptiveDecision({
    studentId,
    assessmentId,
    chapterId,
    studentBandBefore,
    studentBandAfter,
    difficultyBefore,
    difficultyAfter,
    eloStart,
    eloEnd,
}) {
    try {
        const { reasonCode, reasonDetail } = resolveAdaptiveReason(
            eloStart, eloEnd, studentBandBefore, studentBandAfter,
        );

        const { error } = await supabase.from(TABLE.ADAPTIVE_DECISION_LOGS).insert({
            student_id:          studentId,
            assessment_id:       assessmentId,
            chapter_id:          chapterId,
            student_band_before: studentBandBefore,
            student_band_after:  studentBandAfter,
            difficulty_before:   difficultyBefore,
            difficulty_after:    difficultyAfter,
            reason_code:         reasonCode,
            reason_detail:       reasonDetail,
            created_at:          new Date().toISOString(),
        });
        if (error) {
            console.error('[EloLoggingService] logAdaptiveDecision error:', error.message);
        }
    } catch (err) {
        console.error('[EloLoggingService] logAdaptiveDecision exception:', err.message);
    }
}

/**
 * Mencatat pemilihan soal yang diberikan kepada mahasiswa.
 * Membuktikan mekanisme seleksi soal berbasis Elo Rating.
 *
 * @param {object} params
 * @param {number}  params.studentId             - User.id
 * @param {number}  params.assessmentId          - AssessmentAttempt.id
 * @param {number}  params.chapterId             - Chapter.id
 * @param {number}  params.studentRating         - Rating mahasiswa saat pemilihan soal
 * @param {number}  params.targetRatingMin       - Batas bawah band Elo yang ditargetkan
 * @param {number}  params.targetRatingMax       - Batas atas band Elo yang ditargetkan
 * @param {number|null} params.selectedQuestionId    - Question.id (bank), null jika pure AI
 * @param {number}  params.selectedQuestionRating    - Rating soal yang dipilih
 * @param {boolean} params.generatedByAi         - true jika attempt source = GENERATED
 */
async function logQuestionSelection({
    studentId,
    assessmentId,
    chapterId,
    studentRating,
    targetRatingMin,
    targetRatingMax,
    selectedQuestionId,
    selectedQuestionRating,
    generatedByAi,
}) {
    try {
        const { error } = await supabase.from(TABLE.QUESTION_SELECTION_LOGS).insert({
            student_id:              studentId,
            assessment_id:           assessmentId,
            chapter_id:              chapterId,
            student_rating:          studentRating,
            target_rating_min:       targetRatingMin,
            target_rating_max:       targetRatingMax,
            selected_question_id:    selectedQuestionId ?? null,
            selected_question_rating: selectedQuestionRating,
            generated_by_ai:         Boolean(generatedByAi),
            created_at:              new Date().toISOString(),
        });
        if (error) {
            console.error('[EloLoggingService] logQuestionSelection error:', error.message);
        }
    } catch (err) {
        console.error('[EloLoggingService] logQuestionSelection exception:', err.message);
    }
}

/**
 * Mencatat snapshot band kemampuan mahasiswa saat attempt selesai.
 * Digunakan untuk visualisasi perkembangan kompetensi dari waktu ke waktu.
 *
 * @param {object} params
 * @param {number}  params.studentId        - User.id
 * @param {number}  params.assessmentId     - AssessmentAttempt.id
 * @param {number}  params.chapterId        - Chapter.id
 * @param {number}  params.assessmentNumber - Urutan submission di chapter ini (1-indexed)
 * @param {number}  params.eloRating        - Rating mahasiswa saat attempt selesai
 * @param {string}  params.band             - Nama band berdasarkan eloRating
 * @param {number}  params.kStudent         - K-Factor mahasiswa pada saat itu
 */
async function logStudentBandHistory({
    studentId,
    assessmentId,
    chapterId,
    assessmentNumber,
    eloRating,
    band,
    kStudent,
}) {
    try {
        const { error } = await supabase.from(TABLE.STUDENT_BAND_HISTORY).insert({
            student_id:        studentId,
            assessment_id:     assessmentId,
            chapter_id:        chapterId,
            assessment_number: assessmentNumber,
            elo_rating:        eloRating,
            band,
            k_student:         kStudent,
            timestamp:         new Date().toISOString(),
        });
        if (error) {
            console.error('[EloLoggingService] logStudentBandHistory error:', error.message);
        }
    } catch (err) {
        console.error('[EloLoggingService] logStudentBandHistory exception:', err.message);
    }
}

// ── Exports ───────────────────────────────────────────────────────────────────
module.exports = {
    TABLE,
    REASON_CODE,
    logAssessmentInteraction,
    logAdaptiveDecision,
    logQuestionSelection,
    logStudentBandHistory,
};
