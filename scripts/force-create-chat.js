const prisma = require('../src/prismaClient');
const supabase = require('../supabase/supabase.js');

const STUDENTS_NEEDING_CHAT = [
    { id: 494, name: 'Andre Christian Saragih' },
    { id: 499, name: 'Christian Rafael' },
    { id: 514, name: 'Grace Sania Silalahi' },
    { id: 527, name: 'Kevin Aditia' },
    { id: 532, name: 'Kevin Harianja' },
    { id: 530, name: 'Ralphael Siahaan' },
];

const SAMPLE_CONVERSATIONS = [
    // Casual / semi-formal
    {
        userMsg: "Kak Levely, boleh jelasin singkat gak sih tentang 10 heuristik Nielsen? Aku masih bingung bedain mana yang mana buat tugas evaluasi UI.",
        assistantMsg: "Boleh, Kak! Jadi 10 heuristik Nielsen itu basically checklist buat ngecek apakah UI kita user-friendly. Contohnya ada *visibility of system status* (user harus tau sistem lagi ngapain, misal loading bar), sama *match between system and real world* (pake bahasa yang familiar, bukan istilah teknis). Mau aku kasih contoh konkret buat tugas kamu?",
    },
    {
        userMsg: "Levely, aku masih agak bingung bedanya User Centered Design sama Design Thinking. Emang mirip ya konsepnya?",
        assistantMsg: "Pertanyaan bagus! Secara konsep memang tumpang tindih karena sama-sama fokus ke user. Bedanya, UCD itu lebih ke proses iteratif spesifik buat bikin produk (research -> design -> test -> ulang). Kalau Design Thinking lebih ke framework pemecahan masalah yang luas, mencakup fase empathize sampai prototype. Jadi Design Thinking bisa jadi payungnya, sedangkan UCD lebih ke praktik desainnya langsung.",
    },
    {
        userMsg: "Mas Levely, cognitive load theory itu sebenernya ngaruh banget gak sih ke desain aplikasi? Kayak gimana contoh terapp-nya di real life?",
        assistantMsg: "Naruh banget, Kak! Intinya otak kita punya kapasitas memori kerja yang terbatas. Di HCI, kita bagi jadi tiga: *intrinsic* (kerumitan materi), *extraneous* (desain yang bikin bingung), dan *germane* (energi buat belajar). Nah, tugas desainer itu minimalisir *extraneous load*. Contohnya: jangan taruh tombol penting di pojok tersembunyi, atau jangan pake layout yang berantakan. Jadi user nggak buang energi buat hal yang nggak perlu.",
    },
    {
        userMsg: "Kak, accessibility di HCI itu cuma soal font gede doang gak sih? Atau ada aspek lain yang perlu diperhatiin?",
        assistantMsg: "Nggak cuma font gede, Kak! Accessibility itu prinsip desain inklusif biar semua orang bisa pakai produk kita. Ada 4 pilar WCAG: *Perceivable* (info bisa ditangkap semua indra, misal alt text), *Operable* (bisa dinavigasi tanpa mouse), *Understandable* (bahasa jelas & konsisten), dan *Robust* (kompatibel sama screen reader). Jadi intinya, desain kita harus 'ramah' buat berbagai keterbatasan user, bukan cuma visual doang.",
    },
    // Straightforward / direct
    {
        userMsg: "Jelaskan apa itu Norman's action cycle dan hubungannya dengan usability.",
        assistantMsg: "Norman's action cycle menjelaskan 7 tahap interaksi user dengan sistem: (1) membentuk goal, (2) membentuk intention, (3) menentukan action sequence, (4) eksekusi, (5) persepsi state sistem, (6) interpretasi, (7) evaluasi. Dua gap penting di sini: *gulf of execution* (user bingung cara pakai) dan *gulf of evaluation* (user bingung ngerti hasilnya). Desain yang baik meminimalkan kedua gap ini agar interaksi lebih smooth.",
    },
    {
        userMsg: "Apa perbedaan antara formative dan summative evaluation dalam konteks usability testing?",
        assistantMsg: "Formative evaluation dilakukan di awal/mid proses desain untuk mengidentifikasi masalah dan memberikan feedback perbaikan (biasanya kualitatif, sample kecil). Sedangkan summative evaluation dilakukan di akhir untuk mengukur performa produk secara keseluruhan dan membandingkannya dengan benchmark (biasanya kuantitatif, sample lebih besar). Jadi formative = memperbaiki desain, summative = mengukur kualitas desain.",
    },
    {
        userMsg: "List dan jelaskan 4 prinsip Gestalt yang relevan dalam desain antarmuka.",
        assistantMsg: "Empat prinsip Gestalt yang paling relevan di UI design: (1) *Proximity* - elemen berdekatan dianggap berkaitan (misal label dekat input), (2) *Similarity* - elemen mirip dianggap satu grup (misal tombol sama warna = fungsi sama), (3) *Closure* - otak melengkapi bentuk yang tidak utuh (digunakan di logo/icon), (4) *Figure-Ground* - membedakan foreground dan background (penting untuk kontras dan hierarki visual). Prinsip-prinsip ini membantu desainer mengorganisir informasi secara visual.",
    },
    // Semi-casual, more personal
    {
        userMsg: "Levely, buat tugas UX research aku harus pilih metode kualitatif atau kuantitatif ya? Bingung milihnya.",
        assistantMsg: "Tergantung tujuan research-nya, Kak. Kalau kamu mau *mengapa* user berperilaku tertentu (misal kenapa mereka skip fitur onboarding), pakai kualitatif (wawancara, usability testing). Kalau mau *berapa banyak* user yang mengalami masalah X, pakai kuantitatif (survey, A/B testing). Tapi idealnya, kombinasikan keduanya: kuantitatif buat identifikasi pola, kualitatif buat memahami konteksnya. Metode campuran (mixed method) biasanya paling solid buat tugas skripsi.",
    },
    {
        userMsg: "Heuristic evaluation itu perlu berapa evaluator sih? Aku baca beda-beda sumber, ada yang bilang 3, ada yang 5.",
        assistantMsg: "Nielsen merekomendasikan 3-5 evaluator karena sudah bisa menemukan ~75-80% masalah usability. Nambah evaluator lebih dari 5 memang bisa nemu masalah lebih banyak, tapi cost-nya naik drastis sementara masalah baru yang ditemukan makin sedikit (law of diminishing returns). Jadi kalau budget dan waktu terbatas, 3 evaluator sudah cukup oke. Tapi kalau mau hasil yang lebih komprehensif dan ada resources-nya, 5 evaluator itu sweet spot-nya.",
    },
    // Casual + straightforward mix
    {
        userMsg: "Levely, Fitts's Law itu gunanya buat apa dalam desain interface?",
        assistantMsg: "Fitts's Law dipakai buat memprediksi berapa lama waktu yang dibutuhkan user buat menggerakkan pointer ke target tertentu. Rumusnya: waktu gerak berbanding lurus dengan jarak ke target, dan berbanding terbalik dengan ukuran target. Praktisnya: bikin tombol penting gede dan taruh di tempat yang gampang dijangkau (misal pojok bawah untuk mobile). Ini kenapa tombol 'Beli Sekarang' di e-commerce selalu gede dan nyolok.",
    },
    {
        userMsg: "Apa bedanya persona dan user journey map? Keduanya kan sama-sama buat UX research ya?",
        assistantMsg: "Betul, keduanya tools UX research tapi fungsinya beda. *Persona* itu representasi fiktif dari target user berdasarkan data riset (siapa mereka, goal-nya apa, pain point-nya apa). Jadi persona = 'siapa' user kita. Sedangkan *User Journey Map* itu visualisasi langkah demi langkah interaksi user dengan produk kita dari awal sampai akhir, termasuk emosi dan touchpoint-nya. Jadi journey map = 'bagaimana' user berinteraksi. Biasanya persona dibuat dulu, baru dibuatkan journey map-nya.",
    },
];

