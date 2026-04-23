const express = require('express');
const assignmentController = require('../controllers/AssignmentController');
const cacheMiddleware = require('../middlewares/cacheMiddleware');

const router = express.Router();

router.get('/assignment', cacheMiddleware(300), assignmentController.getAllAssignments);

router.get('/assignment/:id', cacheMiddleware(300), assignmentController.getAssignmentById);

router.post('/assignment', assignmentController.createAssignment);

router.put('/assignment/:id', assignmentController.updateAssignment);

router.delete('/assignment/:id', assignmentController.deleteAssignment);

module.exports = router;
