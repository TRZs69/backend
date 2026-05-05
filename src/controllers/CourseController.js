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

    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid course ID" });
    }

    try {
        const course = await courseService.getCourseById(id);
        if (!course) {
            return res.status(404).json({ message: `Course with id ${id} not found` });
        }
        res.status(200).json(course);
    } catch (error) {
        res.status(500).json({ message: `Failed to get course with id ${ id }`, detail: error.message });
        console.log(error.message);
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

    if (isNaN(courseId)) {
        return res.status(400).json({ message: "Invalid course ID" });
    }

    try {
        const updatedCourse = await courseService.updateCourse(courseId, updateData);
        if (!updatedCourse) {
            return res.status(404).json({ message: `Course with id ${courseId} not found` });
        }
        res.status(200).json({message: "Successfully updated course", course: updatedCourse});
    } catch (error) {
        res.status(500).json({ message: "Failed to update course", detail: error.message });
        console.log(error.message);
    }
};

const deleteCourse = async (req, res) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid course ID" });
    }

    try {
        const result = await courseService.deleteCourse(id);
        if (!result) {
            return res.status(404).json({ message: `Course with id ${id} not found` });
        }
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete course', detail: error.message });
        console.log(error.message);
    }
};

const getChapterByCourse = async (req, res) => {
    const courseId = parseInt(req.params.id);

    if (isNaN(courseId)) {
        return res.status(400).json({ message: "Invalid course ID" });
    }

    try {
        const chapters = await courseService.getChapterByCourse(courseId);
        res.status(200).json(chapters);
    } catch (error) {
        res.status(500).json({ message: `Failed to get chapters in course id: ${courseId}`, detail: error.message});
        console.log(error.message);
    }
}

const getChapterByCourseForUser = async (req, res) => {
    const courseId = parseInt(req.params.id);
    const userId = parseInt(req.params.userId);

    if (isNaN(courseId) || isNaN(userId)) {
        return res.status(400).json({ message: "Invalid course ID or user ID" });
    }

    try {
        const chapters = await courseService.getChapterByCourseForUser(courseId, userId);
        res.status(200).json(chapters);
    } catch (error) {
        res.status(500).json({ message: `Failed to get chapters in course id: ${courseId} for user id: ${userId}`, detail: error.message});
        console.log(error.message);
    }
}

const getUsersByCourse = async (req, res) => {
    const courseId = parseInt(req.params.id);

    if (isNaN(courseId)) {
        return res.status(400).json({ message: "Invalid course ID" });
    }

    try {
        const users = await userCourseService.getUsersByCourse(courseId);
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: `Failed to get users in course ${ courseId }`, detail: error.message})
        console.log(error.message);
    }
}

const getBadgesByCourse = async (req, res) => {
    const courseId = parseInt(req.params.id);

    if (isNaN(courseId)) {
        return res.status(400).json({ message: "Invalid course ID" });
    }

    try {
        const badges = await badgeService.getBadgesByCourse(courseId);
        res.status(200).json(badges);
    } catch (error) {
        res.status(500).json({ message: `Failed to get badges in course ${ courseId }`, detail: error.message})
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
