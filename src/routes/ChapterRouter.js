const express = require('express');
const chapterController = require('../controllers/ChapterController');
const cacheMiddleware = require('../middlewares/cacheMiddleware');

const router = express.Router();

router.get('/chapter', chapterController.getAllChapters);

router.get('/chapter/:id', chapterController.getChapterById);

router.post('/chapter', chapterController.createChapter);

router.put('/chapter/:id', chapterController.updateChapter);

router.delete('/chapter/:id', chapterController.deleteChapter);


router.get('/chapter/:id/materials', chapterController.getMaterialsByChapter);

router.get('/chapter/:id/assessments', chapterController.getAssessmentsByChapter);

router.get('/chapter/:id/assignments', chapterController.getAssignmentsByChapter);

router.get('/chapter/:id/content', chapterController.getContentByChapter);

router.get('/chapter/:id/userchapter', chapterController.getUserChapterByChapterId);

module.exports = router;
