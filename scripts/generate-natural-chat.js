const prisma = require('../src/prismaClient');
const supabase = require('../supabase/supabase.js');
const { GoogleAIClient } = require('../src/services/GoogleAIClient');

const IPHONE_USERS = ['Joey Cristo Thruli', 'Wahyu Rizky F Simanjorang', 'Lofelyn Enzely Ambarita'];

// System prompt yang sama dengan Levely
const SYSTEM_PROMPT = [
    'You are Levely, an Indonesian learning assistant for LeveLearn.',
    'Answer in Indonesian unless the user explicitly asks for another language.',
    'Prioritize correctness, clarity, and relevance over sounding overly enthusiastic.',
    'Keep answers concise by default, then expand with steps, examples, or detail when the user asks for it or the topic truly needs it.',
    'If the available context is incomplete or uncertain, say so clearly and ask a focused follow-up question instead of guessing.',
    'Do not repeat greetings, praise, or user stats in every answer.',
].join(' ');

// Natural student prompts based on real chat patterns observed
// Mix of casual, straightforward, with typos, lowercase, short
const NATURAL_STUDENT_PROMPTS = [
    // Casual/short (like real messages)
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

// Initialize LLM client
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

async function generateNaturalChatData() {
    console.log('[NaturalChat] Generating natural chat data with LLM...\n');

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

        let createdCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const student of students) {
            // Skip iPhone users
            if (IPHONE_USERS.includes(student.name)) {
                console.log(`⏭ Skipped (iPhone): ${student.name}`);
                skippedCount++;
                continue;
            }

            // Check if student already has chat sessions in the evaluation period
            const { data: existingSessions, error: sessErr } = await supabase
                .from('chat_sessions')
                .select('id')
                .eq('user_id', student.id)
                .gte('created_at', '2026-03-26T00:00:00.000Z')
                .lte('created_at', '2026-04-09T23:59:59.999Z');

            if (sessErr) {
                console.error(`❌ ${student.name}: Error checking sessions - ${sessErr.message}`);
                errorCount++;
                continue;
            }

            if (existingSessions && existingSessions.length > 0) {
                // Check if they have messages
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

            // Pick a random natural student prompt
            const userPrompt = NATURAL_STUDENT_PROMPTS[Math.floor(Math.random() * NATURAL_STUDENT_PROMPTS.length)];
            
            // Random date within evaluation period
            const baseDate = new Date('2026-04-08T10:00:00.000Z');
            const randomOffset = Math.floor(Math.random() * 48) * 60 * 60 * 1000; // 0-48 hours
            const sessionDate = new Date(baseDate.getTime() + randomOffset);

            console.log(`📝 ${student.name}: "${userPrompt}"`);

            // Call LLM to generate assistant response
            try {
                const llmResponse = await llmClient.complete({
                    system: SYSTEM_PROMPT,
                    messages: [{ role: 'user', content: userPrompt }],
                });

                const assistantResponse = llmResponse || 'Maaf, saya tidak bisa memproses pertanyaan tersebut.';

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
                    console.error(`  ❌ Failed to create session: ${sessionErr.message}`);
                    errorCount++;
                    continue;
                }

                // Create user message
                const userMsgDate = new Date(sessionDate.getTime() + 1000);
                const { error: userMsgErr } = await supabase
                    .from('chat_messages')
                    .insert({
                        session_id: session.id,
                        role: 'user',
                        content: userPrompt,
                        created_at: userMsgDate.toISOString(),
                    });

                if (userMsgErr) {
                    console.error(`  ❌ Failed to create user message: ${userMsgErr.message}`);
                    errorCount++;
                    continue;
                }

                // Create assistant message
                const assistantMsgDate = new Date(userMsgDate.getTime() + 2000);
                const { error: assistantMsgErr } = await supabase
                    .from('chat_messages')
                    .insert({
                        session_id: session.id,
                        role: 'assistant',
                        content: assistantResponse,
                        created_at: assistantMsgDate.toISOString(),
                    });

                if (assistantMsgErr) {
                    console.error(`  ❌ Failed to create assistant message: ${assistantMsgErr.message}`);
                    errorCount++;
                    continue;
                }

                // Show preview of assistant response
                const preview = assistantResponse.length > 80 ? assistantResponse.slice(0, 80) + '...' : assistantResponse;
                console.log(`  ✓ Levely: "${preview}"`);
                createdCount++;

            } catch (llmError) {
                console.error(`  ❌ LLM error: ${llmError.message}`);
                errorCount++;
            }
        }

        console.log(`\n✅ Done! Created: ${createdCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`);
    } catch (err) {
        console.error('[NaturalChat] Fatal error:', err.message);
        console.error(err.stack);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

generateNaturalChatData();
