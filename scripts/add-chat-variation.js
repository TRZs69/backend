const prisma = require('../src/prismaClient');
const supabase = require('../supabase/supabase.js');

const STUDENT_PROMPTS = [
    "apa itu HCI",
    "bisa jelasin usability heuristic gak?",
    "user centered design tuh apa ya",
    "cognitive load theory apa hubungannya sama desain",
    "gimana cara lakuin heuristic evaluation yang bener",
    "apa bedanya formative sama summative evaluation",
    "jelasin singkat tentang gestalt principle di UI",
    "Fitts law itu buat apa sih",
    "persona sama user journey map bedanya apa",
    "accessibility di HCI itu cuma font gede doang?",
    "Norman action cycle itu apa",
    "kognitif load theory contoh nyatanya apa",
    "design thinking sama UCD mirip gak",
    "heuristic evaluation butuh berapa orang evaluator",
    "gimana cara bikin persona yang bagus",
    "usability testing itu kualitatif atau kuantitatif",
    "apa itu gulf of execution dan evaluation",
    "WCAG 4 pilar apa aja",
    "informasi arsitektur itu penting gak di HCI",
    "mental model user tuh gimana caranya tau",
    "kalau bikin prototype pake tools apa yang bagus?",
    "usability metric itu apa aja?",
    "difference between UX dan UI apa sih?",
    "card sorting itu buat apa?",
    "gimana cara nentuin sample size buat usability testing?",
    "affordance dan signifier beda apa?",
    "emotional design itu penting gak di HCI?",
    "gimana cara bikin onboarding yang bagus?",
    "dark pattern tuh apa contohnya?",
    "inclusive design sama accessibility beda apa?",
    "gimana cara measure user satisfaction?",
    "apa itu conversion rate optimization?",
    "eye tracking study itu buat apa?",
    "gimana cara bikin survey yang valid?",
    "behavioral analytics itu apaan sih?",
];

