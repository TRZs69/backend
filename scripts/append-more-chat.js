const prisma = require('../src/prismaClient');
const supabase = require('../supabase/supabase.js');

// Natural student prompts
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
];

// Natural Levely responses (Indonesian, semi-formal)
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
];

async function addMoreChatSessions() {
    console.log('[AppendChat] Adding additional chat sessions for variation...\n');

    try {
        // Get all students with their current stats
        const { data: summaries } = await supabase
            .from('student_summaries')
            .select('user_id, student_name, avg_grade, total_points_earned, sdt_autonomy_score')
            .order('user_id');

        if (!summaries) {
            console.error('❌ Could not fetch summaries');
            return;
        }

        console.log(`Found ${summaries.length} students\n`);

        let totalAdded = 0;

        for (const student of summaries) {
            // Skip iPhone users
            if (['Joey Cristo Thruli', 'Wahyu Rizky F Simanjorang', 'Lofelyn Enzely Ambarita'].includes(student.student_name)) {
                continue;
            }

            // Determine additional sessions based on performance
            const grade = student.avg_grade || 0;
            const points = student.total_points_earned || 0;

            let additionalSessions = 0;

            // High performers: 2-3 additional sessions
            if (grade >= 85 || points >= 2000) {
                additionalSessions = Math.floor(Math.random() * 2) + 2; // 2-3
            }
            // Mid-high: 1-2 additional
            else if (grade >= 70) {
                additionalSessions = Math.floor(Math.random() * 2) + 1; // 1-2
            }
            // Mid: 0-1 additional
            else if (grade >= 55) {
                additionalSessions = Math.random() > 0.5 ? 1 : 0;
            }
            // Low: 0 additional (keep minimal)
            else {
                additionalSessions = 0;
            }

            // Skip if no additional sessions needed
            if (additionalSessions === 0) {
                continue;
            }

            console.log(`📝 ${student.student_name} (grade=${grade}%): +${additionalSessions} session(s)`);

            // Generate additional sessions
            for (let i = 0; i < additionalSessions; i++) {
                const promptIdx = Math.floor(Math.random() * STUDENT_PROMPTS.length);
                const responseIdx = Math.floor(Math.random() * LEVELY_RESPONSES.length);
                const userPrompt = STUDENT_PROMPTS[promptIdx];
                const assistantResponse = LEVELY_RESPONSES[responseIdx];

                // Random date within evaluation period (staggered)
                const baseDate = new Date('2026-04-08T10:00:00.000Z');
                const randomOffset = (Math.floor(Math.random() * 48) + (i * 5)) * 60 * 60 * 1000;
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

        console.log(`\n✅ Added ${totalAdded} additional chat sessions total`);
    } catch (err) {
        console.error('[AppendChat] Fatal error:', err.message);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

addMoreChatSessions();
