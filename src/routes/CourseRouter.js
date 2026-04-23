const express = require('express');
const courseController = require('../controllers/CourseController');
const cacheMiddleware = require('../middlewares/cacheMiddleware');

const router = express.Router();

router.get('/course', courseController.getAllCourses);

router.get('/course/:id', courseController.getCourseById);

router.post('/course', courseController.createCourse);

router.put('/course/:id', courseController.updateCourse);

router.delete('/course/:id', courseController.deleteCourse);


router.get('/course/:id/chapters/user/:userId', courseController.getChapterByCourseForUser);

router.get('/course/:id/chapters', cacheMiddleware(300), courseController.getChapterByCourse);

router.get('/course/:id/users', cacheMiddleware(300), courseController.getUsersByCourse);

router.get('/course/:id/badges', cacheMiddleware(300), courseController.getBadgesByCourse);


module.exports = router;
