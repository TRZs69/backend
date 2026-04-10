const prisma = require('../src/prismaClient');
const supabase = require('../supabase/supabase.js');

// Students still missing chat data
const STUDENTS_NEEDING_CHAT = [
    { id: 491, name: 'Paul Bornok Manurung' },
    { id: 503, name: 'Jeremy Manullang' },
    { id: 505, name: 'Alberton Napitupulu' },
    { id: 507, name: 'mirae' },
    { id: 511, name: 'Grace Evelin Siallagan' },
    { id: 522, name: 'Porman Marsaulina Simanjuntak' },
];

const NATURAL_RESPONSES = [
    "HCI (Human-Computer Interaction) adalah bidang yang mempelajari bagaimana manusia berinteraksi dengan komputer dan sistem digital. Fokus utamanya adalah mendesain antarmuka yang mudah digunakan, efisien, dan menyenangkan bagi pengguna.",
    "Usability heuristic itu prinsip-prinsip panduan buat bikin UI yang user-friendly. Menurut Nielsen, ada 10 heuristic utama, misalnya: sistem harus kasih feedback ke user (kayak loading bar), pake bahasa yang familiar bukan istilah teknis, dan kasih user kontrol buat undo/redo.",
    "Cognitive load theory bilang otak kita punya kapasitas memori kerja yang terbatas. Di desain, ini berarti kita harus minimalisir beban kognitif yang nggak perlu. Contohnya: jangan taruh terlalu banyak informasi sekaligus, gunakan hierarki visual yang jelas.",
    "Fitts's Law dipakai buat prediksi berapa lama waktu yang dibutuhkan user buat menggerakkan pointer ke target. Rumusnya: waktu gerak tergantung jarak ke target dan ukuran target. Praktisnya: bikin tombol penting gede dan taruh di tempat gampang dijangkau.",
    "Persona itu representasi fiktif target user berdasarkan data riset (siapa mereka, goal-nya apa, pain point-nya apa). Jadi persona = 'siapa' user kita. Sedangkan User Journey Map itu visualisasi langkah demi langkah interaksi user dengan produk kita.",
    "Gestalt principle itu cara otak kita mengorganisir informasi visual. Di UI design, yang paling relevan: Proximity (elemen berdekatan dianggap berkaitan), Similarity (elemen mirip dianggap satu grup), Closure (otak melengkapi bentuk tidak utuh), dan Figure-Ground (bedain foreground dan background).",
];

async function forceFinalChatData() {
    console.log('[ForceFinal] Creating chat data for remaining 6 students...\n');

    try {
        for (let i = 0; i < STUDENTS_NEEDING_CHAT.length; i++) {
            const student = STUDENTS_NEEDING_CHAT[i];
            const response = NATURAL_RESPONSES[i % NATURAL_RESPONSES.length];
            const sessionDate = new Date('2026-04-08T14:00:00.000Z');
            const userPrompt = [
                "apa itu HCI",
                "bisa jelasin usability heuristic gak?",
                "cognitive load theory contoh nyatanya apa",
                "Fitts law itu buat apa sih",
                "persona sama user journey map bedanya apa",
                "jelasin singkat tentang gestalt principle di UI",
            ][i];

            console.log(`📝 ${student.name}: "${userPrompt}"`);

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
                content: response,
                created_at: assistantMsgDate.toISOString(),
            });

            const preview = response.length > 70 ? response.slice(0, 70) + '...' : response;
            console.log(`  ✓ Levely: "${preview}"`);
        }

        console.log('\n✅ Done!');
    } catch (err) {
        console.error('[ForceFinal] Error:', err.message);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

forceFinalChatData();