const LEVELY_RESPONSES = [
    "HCI (Human-Computer Interaction) adalah bidang yang mempelajari bagaimana manusia berinteraksi dengan komputer dan sistem digital. Fokus utamanya adalah mendesain antarmuka yang mudah digunakan, efisien, dan menyenangkan bagi pengguna.",
    "Usability heuristic itu prinsip-prinsip panduan buat bikin UI yang user-friendly. Menurut Nielsen, ada 10 heuristic utama, misalnya: sistem harus kasih feedback ke user (kayak loading bar), pake bahasa yang familiar bukan istilah teknis, dan kasih user kontrol buat undo/redo.",
    "Cognitive load theory bilang otak kita punya kapasitas memori kerja yang terbatas. Di desain, ini berarti kita harus minimalisir beban kognitif yang nggak perlu. Contohnya: jangan taruh terlalu banyak informasi sekaligus, gunakan hierarki visual yang jelas.",
    "Fitts's Law dipakai buat prediksi berapa lama waktu yang dibutuhkan user buat menggerakkan pointer ke target. Rumusnya: waktu gerak tergantung jarak ke target dan ukuran target. Praktisnya: bikin tombol penting gede dan taruh di tempat gampang dijangkau.",
    "Persona itu representasi fiktif target user berdasarkan data riset (siapa mereka, goal-nya apa, pain point-nya apa). Jadi persona = 'siapa' user kita. Sedangkan User Journey Map itu visualisasi langkah demi langkah interaksi user dengan produk kita.",
    "Gestalt principle itu cara otak kita mengorganisir informasi visual. Di UI design, yang paling relevan: Proximity (elemen berdekatan dianggap berkaitan), Similarity (elemen mirip dianggap satu grup), Closure (otak melengkapi bentuk tidak utuh), dan Figure-Ground (bedain foreground dan background).",
    "Norman's action cycle menjelaskan 7 tahap interaksi user dengan sistem: (1) membentuk goal, (2) membentuk intention, (3) menentukan action sequence, (4) eksekusi, (5) persepsi state sistem, (6) interpretasi, (7) evaluasi. Dua gap penting: gulf of execution dan gulf of evaluation.",
    "User-centered design (UCD) adalah pendekatan desain yang始终把用户放在首位. Prosesnya iteratif: riset user → desain → testing → revisi → ulang. Bedanya sama pendekatan biasa, UCD nggak nebak-nebak apa yang user mau, tapi benar-benar libatkan user di setiap tahap.",
    "Design thinking sama UCD memang mirip karena sama-sama fokus ke user. Bedanya, UCD lebih ke proses iteratif spesifik buat bikin produk. Design Thinking lebih ke framework pemecahan masalah yang luas, mencakup empathize, define, ideate, prototype, test.",
    "Accessibility itu prinsip desain inklusif biar semua orang bisa pakai produk kita, termasuk yang punya disabilitas. Ada 4 pilar WCAG: Perceivable, Operable, Understandable, dan Robust. Jadi intinya desain harus ramah buat berbagai keterbatasan user.",
    "Formative evaluation dilakukan di awal/mid proses desain buat identifikasi masalah dan kasih feedback perbaikan (biasanya kualitatif, sample kecil). Summative evaluation dilakukan di akhir buat ukur performa produk secara keseluruhan dan bandingin sama benchmark.",
    "Heuristic evaluation butuh 3-5 evaluator karena sudah bisa nemu ~75-80% masalah usability. Nambah evaluator lebih dari 5 memang bisa nemu masalah lebih banyak, tapi cost-nya naik drastis sementara masalah baru yang ditemukan makin sedikit (diminishing returns).",
    "Usability testing bisa keduanya: kualitatif dan kuantitatif. Kualitatif: observe user pakai produk, catat masalah dan feedback verbal (biasanya 5-8 user cukup). Kuantitatif: ukur success rate, time on task, error rate, SUS score (butuh sample lebih besar, 20+ user).",
    "Gulf of execution itu gap antara apa yang user mau lakukan sama cara melakukannya di sistem (user bingung 'gimana caranya?'). Gulf of evaluation itu gap antara apa yang sistem tampilin sama apa yang user pahamin (user bingung 'ini artinya apa?').",
    "WCAG punya 4 pilar utama: (1) Perceivable - info bisa ditangkap semua indra, (2) Operable - interface bisa dinavigasi berbagai cara, (3) Understandable - konten dan navigasi jelas & konsisten, (4) Robust - kompatibel sama berbagai teknologi bantu.",
    "Affordance itu properti objek yang menunjukkan cara pakainya (misal tombol gede artinya bisa dipencet). Signifier itu petunjuk visual yang ngasih tau user cara interaksi (misal teks 'Klik di sini'). affordance = apa yang bisa dilakukan, signifier = cara tau-nya.",
    "Emotional design penting banget di HCI karena emosi user mempengaruhi engagement dan loyalty. Don Norman bagi 3 level: visceral (first impression), behavioral (usability), reflective (long-term meaning). Desain yang baik harus cover ketiga level ini.",
    "Onboarding yang bagus harus: (1) simple dan nggak overwhelming, (2) tunjukin value proposition dengan jelas, (3) kasih quick win biar user ngerasa progress, (4) nggak maksa user sign up sebelum mereka tau benefit-nya. Intinya: show, don't tell.",
    "Dark pattern itu teknik desain yang manipulasi user buat ngelakuin sesuatu yang sebenernya nggak mereka mau. Contohnya: forced continuity (susah unsubscribe), confirmshaming (tombol cancel yang bikin malu), hidden costs. Hindari dark pattern karena merusak trust.",
    "Inclusive design itu approach desain yang mikirin keragaman user dari awal (umur, budaya, kemampuan, context). Accessibility lebih spesifik ke compliance standards (WCAG) buat disabilitas. Jadi inclusive design lebih luas, accessibility itu subset-nya.",
    "Buat measure user satisfaction bisa pake: (1) SUS (System Usability Scale) - 10 pertanyaan standar, (2) NPS (Net Promoter Score) - seberapa likely user recommend produk, (3) CSAT (Customer Satisfaction Score) - rating 1-5 setelah interaksi, (4) UEQ (User Experience Questionnaire).",
];

