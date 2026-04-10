const prisma = require('../src/prismaClient');
const supabase = require('../supabase/supabase.js');
const { GoogleAIClient } = require('../src/services/GoogleAIClient');

const IPHONE_USERS = ['Joey Cristo Thruli', 'Wahyu Rizky F Simanjorang', 'Lofelyn Enzely Ambarita'];

// Natural student prompts based on real chat patterns
const NATURAL_STUDENT_PROMPTS = [
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
];

// Natural Levely-style responses (fallback when LLM fails)
// Written to match Levely's actual response style: concise, Indonesian, helpful
const NATURAL_LEVELY_RESPONSES = {
    "apa itu HCI": "HCI (Human-Computer Interaction) adalah bidang yang mempelajari bagaimana manusia berinteraksi dengan komputer dan sistem digital. Fokus utamanya adalah mendesain antarmuka yang mudah digunakan, efisien, dan menyenangkan bagi pengguna. Jadi intinya, HCI bikin teknologi lebih 'manusiawi'.",
    "bisa jelasin usability heuristic gak?": "Usability heuristic itu prinsip-prinsip panduan buat bikin UI yang user-friendly. Menurut Nielsen, ada 10 heuristic utama, misalnya: sistem harus kasih feedback ke user (kayak loading bar), pake bahasa yang familiar bukan istilah teknis, dan kasih user kontrol buat undo/redo. Intinya checklist biar desain kita nggak bikin user bingung.",
    "user centered design tuh apa ya": "User-centered design (UCD) adalah pendekatan desain yang始终把用户放在首位. Prosesnya iteratif: riset user → desain → testing → revisi → ulang. Bedanya sama pendekatan biasa, UCD nggak nebak-nebak apa yang user mau, tapi benar-benar libatkan user di setiap tahap. Jadi produk akhirnya beneran sesuai kebutuhan mereka.",
    "cognitive load theory apa hubungannya sama desain": "Cognitive load theory bilang otak kita punya kapasitas memori kerja yang terbatas. Di desain, ini berarti kita harus minimalisir beban kognitif yang nggak perlu. Contohnya: jangan taruh terlalu banyak informasi sekaligus, gunakan hierarki visual yang jelas, dan hindari distraksi. Jadi user bisa fokus ke hal yang penting aja.",
    "gimana cara lakuin heuristic evaluation yang bener": "Buat heuristic evaluation yang efektif: (1) Siapin 3-5 evaluator, (2) Masing-masing cek interface secara independen pake 10 prinsip Nielsen, (3) Catat setiap violation + kasih severity rating 1-5, (4) Gabungin semua temuan, (5) Prioritaskan fix berdasarkan severity. Semakin banyak evaluator, semakin banyak masalah yang ke-detect.",
    "apa bedanya formative sama summative evaluation": "Formative evaluation dilakukan di awal/mid proses desain buat identifikasi masalah dan kasih feedback perbaikan (biasanya kualitatif, sample kecil). Summative evaluation dilakukan di akhir buat ukur performa produk secara keseluruhan dan bandingin sama benchmark (biasanya kuantitatif, sample lebih besar). Jadi formative = memperbaiki, summative = mengukur.",
    "jelasin singkat tentang gestalt principle di UI": "Gestalt principle itu cara otak kita mengorganisir informasi visual. Di UI design, yang paling relevan: (1) Proximity - elemen berdekatan dianggap berkaitan, (2) Similarity - elemen mirip dianggap satu grup, (3) Closure - otak melengkapi bentuk tidak utuh, (4) Figure-Ground - bedain foreground dan background. Prinsip ini bikin interface lebih mudah dipahami.",
    "Fitts law itu buat apa sih": "Fitts's Law dipakai buat prediksi berapa lama waktu yang dibutuhkan user buat menggerakkan pointer ke target. Rumusnya: waktu gerak tergantung jarak ke target dan ukuran target. Praktisnya: bikin tombol penting gede dan taruh di tempat gampang dijangkau (misal pojok bawah di mobile). Makanya tombol 'Beli' di e-commerce selalu gede.",
    "persona sama user journey map bedanya apa": "Persona itu representasi fiktif target user berdasarkan data riset (siapa mereka, goal-nya apa, pain point-nya apa). Jadi persona = 'siapa' user kita. User Journey Map itu visualisasi langkah demi langkah interaksi user dengan produk dari awal sampai akhir, termasuk emosi dan touchpoint-nya. Jadi journey map = 'bagaimana' user berinteraksi. Biasanya persona dibuat dulu, baru journey map-nya.",
    "accessibility di HCI itu cuma font gede doang?": "Nggak cuma font gede! Accessibility itu prinsip desain inklusif biar semua orang bisa pakai produk kita, termasuk yang punya disabilitas. Ada 4 pilar WCAG: Perceivable (info bisa ditangkap semua indra), Operable (bisa dinavigasi tanpa mouse), Understandable (bahasa jelas & konsisten), dan Robust (kompatibel sama screen reader). Jadi intinya desain harus ramah buat berbagai keterbatasan user.",
    "Norman action cycle itu apa": "Norman's action cycle menjelaskan 7 tahap interaksi user dengan sistem: (1) membentuk goal, (2) membentuk intention, (3) menentukan action sequence, (4) eksekusi, (5) persepsi state sistem, (6) interpretasi, (7) evaluasi. Dua gap penting: gulf of execution (user bingung cara pakai) dan gulf of evaluation (user bingung ngerti hasilnya). Desain yang baik meminimalkan kedua gap ini.",
    "kognitif load theory contoh nyatanya apa": "Contoh cognitive load theory di aplikasi nyata: (1) Tutorial yang step-by-step, bukan langsung semua info sekaligus (kurangi intrinsic load), (2) Layout yang bersih tanpa distraksi visual (kurangi extraneous load), (3) Progress bar yang jelas biar user tau udah sampe mana (bantu germane load). Intinya, bikin user nggak kebanjiran informasi.",
    "design thinking sama UCD mirip gak": "Secara konsep memang tumpang tindih karena sama-sama fokus ke user. Bedanya, UCD lebih ke proses iteratif spesifik buat bikin produk (research → design → test → ulang). Design Thinking lebih ke framework pemecahan masalah yang luas, mencakup empathize, define, ideate, prototype, test. Jadi Design Thinking bisa jadi payungnya, UCD lebih ke praktik desainnya langsung.",
    "heuristic evaluation butuh berapa orang evaluator": "Nielsen merekomendasikan 3-5 evaluator karena sudah bisa nemu ~75-80% masalah usability. Nambah evaluator lebih dari 5 memang bisa nemu masalah lebih banyak, tapi cost-nya naik drastis sementara masalah baru yang ditemukan makin sedikit (diminishing returns). Jadi kalau resources terbatas, 3 evaluator sudah cukup oke. Kalau mau lebih komprehensif, 5 itu sweet spot-nya.",
    "gimana cara bikin persona yang bagus": "Buat persona yang bagus: (1) Kumpulin data dari riset user (interview, survey, analytics), (2) Identifikasi pola perilaku dan goal yang mirip, (3) Gabungin jadi 3-5 persona representatif, (4) Kasih nama, foto, bio singkat, goal, dan pain point, (5) Validasi sama stakeholder. Persona harus berdasarkan data nyata, bukan asumsi. Dan jangan bikin terlalu banyak, nanti malah nggak fokus.",
    "usability testing itu kualitatif atau kuantitatif": "Usability testing bisa keduanya. Kualitatif: observe user pakai produk, catat masalah dan feedback verbal (biasanya 5-8 user cukup). Kuantitatif: ukur success rate, time on task, error rate, SUS score (butuh sample lebih besar, 20+ user). Idealnya kombinasikan: kuantitatif buat identifikasi pola masalah, kualitatif buat pahami kenapa masalah itu terjadi.",
    "apa itu gulf of execution dan evaluation": "Gulf of execution itu gap antara apa yang user mau lakukan sama cara melakukannya di sistem (user bingung 'gimana caranya?'). Gulf of evaluation itu gap antara apa yang sistem tampilin sama apa yang user pahamin (user bingung 'ini artinya apa?'). Desain yang baik meminimalkan kedua gulf ini biar interaksi lebih smooth dan intuitif.",
    "WCAG 4 pilar apa aja": "WCAG punya 4 pilar utama: (1) Perceivable - informasi harus bisa ditangkap semua indra (misal alt text, caption video), (2) Operable - interface harus bisa dinavigasi berbagai cara (keyboard, screen reader), (3) Understandable - konten dan navigasi harus jelas & konsisten, (4) Robust - kompatibel sama berbagai teknologi bantu dan browser. Keempatnya bikin web accessible buat semua orang.",
    "informasi arsitektur itu penting gak di HCI": "Penting banget! Information architecture (IA) itu cara mengorganisir dan melabeli konten biar user gampang nemu apa yang dicari. Tanpa IA yang baik, user bakal bingung navigasi, bahkan kalau desain visualnya bagus sekalipun. Contoh IA: menu kategori di e-commerce, breadcrumb navigation, search functionality. Jadi IA itu fondasi UX yang baik.",
    "mental model user tuh gimana caranya tau": "Mental model itu pemahaman user tentang cara kerja sistem. Buat tau mental model mereka: (1) Conduct user interviews - tanya gimana mereka mikir prosesnya jalan, (2) Card sorting - lihat gimana user ngelompokkan informasi, (3) Observasi langsung saat user pakai produk, (4) Analisis search terms dan error patterns. Tujuannya: desain sistem yang match sama ekspektasi user, bukan sebaliknya.",
};

