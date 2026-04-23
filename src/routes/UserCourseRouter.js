const express = require('express');
const userCourseController = require('../controllers/UserCourseController');

const router = express.Router();

router.get('/usercourse', userCourseController.getAllUserCourses);

router.get('/usercourse/:id', userCourseController.getUserCourseById);

router.post('/usercourse', userCourseController.createUserCourse);

router.put('/usercourse/:id', userCourseController.updateUserCourse);

router.delete('/usercourse/:id', userCourseController.deleteUserCourse);


router.get('/usercourse/:userId/:courseId', userCourseController.getUserCourseByUserByCourse);

module.exports = router;
