const express = require('express');
// @ts-ignore
const chapterController = require('../controllers/ChapterController');
const cacheMiddleware = require('../middlewares/cacheMiddleware');

const router = express.Router();

// Route for get all chapters
router.get('/chapter', cacheMiddleware(300), chapterController.getAllChapters);

// Route for get chapter by id
router.get('/chapter/:id', cacheMiddleware(300), chapterController.getChapterById);

// Router for create chapter
router.post('/chapter', chapterController.createChapter);

// Router for update chapter by id
router.put('/chapter/:id', chapterController.updateChapter);

// Router for delete chapter by id
router.delete('/chapter/:id', chapterController.deleteChapter);


// SPECIAL ROUTES

// Router for get material from chapter
router.get('/chapter/:id/materials', cacheMiddleware(300), chapterController.getMaterialsByChapter);

// Router for get material from chapter
router.get('/chapter/:id/assessments', cacheMiddleware(300), chapterController.getAssessmentsByChapter);

// Router for get material from chapter
router.get('/chapter/:id/assignments', cacheMiddleware(300), chapterController.getAssignmentsByChapter);

// Router for get content from chapter
router.get('/chapter/:id/content', cacheMiddleware(300), chapterController.getContentByChapter);

// Router for get userchapter from chapter
router.get('/chapter/:id/userchapter', chapterController.getUserChapterByChapterId);

module.exports = router;
