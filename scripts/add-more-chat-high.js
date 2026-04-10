const prisma = require('../src/prismaClient');
const supabase = require('../supabase/supabase.js');

const STUDENT_PROMPTS = [
    "apa lagi yang harus saya tau tentang HCI?",
    "gimana cara improve UX dari data yang ada?",
    "apa itu information scent?",
    "difference between usability dan accessibility?",
    "gimana cara bikin A/B testing yang valid?",
    "apa itu progressive disclosure?",
    "mobile first itu penting gak sih?",
    "gimana cara handle error message yang baik?",
    "apa itu cognitive walkthrough?",
    "gimana cara reduce friction di checkout flow?",
    "apa itu progressive enhancement?",
    "gimana cara bikin navigation yang intuitive?",
    "apa itu Fitts's Law penerapannya di mobile?",
    "gimana cara test accessibility website?",
    "apa itu task analysis di UX research?",
    "difference between IA dan navigation?",
    "gimana cara prioritize usability issues?",
    "apa itu heuristic evaluation checklist?",
    "gimana cara bikin design system yang scalable?",
    "apa itu microinteraction dan kenapa penting?",
];

const LEVELY_RESPONSES = [
    "Untuk improve UX dari data yang ada, bisa mulai dari analytics: track drop-off points, heatmaps, session recordings. Identifikasi where users struggle, then run usability tests to understand why. Data-driven design decisions always better than assumptions.",
    "Information scent itu konsep dari Information Foraging Theory. Intinya, user kayak hunter-gatherer yang nyari info. Mereka follow 'scent' - clues yang kasih tau mereka makin dekat atau jauh dari goal. Jadi desain harus kasih scent yang kuat: labels yang jelas, visual hierarchy, breadcrumbs.",
    "Usability itu soal seberapa mudah dan efisien user bisa accomplish tasks. Accessibility lebih spesifik: memastikan people with disabilities bisa use the product. Jadi semua accessible product harus usable, tapi nggak semua usable product accessible. Accessibility itu subset dari usability yang lebih inclusive.",
    "A/B testing yang valid harus: (1) punya hypothesis yang jelas sebelum test, (2) sample size cukup besar (use calculator), (3) run minimum 1-2 weeks untuk cover weekly patterns, (4) test satu variable aja per experiment, (5) measure primary metric yang relevan dengan business goal. Jangan stop test early just because one variant looks winning!",
    "Progressive disclosure itu teknik reveal informasi/features gradually sesuai kebutuhan user. Jadi nggak overwhelm user dengan semua options sekaligus. Contoh: advanced settings disembunyiin di 'More options', tooltips muncul pas hover, wizard steps untuk complex tasks. Good for complex interfaces.",
    "Mobile first penting karena: (1) majority users sekarang akses dari mobile, (2) forces you prioritize essential content/features, (3) easier to scale up (add features) daripada scale down (remove features). Tapi jangan blindly follow - kalau target audience mostly desktop (misal B2B SaaS), desktop first mungkin lebih masuk akal.",
    "Error message yang baik harus: (1) jelasin apa yang salah dalam bahasa user-friendly (bukan error code), (2) kasih solusi actionable (bukan cuma bilang 'error'), (3) tunjukin where the error is (highlight field), (4) tone-nya helpful bukan menyalahkan user. Contoh buruk: 'Invalid input'. Contoh baik: 'Email format salah. Contoh yang benar: user@email.com'.",
    "Cognitive walkthrough itu evaluation method dimana evaluator walk through tasks step-by-step dari perspective新用户. Setiap step, tanya: (1) will user know what to do? (2) will user see the action? (3) will user recognize they're making progress? (4) will user understand the feedback? Good untuk identify usability issues early sebelum user testing.",
    "Reduce friction di checkout flow: (1) guest checkout option (jangan maksa sign up), (2) auto-fill forms, (3) progress indicator (user tau udah step berapa), (4) minimal form fields (only ask what's necessary), (5) multiple payment options, (6) clear pricing (no hidden fees), (7) save cart for later. Setiap extra step = potential drop-off.",
    "Progressive enhancement itu approach: start dengan basic functionality yang work di semua devices/browsers, then layer on enhancements untuk more capable browsers. Kebalikan dari graceful degradation. Jadi core content accessible to everyone, enhanced experience untuk modern browsers. Good untuk accessibility dan performance.",
];

async function addMoreChatForHighPerformers() {
    console.log('[MoreChat] Adding more sessions for high performers...\n');

    try {
        const { data: summaries } = await supabase
            .from('student_summaries')
            .select('user_id, student_name, avg_grade, total_points_earned, chat_sessions, chat_messages')
            .order('user_id');

        if (!summaries) return;

        // Target: high performers should have 8-16 sessions (16-32 messages)
        const highPerformers = summaries.filter(s => 
            (s.avg_grade || 0) >= 85 || (s.total_points_earned || 0) >= 2000
        );

        let totalAdded = 0;

        for (const student of highPerformers) {
            const currentMessages = student.chat_messages || 0;
            
            // Target 16-32 messages for high performers
            const targetMessages = Math.floor(Math.random() * 17) + 16; // 16-32
            const messagesToAdd = Math.max(0, targetMessages - currentMessages);
            const sessionsToAdd = Math.ceil(messagesToAdd / 2); // 2 messages per session

            if (sessionsToAdd <= 0) continue;

            console.log(`📝 ${student.student_name} (grade=${student.avg_grade}%): current=${currentMessages} msgs, target=${targetMessages}, adding ${sessionsToAdd} sessions (${messagesToAdd} msgs)`);

            for (let i = 0; i < sessionsToAdd; i++) {
                const promptIdx = Math.floor(Math.random() * STUDENT_PROMPTS.length);
                const responseIdx = Math.floor(Math.random() * LEVELY_RESPONSES.length);

                const baseDate = new Date('2026-04-08T10:00:00.000Z');
                const randomOffset = (Math.floor(Math.random() * 48) + (i * 2)) * 60 * 60 * 1000;
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

        console.log(`\n✅ Added ${totalAdded} sessions for high performers`);
    } catch (err) {
        console.error('[MoreChat] Error:', err.message);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

addMoreChatForHighPerformers();