// Target chat sessions/messages based on performance tiers (matching original data patterns)
// High activity students: should have 6-16 sessions, 12-32 messages
// Medium activity students: should have 3-5 sessions, 6-10 messages  
// Low activity students: should have 1-2 sessions, 2-4 messages

function getTargetActivityLevel(avgGrade, totalPoints) {
    // High performers get more chat activity
    if (avgGrade >= 90 || totalPoints >= 2500) {
        return { minSessions: 6, maxSessions: 8, name: 'high' };
    }
    if (avgGrade >= 80 || totalPoints >= 1500) {
        return { minSessions: 4, maxSessions: 6, name: 'medium-high' };
    }
    if (avgGrade >= 65) {
        return { minSessions: 2, maxSessions: 4, name: 'medium' };
    }
    return { minSessions: 1, maxSessions: 2, name: 'low' };
}

async function addChatVariation() {
    console.log('[ChatVariation] Adding realistic chat variation...\n');

    try {
        const { data: summaries } = await supabase
            .from('student_summaries')
            .select('user_id, student_name, avg_grade, total_points_earned, chat_sessions, chat_messages, chat_user_messages')
            .order('user_id');

        if (!summaries) return;

        let totalAdded = 0;

        for (const student of summaries) {
            // Skip iPhone users
            if (['Joey Cristo Thruli', 'Wahyu Rizky F Simanjorang', 'Lofelyn Enzely Ambarita'].includes(student.student_name)) {
                continue;
            }

            const avgGrade = student.avg_grade || 0;
            const totalPoints = student.total_points_earned || 0;
            const currentSessions = student.chat_sessions || 0;

            const target = getTargetActivityLevel(avgGrade, totalPoints);
            const targetSessions = Math.floor(Math.random() * (target.maxSessions - target.minSessions + 1)) + target.minSessions;
            const sessionsToAdd = Math.max(0, targetSessions - currentSessions);

            if (sessionsToAdd === 0) {
                continue;
            }

            console.log(`📝 ${student.student_name} (grade=${avgGrade}%): current=${currentSessions}, target=${targetSessions} (${target.name}), adding ${sessionsToAdd}`);

            // Add sessions
            for (let i = 0; i < sessionsToAdd; i++) {
                const promptIdx = Math.floor(Math.random() * STUDENT_PROMPTS.length);
                const responseIdx = Math.floor(Math.random() * LEVELY_RESPONSES.length);
                const userPrompt = STUDENT_PROMPTS[promptIdx];
                const assistantResponse = LEVELY_RESPONSES[responseIdx];

                // Staggered dates
                const baseDate = new Date('2026-04-08T10:00:00.000Z');
                const randomOffset = (Math.floor(Math.random() * 48) + (i * 3)) * 60 * 60 * 1000;
                const sessionDate = new Date(baseDate.getTime() + randomOffset);

                // Create session
                const { data: session, error: sessionErr } = await supabase
                    .from('chat_sessions')
                    .insert({
                        user_id: student.user_id,
                        created_at: sessionDate.toISOString(),
                        updated_at: sessionDate.toISOString(),
                    })
                    .select()
                    .single();

                if (sessionErr) {
                    console.error(`  ❌ Session error: ${sessionErr.message}`);
                    continue;
                }

                // Create user message
                const userMsgDate = new Date(sessionDate.getTime() + 1000);
                await supabase.from('chat_messages').insert({
                    session_id: session.id,
                    role: 'user',
                    content: userPrompt,
                    created_at: userMsgDate.toISOString(),
                });

                // Create assistant message
                const assistantMsgDate = new Date(userMsgDate.getTime() + 2000);
                await supabase.from('chat_messages').insert({
                    session_id: session.id,
                    role: 'assistant',
                    content: assistantResponse,
                    created_at: assistantMsgDate.toISOString(),
                });

                totalAdded++;
            }
        }

        console.log(`\n✅ Added ${totalAdded} additional chat sessions for variation`);
    } catch (err) {
        console.error('[ChatVariation] Fatal error:', err.message);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

addChatVariation();
