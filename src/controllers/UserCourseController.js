const userCourseService = require('../services/UserCourseService');

const getAllUserCourses = async (_, res) => {
    try {
        const userCourses = await userCourseService.getAllUserCourses();
        res.status(200).json(userCourses);
        console.log(`getAllUserCourses successfully requested`);
    } catch (error) {
        res.status(500).json({ message: "Failed to get userCourses", detail: error.message });
        console.log(error.message);
    }
};

const getUserCourseById = async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid userCourse ID" });
    }

    try {
        const userCourse = await userCourseService.getUserCourseById(id);
        if (!userCourse) {
            return res.status(404).json({ message: `UserCourse with id ${id} not found` });
        }
        res.status(200).json(userCourse);
    } catch (error) {
        res.status(500).json({ message: `Failed to get userCourse with id ${id}`, detail: error.message });
        console.log(error.message);
    }
}

const createUserCourse = async (req, res) => {
    try {
        const newData = req.body;
        const userCourse = await userCourseService.createUserCourse(newData);
        res.status(201).json({ message: `Successfully created new userCourse`, userCourse: userCourse });
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: "Failed to create new userCourse", detail: error.message });
        console.log(error.message);
    }
};

const updateUserCourse = async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid userCourse ID" });
    }
    const updateData = req.body;

    try {
        const updatedUserCourse = await userCourseService.updateUserCourse(id, updateData);
        if (!updatedUserCourse) {
            return res.status(404).json({ message: `UserCourse with id ${id} not found` });
        }
        res.status(200).json({ message: "Successfully updated userCourse", data: updatedUserCourse });
    } catch (error) {
        res.status(500).json({ message: "Failed to update userCourse", detail: error.message });
        console.log(error.message);
    }
};

const deleteUserCourse = async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid userCourse ID" });
    }

    try {
        const result = await userCourseService.deleteUserCourse(id);
        if (!result) {
            return res.status(404).json({ message: `UserCourse with id ${id} not found` });
        }
        res.status(200).json({ message: result });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete userCourse', detail: error.message });
        console.log(error.message);
    }
};

const getUserCourseByUserByCourse = async (req, res) => {
    const userId = parseInt(req.params.userId);
    const courseId = parseInt(req.params.courseId);

    if (isNaN(userId) || isNaN(courseId)) {
        return res.status(400).json({ message: "Invalid user ID or course ID" });
    }

    try {
        let userCourse = await userCourseService.getUserCourseByUserByCourse(userId, courseId);
        
        // Auto-enroll if not found to prevent mobile app crash (uc!.id)
        if (!userCourse || (Array.isArray(userCourse) && userCourse.length === 0)) {
            console.log(`Auto-enrolling user ${userId} in course ${courseId} via GET request`);
            try {
                const newEnrollment = await userCourseService.createUserCourse({ userId, courseId });
                userCourse = [newEnrollment];
            } catch (enrollError) {
                // If the error is 409, it means another request enrolled the user.
                // This is the expected race condition, so we can safely fetch the record.
                if (enrollError.statusCode === 409) {
                    userCourse = await userCourseService.getUserCourseByUserByCourse(userId, courseId);
                } else {
                    // For any other error, something is genuinely wrong.
                    throw enrollError;
                }
            }
        }
        
        res.status(200).json(userCourse);
    } catch (error) {
        res.status(500).json({ message: `Failed to get userCourse from user Id: ${userId} and course Id: ${courseId}`, detail: error.message })
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
