const userCourseService = require('../services/UserCourseService');

const getAllUserCourses = async (_, res) => {
    try {
        const userCourses = await userCourseService.getAllUserCourses();
        res.status(200).json(userCourses);
        console.log(`getAllUserCourses successfully requested`);
    } catch (error) {
        res.status(500).json({ message: "Failed to get userCourses", detail: error.message });
        console.log(error.mesage);
    }
};

const getUserCourseById = async(req, res) => {
    const id = parseInt(req.params.id);

    try {
        const userCourse = await userCourseService.getUserCourseById(id);
        res.status(200).json(userCourse);
    } catch (error) {
        res.status(500).json({ message: `Failed to get userCourse with id ${ id }`})
        console.log(error.mesage);
    }
}

const createUserCourse = async (req, res) => {
    try {
        const newData = req.body;

        const userCourse = await userCourseService.createUserCourse(newData);
        res.status(201).json({message: `Successfully create new userCourse ${newData.name}`, userCourse: userCourse});
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: "Failed to create new userCourse", data: error.message });
        console.log(error.message);
        
    }
};

const updateUserCourse = async (req, res) => {
    const user_course_id = parseInt(req.params.id);

    const updateData = req.body;

    try {
        const updateUserCourse = await userCourseService.updateUserCourse(user_course_id, updateData);
        res.status(200).json({message: "Successfully updated userCourse", data: updateUserCourse});
    } catch (error) {
        res.status(500).json({ message: "Failed to update userCourse", detail: error.message });
        console.log(error.message);
    }
};

const deleteUserCourse = async (req, res) => {
    const id = parseInt(req.params.id);

    try {
        const deleteUserCourse = await userCourseService.deleteUserCourse(id);
        res.status(200).json(deleteUserCourse);
    } catch (error) {
        res.status(500).json({ message: 'Failed to create userCourse' });
        console.log(error.message);
        
    }
};

const getUserCourseByUserByCourse = async (req, res) => {
    const userId = parseInt(req.params.userId);
    const courseId = parseInt(req.params.courseId);

    try {
        const userCourse = await userCourseService.getUserCourseByUserByCourse(userId, courseId);
        res.status(200).json(userCourse);
    } catch (error) {
        res.status(500).json({ message: `Failed to get userCourse from user Id: ${ userId } and course Id: ${ courseId }`, detail: error.message})
        console.log(error.message);
    }
};

module.exports = {
    getAllUserCourses,
    getUserCourseById,
    createUserCourse,
    updateUserCourse,
    deleteUserCourse,
    getUserCourseByUserByCourse
};
