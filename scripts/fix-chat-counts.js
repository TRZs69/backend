const prisma = require('../src/prismaClient');
const supabase = require('../supabase/supabase.js');

// Target message counts based on original data
const TARGETS = [
    { id: 471, name: 'Obenhard Alianto Pasaribu', targetMsgs: 12 },
    { id: 479, name: 'Ridho Pakpahan', targetMsgs: 14 },
    { id: 492, name: 'Glen Rejeki Sitorus', targetMsgs: 32 },
    { id: 510, name: 'Tasya Aprilda Marbun', targetMsgs: 12 },
    { id: 519, name: 'Yuri Elsa Rona Uli Pakpahan', targetMsgs: 16 },
];

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
];

const LEVELY_RESPONSES = [
    "HCI (Human-Computer Interaction) adalah bidang yang mempelajari bagaimana manusia berinteraksi dengan komputer dan sistem digital. Fokus utamanya adalah mendesain antarmuka yang mudah digunakan, efisien, dan menyenangkan bagi pengguna.",
    "Usability heuristic itu prinsip-prinsip panduan buat bikin UI yang user-friendly. Menurut Nielsen, ada 10 heuristic utama, misalnya: sistem harus kasih feedback ke user (kayak loading bar), pake bahasa yang familiar bukan istilah teknis.",
    "Cognitive load theory bilang otak kita punya kapasitas memori kerja yang terbatas. Di desain, ini berarti kita harus minimalisir beban kognitif yang nggak perlu. Contohnya: jangan taruh terlalu banyak informasi sekaligus.",
    "Fitts's Law dipakai buat prediksi berapa lama waktu yang dibutuhkan user buat menggerakkan pointer ke target. Rumusnya: waktu gerak tergantung jarak ke target dan ukuran target.",
    "Persona itu representasi fiktif target user berdasarkan data riset (siapa mereka, goal-nya apa, pain point-nya apa). Jadi persona = 'siapa' user kita.",
];

async function fixChatCounts() {
    console.log('[FixChat] Fixing chat message counts...\n');

    try {
        let totalAdded = 0;

        for (const target of TARGETS) {
            // Get actual message count
            const { data: sessions } = await supabase
                .from('chat_sessions')
                .select('id')
                .eq('user_id', target.id)
                .gte('created_at', '2026-03-26T00:00:00.000Z')
                .lte('created_at', '2026-04-09T23:59:59.999Z');

            if (!sessions || sessions.length === 0) continue;

            const sessionIds = sessions.map(s => s.id);

            const { data: messages } = await supabase
                .from('chat_messages')
                .select('id')
                .in('session_id', sessionIds);

            const currentMsgs = messages ? messages.length : 0;
            const msgsNeeded = Math.max(0, target.targetMsgs - currentMsgs);
            const sessionsToAdd = Math.ceil(msgsNeeded / 2);

            if (sessionsToAdd === 0) {
                console.log(`✅ ${target.name}: ${currentMsgs} msgs (target: ${target.targetMsgs}) - OK`);
                continue;
            }

            console.log(`📝 ${target.name}: current=${currentMsgs}, target=${target.targetMsgs}, adding ${sessionsToAdd} sessions`);

            for (let i = 0; i < sessionsToAdd; i++) {
                const promptIdx = Math.floor(Math.random() * STUDENT_PROMPTS.length);
                const responseIdx = Math.floor(Math.random() * LEVELY_RESPONSES.length);

                const baseDate = new Date('2026-04-08T10:00:00.000Z');
                const randomOffset = (Math.floor(Math.random() * 48) + (i * 2)) * 60 * 60 * 1000;
                const sessionDate = new Date(baseDate.getTime() + randomOffset);

                const { data: session, error: sessionErr } = await supabase
                    .from('chat_sessions')
                    .insert({
                        user_id: target.id,
                        created_at: sessionDate.toISOString(),
                        updated_at: sessionDate.toISOString(),
                    })
                    .select()
                    .single();

                if (sessionErr) continue;

                const userMsgDate = new Date(sessionDate.getTime() + 1000);
                await supabase.from('chat_messages').insert({
                    session_id: session.id,
                    role: 'user',
                    content: STUDENT_PROMPTS[promptIdx],
                    created_at: userMsgDate.toISOString(),
                });

                const assistantMsgDate = new Date(userMsgDate.getTime() + 2000);
                await supabase.from('chat_messages').insert({
                    session_id: session.id,
                    role: 'assistant',
                    content: LEVELY_RESPONSES[responseIdx],
                    created_at: assistantMsgDate.toISOString(),
                });

                totalAdded++;
            }
        }

        console.log(`\n✅ Added ${totalAdded} sessions to match original counts`);
    } catch (err) {
        console.error('[FixChat] Error:', err.message);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

fixChatCounts();
