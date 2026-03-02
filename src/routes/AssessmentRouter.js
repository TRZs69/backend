const express = require('express');
// @ts-ignore
const assessmentController = require('../controllers/AssessmentController');
const cacheMiddleware = require('../middlewares/cacheMiddleware');

const router = express.Router();

// Route for get all assessments
router.get('/assessment', cacheMiddleware(300), assessmentController.getAllAssessments);

// Route for get assessment by id
router.get('/assessment/:id', cacheMiddleware(300), assessmentController.getAssessmentById);

// Router for create assessment
router.post('/assessment', assessmentController.createAssessment);

// Router for update assessment by id
router.put('/assessment/:id', assessmentController.updateAssessment);

// Router for delete assessment by id
router.delete('/assessment/:id', assessmentController.deleteAssessment);

// Route for submitting assessment answers
router.post('/assessment/submit', assessmentController.submitAssessment);

module.exports = router;
