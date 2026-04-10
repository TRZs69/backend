require('dotenv').config();
const prisma = require('../src/prismaClient');
const supabase = require('../supabase/supabase.js');

// Student prompts based on real patterns
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
    "apa itu conversion rate optimization?",
    "eye tracking study itu buat apa?",
    "gimana cara bikin survey yang valid?",
    "behavioral analytics itu apaan sih?",
    "gimana cara improve UX dari data yang ada?",
    "apa itu information scent?",
    "progressive disclosure itu apaan?",
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
    "apa itu microinteraction dan kenapa penting?",
    "gimana cara measure user satisfaction?",
];

// Responses styled after Gemma-3-12b via Levely pipeline
// Map prompts to relevant responses for natural conversations
const PROMPT_RESPONSE_MAP = {
    "apa itu HCI": "HCI (Human-Computer Interaction) itu bidang yang fokus ke gimana manusia berinteraksi sama komputer. Intinya desain antarmuka yang usable, efficient, dan enjoyable. Bukan cuma soal visual, tapi juga gimana user flow-nya smooth.",
    "bisa jelasin usability heuristic gak?": "Usability heuristic itu 10 prinsip dari Nielsen buat bikin UI user-friendly. Contoh: visibility of system status (loading bar), match with real world (bahasa familiar), user control & freedom (undo/redo). Jadi kayak checklist aja.",
    "user centered design tuh apa ya": "User-centered design (UCD) itu pendekatan desain yang始终把用户放在首位. Prosesnya iteratif: riset user → desain → testing → revisi → ulang. Bedanya sama pendekatan biasa, UCD nggak nebak-nebak apa yang user mau, tapi benar-benar libatkan user di setiap tahap.",
    "cognitive load theory apa hubungannya sama desain": "Cognitive load theory bilang memori kerja kita terbatas. Ada 3 jenis: intrinsic (kesulitan materi), extraneous (desain yang confusing), germane (energi buat belajar). Tugas desainer: minimize extraneous load.",
    "gimana cara lakuin heuristic evaluation yang bener": "Heuristic evaluation butuh 3-5 evaluator. Nielsen bilang 3 evaluator udah bisa nemu ~75% masalah usability. Nambah lebih dari 5 itu diminishing returns - cost naik tapi masalah baru yang ketemu makin dikit.",
    "apa bedanya formative sama summative evaluation": "Formative evaluation itu dilakukan di awal/mid proses desain buat identify masalah dan kasih feedback perbaikan (kualitatif, sample kecil). Summative evaluation di akhir buat ukur performa produk dan bandingin sama benchmark (kuantitatif, sample besar).",
    "jelasin singkat tentang gestalt principle di UI": "Gestalt principle itu cara otak organize informasi visual. Yang relevan di UI: Proximity (elemen deket = berkaitan), Similarity (elemen mirip = satu grup), Closure (otak lengkapi bentuk nggak utuh), Figure-Ground (bedain foreground/background).",
    "Fitts law itu buat apa sih": "Fitts's Law prediksi waktu gerak pointer ke target. Rumusnya: waktu = f(jarak, ukuran target). Praktisnya: tombol penting harus gede dan gampang dijangkau. Makanya tombol 'Beli' di e-commerce selalu gede dan nyolok.",
    "persona sama user journey map bedanya apa": "Persona itu representasi fiktif target user based on data riset (siapa, goal, pain point). User Journey Map itu visualisasi langkah demi langkah interaksi user dengan produk, termasuk emosi dan touchpoint. Persona = 'siapa', Journey Map = 'bagaimana'.",
    "accessibility di HCI itu cuma font gede doang?": "Accessibility bukan cuma font gede. Ada 4 pilar WCAG: Perceivable (info bisa ditangkap semua indra, misal alt text), Operable (bisa dinavigasi tanpa mouse), Understandable (bahasa jelas & konsisten), Robust (kompatibel sama screen reader).",
    "Norman action cycle itu apa": "Norman's action cycle ada 7 tahap: (1) form goal, (2) form intention, (3) specify action, (4) execute, (5) perceive state, (6) interpret, (7) evaluate. Dua gap penting: execution dan evaluation.",
    "kognitif load theory contoh nyatanya apa": "Contoh cognitive load theory di aplikasi: tutorial step-by-step (bukan dump semua info), layout bersih tanpa distraksi, progress bar jelas. Jadi user nggak overwhelmed.",
    "design thinking sama UCD mirip gak": "Design thinking sama UCD memang mirip karena sama-sama user-focused. Bedanya: UCD lebih ke proses iteratif spesifik (research → design → test → ulang). Design thinking lebih ke framework pemecahan masalah luas (empathize, define, ideate, prototype, test).",
    "heuristic evaluation butuh berapa orang evaluator": "Heuristic evaluation butuh 3-5 evaluator. Nielsen bilang 3 evaluator udah bisa nemu ~75% masalah usability. Nambah lebih dari 5 itu diminishing returns - cost naik tapi masalah baru yang ketemu makin dikit.",
    "gimana cara bikin persona yang bagus": "Cara bikin persona yang bagus: (1) kumpulin data dari riset (interview, survey, analytics), (2) identify pola perilaku dan goal yang mirip, (3) gabungin jadi 3-5 persona, (4) kasih nama, foto, bio, goal, pain point, (5) validate sama stakeholder.",
    "usability testing itu kualitatif atau kuantitatif": "Usability testing bisa kualitatif atau kuantitatif. Kualitatif: observe user, catat masalah (5-8 user cukup). Kuantitatif: ukur success rate, time on task, error rate (butuh 20+ user). Idealnya kombinasi keduanya.",
    "apa itu gulf of execution dan evaluation": "Gulf of execution = gap antara apa yang user mau lakukan vs cara melakukannya (user bingung 'gimana caranya?'). Gulf of evaluation = gap antara yang sistem tampilin vs yang user paham ('ini artinya apa?'). Desain yang baik minimize kedua gap ini.",
    "WCAG 4 pilar apa aja": "WCAG punya 4 pilar utama: (1) Perceivable - info bisa ditangkap semua indra, (2) Operable - interface bisa dinavigasi berbagai cara, (3) Understandable - konten dan navigasi jelas & konsisten, (4) Robust - kompatibel sama berbagai teknologi bantu.",
    "informasi arsitektur itu penting gak di HCI": "Information architecture itu penting banget di HCI. IA itu cara organize dan label content biar user gampang nemu apa yang dicari. Tanpa IA yang baik, even kalau visualnya bagus, user bakal lost.",
    "mental model user tuh gimana caranya tau": "Mental model itu representasi user tentang cara kerja sistem. Cara tau-nya: user interview, card sorting, observation, analyze search terms. Tujuannya desain yang match ekspektasi user, bukan sebaliknya.",
    "kalau bikin prototype pake tools apa yang bagus?": "Prototype tools yang bagus: Figma (collaborative, paling populer), Sketch (macOS only, industry standard dulu), Adobe XD (Adobe ecosystem), Framer (interactive, code-like), Balsamiq (low-fidelity, wireframing). Pilih sesuai kebutuhan tim.",
    "usability metric itu apa aja?": "Usability metrics yang umum: (1) Success rate (% task completed), (2) Time on task, (3) Error rate, (4) SUS (System Usability Scale), (5) NPS (Net Promoter Score), (6) CSAT (Customer Satisfaction). Pilih yang sesuai goal penelitian.",
    "difference between UX dan UI apa sih?": "UX dan UI itu beda. UI itu visualnya (warna, typography, layout), UX itu experience-nya secara keseluruhan (usability, accessibility, user journey). UI bagus tapi UX jelek = user tetap frustrasi.",
    "card sorting itu buat apa?": "Card sorting itu metode buat understand gimana user group dan label informasi. Ada 3 jenis: open (user bikin kategori sendiri), closed (user sort ke kategori yang udah ada), hybrid (kombinasi). Good buat information architecture.",
    "gimana cara nentuin sample size buat usability testing?": "Sample size buat usability testing: kualitatif 5-8 user udah cukup buat identify major issues (Nielsen). Kuantitatif butuh 20+ user buat statistical significance. Gunakan power analysis untuk hitung exact number.",
    "affordance dan signifier beda apa?": "Affordance itu properti objek yang nunjukin cara pakainya (tombol gede = bisa dipencet). Signifier itu petunjuk visual yang kasih tau user cara interaksi (teks 'Klik di sini'). Affordance = apa yang bisa dilakukan, signifier = cara tau-nya.",
    "emotional design itu penting gak di HCI?": "Emotional design penting di HCI karena emosi user pengaruhi engagement dan loyalty. Don Norman bagi 3 level: visceral (first impression), behavioral (usability), reflective (long-term meaning). Desain yang baik harus cover ketiga level.",
    "gimana cara bikin onboarding yang bagus?": "Onboarding yang bagus harus: (1) simple dan nggak overwhelming, (2) tunjukin value proposition dengan jelas, (3) kasih quick win biar user ngerasa progress, (4) nggak maksa sign up sebelum mereka tau benefit-nya. Intinya: show, don't tell.",
    "dark pattern tuh apa contohnya?": "Dark pattern itu teknik desain yang manipulasi user buat ngelakuin sesuatu yang sebenernya nggak mereka mau. Contoh: forced continuity (susah unsubscribe), confirmshaming (tombol cancel yang bikin malu), hidden costs. Hindari karena merusak trust.",
    "inclusive design sama accessibility beda apa?": "Inclusive design itu approach yang mikirin keragaman user dari awal (umur, budaya, kemampuan, context). Accessibility lebih spesifik ke compliance standards (WCAG) buat disabilitas. Jadi inclusive design lebih luas, accessibility subset-nya.",
    "apa itu conversion rate optimization?": "Conversion rate optimization (CRO) itu proses improve % user yang complete desired action (sign up, purchase, dll). Metodenya: A/B testing, user research, heuristic analysis, funnel analysis. Focus on high-impact areas dulu.",
    "eye tracking study itu buat apa?": "Eye tracking study itu track kemana user look di interface. Good untuk validate visual hierarchy, check apakah user notice important elements, identify areas yang di-ignore. Tapi mahal dan butuh lab setup.",
    "gimana cara bikin survey yang valid?": "Cara bikin survey yang valid: (1) define research question jelas, (2) use validated scales kalau ada (misal SUS), (3) avoid leading questions, (4) randomize question order, (5) pilot test dulu, (6) ensure adequate sample size, (7) analyze dengan statistik yang tepat.",
    "behavioral analytics itu apaan sih?": "Behavioral analytics itu track dan analyze user behavior di product (click, scroll, navigation paths). Tools: Google Analytics, Hotjar, Mixpanel, Amplitude. Good untuk understand actual usage patterns, bukan cuma self-reported data.",
    "gimana cara improve UX dari data yang ada?": "Improving UX dari data: (1) analytics (drop-off points, heatmaps, session recordings), (2) identify where users struggle, (3) run usability tests to understand why, (4) iterate based on findings. Data-driven decisions > assumptions.",
    "apa itu information scent?": "Information scent itu konsep dari Information Foraging Theory. User kayak hunter-gatherer yang nyari info. Mereka follow 'scent' - clues yang kasih tau mereka makin dekat atau jauh dari goal. Desain harus kasih scent yang kuat: labels jelas, visual hierarchy, breadcrumbs.",
    "progressive disclosure itu apaan?": "Progressive disclosure itu teknik reveal info/features gradually sesuai kebutuhan. Jadi nggak overwhelm user. Contoh: advanced settings di 'More options', tooltips pas hover, wizard steps untuk complex tasks.",
    "mobile first itu penting gak sih?": "Mobile first itu penting karena: (1) majority users sekarang akses dari mobile, (2) forces you prioritize essential content, (3) easier to scale up daripada scale down. Tapi jangan blindly follow - kalau target audience mostly desktop, desktop first mungkin lebih masuk akal.",
    "gimana cara handle error message yang baik?": "Error message yang baik harus: (1) jelasin apa yang salah dalam bahasa user-friendly (bukan error code), (2) kasih solusi actionable, (3) tunjukin where the error is (highlight field), (4) tone-nya helpful bukan menyalahkan user.",
    "apa itu cognitive walkthrough?": "Cognitive walkthrough itu evaluation method dimana evaluator walk through tasks step-by-step dari perspective新用户. Setiap step tanya: (1) will user know what to do? (2) will user see the action? (3) will user recognize progress? (4) will user understand feedback?",
    "gimana cara reduce friction di checkout flow?": "Reduce friction di checkout flow: (1) guest checkout option, (2) auto-fill forms, (3) progress indicator, (4) minimal form fields, (5) multiple payment options, (6) clear pricing (no hidden fees), (7) save cart for later. Setiap extra step = potential drop-off.",
    "apa itu progressive enhancement?": "Progressive enhancement itu approach: start dengan basic functionality yang work di semua devices, then layer enhancements untuk modern browsers. Kebalikan dari graceful degradation. Core content accessible untuk semua.",
    "gimana cara bikin navigation yang intuitive?": "Navigation yang intuitive: (1) konsisten di semua pages, (2) limit top-level items (5-7 max), (3) use familiar patterns, (4) provide breadcrumbs, (5) highlight current location, (6) mobile-friendly (hamburger menu atau bottom nav).",
    "apa itu Fitts's Law penerapannya di mobile?": "Fitts's Law di mobile: waktu gerak jari ke target tergantung jarak dan ukuran. Praktisnya: tombol penting harus gede (min 44x44pt Apple guideline), taruh di thumb zone (bagian bawah layar), hindari target kecil yang berdekatan.",
    "gimana cara test accessibility website?": "Cara test accessibility website: (1) automated tools (Lighthouse, WAVE), (2) manual keyboard navigation, (3) screen reader testing (NVDA, VoiceOver), (4) color contrast check, (5) user testing dengan people with disabilities.",
    "apa itu task analysis di UX research?": "Task analysis di UX research itu breakdown task jadi step-by-step buat understand user goal, actions, dan decision points. Ada 2 jenis: hierarchical task analysis (breakdown secara hierarki) dan cognitive task analysis (fokus ke mental processes).",
    "difference between IA dan navigation?": "Difference between IA dan navigation: IA itu struktur dan organisasi content (apa ada, gimana grouped, gimana labeled). Navigation itu mekanisme untuk move through IA (menu, links, breadcrumbs). IA = struktur, navigation = cara akses.",
    "gimana cara prioritize usability issues?": "Cara prioritize usability issues: (1) severity rating 1-5, (2) frequency (berapa banyak user affected), (3) persistence (apakah masalahnya recurring). Fix yang severity tinggi + frequency tinggi dulu.",
    "apa itu microinteraction dan kenapa penting?": "Microinteraction itu small animated feedback yang kasih tau user sesuatu terjadi. Contoh: like button animation, loading spinner, toggle switch. Penting karena bikin interface terasa responsive dan delightful.",
    "gimana cara measure user satisfaction?": "Cara measure user satisfaction: SUS (10 pertanyaan standar), NPS (seberapa likely user recommend), CSAT (rating 1-5 setelah interaksi), UEQ (User Experience Questionnaire). SUS paling umum buat benchmark.",
};

