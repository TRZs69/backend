// @ts-ignore
const courseService = require('../services/CourseService');
const userCourseService = require('../services/UserCourseService');
const badgeService = require('../services/BadgeService');

const getAllCourses = async (_, res) => {
    try {
        const courses = await courseService.getAllCourses();
        res.status(200).json(courses); 
    } catch (error) {
        res.status(500).json({ message: "Failed to get course datas", detail: error.message });
        console.log(error.message);
        
    }
};

const getCourseById = async(req, res) => {
    const id = parseInt(req.params.id);

    try {
        const course = await courseService.getCourseById(id);
        res.status(200).json(course);
    } catch (error) {
        res.status(500).json({ message: `Failed to get course with id ${ id }`})
        console.log(error.mesage);
        
    }
}

const createCourse = async (req, res) => {
    try {
        const newData = req.body;
        const course = await courseService.createCourse(newData);
        res.status(201).json({message: `Successfully create new course ${newData.name}`, course: course});
    } catch (error) {
        res.status(500).json({ message: "Failed to create new course", detail: error.message });
        console.log(error.message);
        
    }
};

const updateCourse = async (req, res) => {
    const courseId = parseInt(req.params.id);
    const updateData = req.body;

    try {
        const updateCourse = await courseService.updateCourse(courseId, updateData);
        res.status(200).json({message: "Successfully updated course", course: updateCourse});
    } catch (error) {
        res.status(500).json({ message: "Failed to update course", detail: error.message });
        console.log(error.message);
        
    }
};

const deleteCourse = async (req, res) => {
    const id = parseInt(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ message: 'Invalid course id' });
    }

    try {
        const deleteCourse = await courseService.deleteCourse(id);
        res.status(200).json(deleteCourse);
    } catch (error) {
        if (error.message.includes('not found')) {
            return res.status(404).json({ message: error.message });
        }

        res.status(500).json({ message: 'Failed to delete course', detail: error.message });
        console.log(error.message);
    }
};

const getChapterByCourse = async (req, res) => {
    const courseId = parseInt(req.params.id);

    try {
        const chapters = await courseService.getChapterByCourse(courseId);
        res.status(200).json(chapters);
    } catch (error) {
        res.status(500).json({ message: `Failed to get chapters in course id: ${courseId}`, details: error.message});
        console.log(error.message);
    }
}

const getChapterByCourseForUser = async (req, res) => {
    const courseId = parseInt(req.params.id);
    const userId = parseInt(req.params.userId);

    try {
        const chapters = await courseService.getChapterByCourseForUser(courseId, userId);
        res.status(200).json(chapters);
    } catch (error) {
        res.status(500).json({ message: `Failed to get chapters in course id: ${courseId} for user id: ${userId}`, details: error.message});
        console.log(error.message);
    }
}

const getUsersByCourse = async (req, res) => {
    const courseId = parseInt(req.params.id);

    try {
        const users = await userCourseService.getUsersByCourse(courseId);
        
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: `Failed to get users in course ${ courseId }`, details: error.message})
        console.log(error.message);
    }
}

const getBadgesByCourse = async (req, res) => {
    const courseId = parseInt(req.params.id);

    try {
        const badges = await badgeService.getBadgesByCourse(courseId);
        res.status(200).json(badges);
    } catch (error) {
        res.status(500).json({ message: `Failed to get badges in course ${ courseId }`, details: error.message})
        console.log(error.message);
    }
}

module.exports = {
    getAllCourses,
    getCourseById,
    createCourse,
    updateCourse,
    deleteCourse,
    getChapterByCourse,
    getChapterByCourseForUser,
    getUsersByCourse,
    getBadgesByCourse
};
