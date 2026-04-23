const express = require('express');
const chapterController = require('../controllers/ChapterController');
const cacheMiddleware = require('../middlewares/cacheMiddleware');

const router = express.Router();

router.get('/chapter', cacheMiddleware(300), chapterController.getAllChapters);

router.get('/chapter/:id', cacheMiddleware(300), chapterController.getChapterById);

router.post('/chapter', chapterController.createChapter);

router.put('/chapter/:id', chapterController.updateChapter);

router.delete('/chapter/:id', chapterController.deleteChapter);


router.get('/chapter/:id/materials', cacheMiddleware(300), chapterController.getMaterialsByChapter);

router.get('/chapter/:id/assessments', cacheMiddleware(300), chapterController.getAssessmentsByChapter);

router.get('/chapter/:id/assignments', cacheMiddleware(300), chapterController.getAssignmentsByChapter);

router.get('/chapter/:id/content', cacheMiddleware(300), chapterController.getContentByChapter);

router.get('/chapter/:id/userchapter', chapterController.getUserChapterByChapterId);

module.exports = router;