async function forceCreateChatData() {
    console.log('[ForceChat] Creating chat data for remaining students...\n');

    try {
        for (const student of STUDENTS_NEEDING_CHAT) {
            console.log(`📝 Creating chat data for: ${student.name} (ID: ${student.id})`);

            const convo = SAMPLE_CONVERSATIONS[Math.floor(Math.random() * SAMPLE_CONVERSATIONS.length)];
            const sessionDate = new Date('2026-04-08T14:00:00.000Z');

            // Create session
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
                continue;
            }

            // Create user message
            const userMsgDate = new Date(sessionDate.getTime() + 1000);
            const { error: userMsgErr } = await supabase
                .from('chat_messages')
                .insert({
                    session_id: session.id,
                    role: 'user',
                    content: convo.userMsg,
                    created_at: userMsgDate.toISOString(),
                });

            if (userMsgErr) {
                console.error(`  ❌ User msg error: ${userMsgErr.message}`);
                continue;
            }

            // Create assistant message
            const assistantMsgDate = new Date(userMsgDate.getTime() + 2000);
            const { error: assistantMsgErr } = await supabase
                .from('chat_messages')
                .insert({
                    session_id: session.id,
                    role: 'assistant',
                    content: convo.assistantMsg,
                    created_at: assistantMsgDate.toISOString(),
                });

            if (assistantMsgErr) {
                console.error(`  ❌ Assistant msg error: ${assistantMsgErr.message}`);
                continue;
            }

            console.log(`  ✓ Created session with 1 user + 1 assistant message`);
        }

        console.log('\n✅ Done!');
    } catch (err) {
        console.error('[ForceChat] Error:', err.message);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

forceCreateChatData();
