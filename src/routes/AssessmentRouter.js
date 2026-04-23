const express = require('express');
const assessmentController = require('../controllers/AssessmentController');
const cacheMiddleware = require('../middlewares/cacheMiddleware');

const router = express.Router();

router.post('/assessment/attempt/prefetch', assessmentController.prefetchAttempt);
router.post('/assessment/attempt/start', assessmentController.startAttempt);
router.post('/assessment/attempt/answer', assessmentController.answerAttemptQuestion);
router.get('/assessment/attempt/current', assessmentController.getCurrentAttempt);
router.get('/assessment/attempt/latest', assessmentController.getLatestAttempt);

router.get('/assessment', cacheMiddleware(300), assessmentController.getAllAssessments);

router.get('/assessment/:id', cacheMiddleware(300), assessmentController.getAssessmentById);

router.post('/assessment', assessmentController.createAssessment);

router.put('/assessment/:id', assessmentController.updateAssessment);

router.delete('/assessment/:id', assessmentController.deleteAssessment);

router.post('/assessment/submit', assessmentController.submitAssessment);

module.exports = router;
