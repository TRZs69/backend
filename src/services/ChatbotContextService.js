const prisma = require('../prismaClient');
const chatHistoryStore = require('./ChatHistoryRepository');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const {
	shouldForceContinuation,
} = require('./ChatbotGuardrails');
const {
	MAX_USER_CONTEXT_COURSES,
	MAX_MATERIAL_IMAGES,
	IMAGE_DOWNLOAD_TIMEOUT_MS,
	MAX_MATERIAL_CONTEXT_CHARS,
	MAX_ASSESSMENT_CONTEXT_CHARS,
} = require('./ChatbotConfig');
const {
	normalizeChapterId,
	truncateText,
	shouldIncludeImageContext,
	normalizeHistory,
} = require('./ChatbotUtils');
const {
	buildReferenceMessage,
	buildUserRequestMessage,
} = require('./ChatbotMessageBuilder');

const buildChatContext = async ({ history, sessionId, userId, prompt, materialId, chapterId }) => {
	let persistedSessionId = sessionId;
	let persistedConversation = [];
	const useProvidedHistory = Array.isArray(history) && history.length > 0;
	let resolvedChapterId = normalizeChapterId(chapterId);

	let userProfileContext = '';
	let materialReferenceContext = '';
	let assessmentReferenceContext = '';
	let followUpInstruction = '';

	if (userId) {
		try {
			const user = await prisma.user.findUnique({
				where: { id: parseInt(userId, 10) },
				include: {
					enrolledCourses: { include: { course: true } },
					userBadges: true,
				},
			});
			if (user) {
				const coursesText = user.enrolledCourses
					.slice(0, Math.max(0, MAX_USER_CONTEXT_COURSES))
					.map((uc) => `- ${uc.course.name}: ${uc.progress}%`)
					.join('\n');
				const badgesCount = user.userBadges.length;

				userProfileContext = [
					'- Gunakan informasi ini hanya jika relevan dengan pertanyaan saat ini.',
					`- Nama: ${user.name}`,
					`- Poin: ${user.points}`,
					`- Lencana: ${badgesCount}`,
					`- Progres Belajar:\n${coursesText || '- Tidak ada data progres kursus.'}`,
				].join('\n');
			}
		} catch (error) {
			console.error('ChatbotService fetch user history error:', error.message);
		}
	}

	let mediaContext = [];

	if (materialId) {
		try {
			const material = await prisma.material.findUnique({
				where: { id: parseInt(materialId, 10) },
				include: { chapter: true }
			});
			if (material) {
				if (material.chapter?.id && resolvedChapterId === null) {
					resolvedChapterId = normalizeChapterId(material.chapter.id);
				}
				if (material.content) {
					let cleanContent = material.content.replace(/<img[^>]+src="([^">]+)"[^>]*>/g, ' [Image: $1] ');

					const includeImageContext = shouldIncludeImageContext(prompt);

					if (includeImageContext && MAX_MATERIAL_IMAGES > 0) {
						const imageRegex = /\[Image:\s*([^\]]+)\]/g;
						let match;
						let imageCount = 0;
						while ((match = imageRegex.exec(cleanContent)) !== null && imageCount < MAX_MATERIAL_IMAGES) {
							const imgPath = match[1];

							if (imgPath.startsWith('http')) {
								try {
									const response = await axios.get(imgPath, {
										responseType: 'arraybuffer',
										timeout: IMAGE_DOWNLOAD_TIMEOUT_MS,
									});
									const ext = path.extname(imgPath.split('?')[0]).toLowerCase();
									let mimeType = 'image/png';
									if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
									else if (ext === '.webp') mimeType = 'image/webp';
									else if (ext === '.gif') mimeType = 'image/gif';

									const base64Str = Buffer.from(response.data, 'binary').toString('base64');
									mediaContext.push({
										inlineData: {
											data: base64Str,
											mimeType,
										}
									});
									imageCount += 1;
								} catch (downloadError) {
									console.error('Failed to download image from', imgPath, downloadError.message);
								}
							} else {
								let relativePath = imgPath.replace('asset:', '');
								const absolutePath = path.resolve(__dirname, '../../../Mobile', relativePath);

								if (fs.existsSync(absolutePath)) {
									const ext = path.extname(absolutePath).toLowerCase();
									let mimeType = 'image/png';
									if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
									else if (ext === '.webp') mimeType = 'image/webp';

									const fileBuffer = fs.readFileSync(absolutePath);
									mediaContext.push({
										inlineData: {
											data: fileBuffer.toString('base64'),
											mimeType,
										}
									});
									imageCount += 1;
								}
							}
						}
					}

					// strip remaining HTML tags
					cleanContent = cleanContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
					cleanContent = truncateText(cleanContent, MAX_MATERIAL_CONTEXT_CHARS);
					materialReferenceContext = `Judul: ${material.name}\nIsi Materi: ${cleanContent}`;
				}

				// If we have a chapter, look up if user has assessment data for this chapter
				if (material.chapter && userId) {
					try {
						const userChapter = await prisma.userChapter.findFirst({
							where: {
								userId: parseInt(userId, 10),
								chapterId: material.chapter.id
							}
						});

						if (userChapter && userChapter.assessmentDone) {
							const assessment = await prisma.assessment.findFirst({
								where: { chapterId: material.chapter.id }
							});

							if (assessment) {
								let assessmentStats = `Informasi Kuis Bab "${material.chapter.name}":\n`;
								assessmentStats += `- Nilai: ${userChapter.assessmentGrade}\n`;

								if (userChapter.assessmentAnswer && Array.isArray(userChapter.assessmentAnswer)) {
									assessmentStats += `- Jawaban Siswa:\n`;
									userChapter.assessmentAnswer.forEach((ans, i) => {
										assessmentStats += `  ${i + 1}. ${ans}\n`;
									});
								}

								assessmentStats += `\nReferensi Soal & Kunci Jawaban Lengkap:\n`;
								if (assessment.questions) {
									assessmentStats += truncateText(
										JSON.stringify(assessment.questions, null, 2),
										MAX_ASSESSMENT_CONTEXT_CHARS,
									) + '\n';
								}

								assessmentReferenceContext = [
									assessmentStats.trim(),
									'Gunakan data ini untuk evaluasi, umpan balik, atau penjelasan jika relevan. Jangan bocorkan kunci jawaban sebagai jawaban instan untuk tugas yang sedang dinilai.',
								].join('\n\n');
							}
						}
					} catch (userChapterError) {
						console.error('ChatbotService fetch userChapter/assessment error:', userChapterError.message);
					}
				}
			}
		} catch (error) {
			console.error('ChatbotService fetch material error:', error.message);
		}
	}

	if (chatHistoryStore.isEnabled) {
		try {
			if (sessionId) {
				persistedSessionId = await chatHistoryStore.ensureSession({
					sessionId,
					userId,
					chapterId: resolvedChapterId,
				});
			}

			if (!useProvidedHistory && persistedSessionId) {
				const stored = await chatHistoryStore.fetchMessages({
					sessionId: persistedSessionId,
					limit: 20,
				});
				persistedConversation = stored.map((entry) => ({
					role: entry.role,
					content: entry.content,
				}));
			}
		} catch (error) {
			console.error('ChatbotService history error:', error.message);
		}
	}

	const baseHistory = useProvidedHistory ? history : persistedConversation;
	const conversation = normalizeHistory(baseHistory);
	const isContinuationRequest = shouldForceContinuation({ prompt, conversation });
	if (isContinuationRequest) {
		followUpInstruction = 'Ini adalah lanjutan topik. Jika pengguna menjawab singkat seperti "boleh", "lanjut", atau "oke", anggap itu sebagai sinyal untuk melanjutkan jawaban sebelumnya tanpa mengulang ringkasan dari awal. Jangan ulang salam, nama pengguna, poin, lencana, atau pembuka motivasi yang sama. Jika menggunakan daftar bernomor, pastikan setiap nomor punya isi; jangan pernah mengirim nomor kosong seperti "3.".';
	}

	const referenceMessage = buildReferenceMessage({
		userProfile: userProfileContext,
		materialContext: materialReferenceContext,
		assessmentContext: assessmentReferenceContext,
		followUpInstruction,
	});
	
	const messages = [...conversation];
	if (referenceMessage) {
		messages.push({ role: 'user', content: referenceMessage });
	}

	messages.push({
		role: 'user',
		content: buildUserRequestMessage(prompt),
		media: mediaContext.length > 0 ? mediaContext : undefined
	});

	return {
		persistedSessionId,
		messages,
		hasMaterialContext: Boolean(materialReferenceContext),
		hasAssessmentContext: Boolean(assessmentReferenceContext),
		isContinuationRequest,
	};
};

module.exports = {
	buildChatContext,
};