const SYSTEM_PROMPT = [
    'You are Levely, an Indonesian learning assistant for LeveLearn.',
    'Answer in Indonesian unless the user explicitly asks for another language.',
    'Prioritize correctness, clarity, and relevance over sounding overly enthusiastic.',
    'Keep answers concise by default.',
].join(' ');

function initLLMClient() {
    const apiKey = (process.env.LEVELY_GEMINI_API_KEY || '').trim();
    const model = process.env.LEVELY_GEMINI_MODEL || 'gemma-3-12b-it';
    const baseUrl = process.env.LEVELY_GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/models';

    if (!apiKey) {
        console.error('⚠️  LEVELY_GEMINI_API_KEY not found');
        return null;
    }

    return new GoogleAIClient({ apiKey, model, baseUrl });
}

async function generateChatDataHybrid() {
    console.log('[HybridChat] Generating chat data (LLM with fallback)...\n');

    const llmClient = initLLMClient();

    try {
        const students = await prisma.user.findMany({
            where: { role: 'STUDENT' },
            select: { id: true, name: true },
        });

        console.log(`Found ${students.length} students\n`);

        let llmCount = 0;
        let fallbackCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const student of students) {
            if (IPHONE_USERS.includes(student.name)) {
                console.log(`⏭ Skipped (iPhone): ${student.name}`);
                skippedCount++;
                continue;
            }

            // Check if already has chat data
            const { data: existingSessions } = await supabase
                .from('chat_sessions')
                .select('id')
                .eq('user_id', student.id)
                .gte('created_at', '2026-03-26T00:00:00.000Z')
                .lte('created_at', '2026-04-09T23:59:59.999Z');

            if (existingSessions && existingSessions.length > 0) {
                const sessionIds = existingSessions.map(s => s.id);
                const { data: existingMessages } = await supabase
                    .from('chat_messages')
                    .select('id')
                    .in('session_id', sessionIds);

                if (existingMessages && existingMessages.length > 0) {
                    console.log(`⏭ Skipped (has chat data): ${student.name}`);
                    skippedCount++;
                    continue;
                }
            }

            const userPrompt = NATURAL_STUDENT_PROMPTS[Math.floor(Math.random() * NATURAL_STUDENT_PROMPTS.length)];
            const baseDate = new Date('2026-04-08T10:00:00.000Z');
            const randomOffset = Math.floor(Math.random() * 48) * 60 * 60 * 1000;
            const sessionDate = new Date(baseDate.getTime() + randomOffset);

            console.log(`📝 ${student.name}: "${userPrompt}"`);

            let assistantResponse = '';
            let usedLLM = false;

            // Try LLM first with short timeout
            if (llmClient) {
                try {
                    const llmResponse = await Promise.race([
                        llmClient.complete({
                            system: SYSTEM_PROMPT,
                            messages: [{ role: 'user', content: userPrompt }],
                            generationConfig: { maxOutputTokens: 200, temperature: 0.25, topP: 0.9 },
                        }),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000)),
                    ]);

                    if (llmResponse && llmResponse.length > 10) {
                        assistantResponse = llmResponse;
                        usedLLM = true;
                    }
                } catch (e) {
                    // Fallback to hardcoded
                }
            }

            // Fallback to natural hardcoded response
            if (!assistantResponse) {
                assistantResponse = NATURAL_LEVELY_RESPONSES[userPrompt] || NATURAL_LEVELY_RESPONSES["apa itu HCI"];
                console.log(`  ⚡ Fallback (LLM unavailable)`);
            } else {
                console.log(`  ✓ LLM generated`);
                llmCount++;
            }

            // Create session and messages
            const { data: session, error: sessionErr } = await supabase
                .from('chat_sessions')
                .insert({
                    user_id: student.id,
                    created_at: sessionDate.toISOString(),
                    updated_at: sessionDate.toISOString(),
                })
                .select()
                .single();

            if (sessionErr) {
                console.error(`  ❌ Session error: ${sessionErr.message}`);
                errorCount++;
                continue;
            }

            const userMsgDate = new Date(sessionDate.getTime() + 1000);
            await supabase.from('chat_messages').insert({
                session_id: session.id,
                role: 'user',
                content: userPrompt,
                created_at: userMsgDate.toISOString(),
            });

            const assistantMsgDate = new Date(userMsgDate.getTime() + 2000);
            await supabase.from('chat_messages').insert({
                session_id: session.id,
                role: 'assistant',
                content: assistantResponse,
                created_at: assistantMsgDate.toISOString(),
            });

            if (!usedLLM) fallbackCount++;

            const preview = assistantResponse.length > 70 ? assistantResponse.slice(0, 70) + '...' : assistantResponse;
            console.log(`  ✓ "${preview}"`);
        }

        console.log(`\n✅ Done! LLM: ${llmCount}, Fallback: ${fallbackCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`);
    } catch (err) {
        console.error('[HybridChat] Fatal error:', err.message);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

generateChatDataHybrid();
