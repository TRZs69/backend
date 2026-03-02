const express = require('express');
// @ts-ignore
const courseController = require('../controllers/CourseController');
const cacheMiddleware = require('../middlewares/cacheMiddleware');

const router = express.Router();

// BASIC ROUTES

// Route for get all courses
router.get('/course', cacheMiddleware(300), courseController.getAllCourses);

// Route for get course by id
router.get('/course/:id', cacheMiddleware(300), courseController.getCourseById);

// Router for create course
router.post('/course', courseController.createCourse);

// Router for update course by id
router.put('/course/:id', courseController.updateCourse);

// Router for delete course by id
router.delete('/course/:id', courseController.deleteCourse);



// SPECIAL ROUTES

// Router for get chapters from course
router.get('/course/:id/chapters', cacheMiddleware(300), courseController.getChapterByCourse);

// Router for get users from course
router.get('/course/:id/users', cacheMiddleware(300), courseController.getUsersByCourse);

// Router for get badges from course
router.get('/course/:id/badges', cacheMiddleware(300), courseController.getBadgesByCourse);


module.exports = router;