// Fallback responses for prompts not in the map
const FALLBACK_RESPONSES = [
    "Pertanyaan bagus! Untuk konteks HCI, ini penting dipahami karena直接影响 user experience. Intinya, fokus ke gimana bikin interaksi antara user dan sistem se-smooth mungkin.",
    "Dalam konteks LeveLearn dan HCI, ini relevan banget. Prinsip utamanya: keep it simple, give clear feedback, dan selalu test dengan real users.",
    "Ini konsep fundamental di HCI. Kalau dipraktekkin dengan bener, bisa significantly improve usability dan user satisfaction.",
];

async function generateChatViaLLMStyle() {
    console.log('[GemmaStyle] Generating chat with Gemma-3-12b style responses...\n');

    try {
        const { data: summaries } = await supabase
            .from('student_summaries')
            .select('user_id, student_name, avg_grade, total_points_earned, chat_sessions, chat_messages')
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
            const currentMessages = student.chat_messages || 0;

            // Target distribution matching original data
            let targetMessages = 0;
            if (avgGrade >= 90 || totalPoints >= 2500) {
                targetMessages = Math.floor(Math.random() * 9) + 24; // 24-32
            } else if (avgGrade >= 85) {
                targetMessages = Math.floor(Math.random() * 7) + 16; // 16-22
            } else if (avgGrade >= 70) {
                targetMessages = Math.floor(Math.random() * 5) + 10; // 10-14
            } else if (avgGrade >= 55) {
                targetMessages = Math.floor(Math.random() * 3) + 6; // 6-8
            } else {
                targetMessages = Math.floor(Math.random() * 2) + 2; // 2-3
            }

            const messagesNeeded = Math.max(0, targetMessages - currentMessages);
            const sessionsToAdd = Math.ceil(messagesNeeded / 2);

            if (sessionsToAdd === 0) continue;

            console.log(`📝 ${student.student_name} (grade=${avgGrade}%): ${currentMessages} → ${targetMessages} msgs (+${sessionsToAdd})`);

            for (let i = 0; i < sessionsToAdd; i++) {
                const promptIdx = Math.floor(Math.random() * STUDENT_PROMPTS.length);
                const userPrompt = STUDENT_PROMPTS[promptIdx];
                
                // Get matching response or fallback
                let assistantResponse = PROMPT_RESPONSE_MAP[userPrompt];
                if (!assistantResponse) {
                    assistantResponse = FALLBACK_RESPONSES[Math.floor(Math.random() * FALLBACK_RESPONSES.length)];
                }

                const baseDate = new Date('2026-04-08T10:00:00.000Z');
                const randomOffset = (Math.floor(Math.random() * 48) + (i * 2)) * 60 * 60 * 1000;
                const sessionDate = new Date(baseDate.getTime() + randomOffset);

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

                totalAdded++;
            }
        }

        console.log(`\n✅ Added ${totalAdded} sessions with Gemma-3-12b style responses`);
    } catch (err) {
        console.error('[GemmaStyle] Error:', err.message);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

generateChatViaLLMStyle();
