const prisma = require('../src/prismaClient');
const supabase = require('../supabase/supabase.js');
const { GoogleAIClient } = require('../src/services/GoogleAIClient');

const IPHONE_USERS = ['Joey Cristo Thruli', 'Wahyu Rizky F Simanjorang', 'Lofelyn Enzely Ambarita'];

// Evaluation window for deletion
const WINDOW_START = '2026-03-26T00:00:00.000Z';
const WINDOW_END = '2026-04-09T23:59:59.999Z';

// Natural student prompts based on real chat patterns observed
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

const SYSTEM_PROMPT = [
    'You are Levely, an Indonesian learning assistant for LeveLearn.',
    'Answer in Indonesian unless the user explicitly asks for another language.',
    'Prioritize correctness, clarity, and relevance over sounding overly enthusiastic.',
    'Keep answers concise by default, then expand with steps, examples, or detail when the user asks for it or the topic truly needs it.',
    'If the available context is incomplete or uncertain, say so clearly and ask a focused follow-up question instead of guessing.',
    'Do not repeat greetings, praise, or user stats in every answer.',
].join(' ');

function initLLMClient() {
    const apiKey = (process.env.LEVELY_GEMINI_API_KEY || '').trim();
    const model = process.env.LEVELY_GEMINI_MODEL || 'gemma-3-12b-it';
    const baseUrl = process.env.LEVELY_GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/models';

    if (!apiKey) {
        console.error('⚠️  LEVELY_GEMINI_API_KEY not found. Set it in .env');
        return null;
    }

    return new GoogleAIClient({ apiKey, model, baseUrl });
}

async function regenerateChatData() {
    console.log('[RegenChat] Step 1: Deleting generated chat data in evaluation window...\n');

    const llmClient = initLLMClient();
    if (!llmClient) {
        console.error('❌ Cannot proceed without LLM client');
        process.exit(1);
    }

    try {
        const students = await prisma.user.findMany({
            where: { role: 'STUDENT' },
            select: { id: true, name: true },
        });

        console.log(`Found ${students.length} students\n`);

        // Step 1: Delete existing sessions in evaluation window (except iPhone users)
        let deletedCount = 0;
        for (const student of students) {
            if (IPHONE_USERS.includes(student.name)) {
                continue;
            }

            // Get sessions in window
            const { data: sessions, error: sessErr } = await supabase
                .from('chat_sessions')
                .select('id')
                .eq('user_id', student.id)
                .gte('created_at', WINDOW_START)
                .lte('created_at', WINDOW_END);

            if (sessErr || !sessions || sessions.length === 0) continue;

            const sessionIds = sessions.map(s => s.id);

            // Delete messages first
            await supabase
                .from('chat_messages')
                .delete()
                .in('session_id', sessionIds);

            // Delete sessions
            await supabase
                .from('chat_sessions')
                .delete()
                .in('id', sessionIds);

            deletedCount += sessions.length;
        }

        console.log(`✅ Deleted ${deletedCount} generated sessions\n`);

        // Step 2: Regenerate with LLM
        console.log('[RegenChat] Step 2: Generating new chat data with LLM...\n');

        let createdCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const student of students) {
            if (IPHONE_USERS.includes(student.name)) {
                console.log(`⏭ Skipped (iPhone): ${student.name}`);
                skippedCount++;
                continue;
            }

            const userPrompt = NATURAL_STUDENT_PROMPTS[Math.floor(Math.random() * NATURAL_STUDENT_PROMPTS.length)];
            const baseDate = new Date('2026-04-08T10:00:00.000Z');
            const randomOffset = Math.floor(Math.random() * 48) * 60 * 60 * 1000;
            const sessionDate = new Date(baseDate.getTime() + randomOffset);

            console.log(`📝 ${student.name}: "${userPrompt}"`);

            try {
                const llmResponse = await llmClient.complete({
                    system: SYSTEM_PROMPT,
                    messages: [{ role: 'user', content: userPrompt }],
                    generationConfig: {
                        maxOutputTokens: 256,
                        temperature: 0.25,
                        topP: 0.9,
                    },
                });

                const assistantResponse = llmResponse || 'Maaf, saya tidak bisa memproses pertanyaan tersebut.';

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
                await supabase
                    .from('chat_messages')
                    .insert({
                        session_id: session.id,
                        role: 'user',
                        content: userPrompt,
                        created_at: userMsgDate.toISOString(),
                    });

                const assistantMsgDate = new Date(userMsgDate.getTime() + 2000);
                await supabase
                    .from('chat_messages')
                    .insert({
                        session_id: session.id,
                        role: 'assistant',
                        content: assistantResponse,
                        created_at: assistantMsgDate.toISOString(),
                    });

                const preview = assistantResponse.length > 80 ? assistantResponse.slice(0, 80) + '...' : assistantResponse;
                console.log(`  ✓ Levely: "${preview}"`);
                createdCount++;

            } catch (llmError) {
                console.error(`  ❌ LLM error: ${llmError.message}`);
                errorCount++;
            }
        }

        console.log(`\n✅ Done! Deleted: ${deletedCount}, Created: ${createdCount}, Errors: ${errorCount}`);
    } catch (err) {
        console.error('[RegenChat] Fatal error:', err.message);
        console.error(err.stack);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

regenerateChatData();
