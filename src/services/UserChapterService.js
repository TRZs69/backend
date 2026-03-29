const prisma = require('../prismaClient');

const isMissingColumnError = (error, columnName) => {
    const message = error?.message || '';
    return message.includes('does not exist in the current database') && message.includes(columnName);
};

const userChapterLegacySelect = {
    id: true,
    userId: true,
    chapterId: true,
    isStarted: true,
    isCompleted: true,
    materialDone: true,
    assessmentDone: true,
    assignmentDone: true,
    assessmentAnswer: true,
    assessmentGrade: true,
    assessmentEloDelta: true,
    submission: true,
    timeStarted: true,
    timeFinished: true,
    assignmentScore: true,
    assignmentFeedback: true,
    currentDifficulty: true,
    correctStreak: true,
    wrongStreak: true,
    lastAiFeedback: true,
    createdAt: true,
    updatedAt: true,
};

exports.getAllUserChapters = async () => {
    try {
        const userChapters = await prisma.userChapter.findMany();
        return userChapters;
    } catch (error) {
        throw new Error(error.message);
    }
};

exports.getUserChapterById = async (id) => {
    try {
        const userChapter = await prisma.userChapter.findUnique({
            where: {
                id
            },
        });
        return userChapter;
    } catch (error) {
        throw new Error(error.message);
    }
}

exports.createUserChapter = async (newData) => {
    try {
        const newUserChapter = await prisma.userChapter.create({
            data: newData
        });
        return newUserChapter;
    } catch (error) {
        if (isMissingColumnError(error, '`assessmentPointsEarned`')) {
            const { assessmentPointsEarned, ...legacyData } = newData || {};
            const newUserChapter = await prisma.userChapter.create({
                data: legacyData,
                select: userChapterLegacySelect,
            });
            return newUserChapter;
        }
        throw new Error(error.message);
    }
};

exports.updateUserChapter = async (id, updateData) => {
    try {
        const userChapter = await prisma.userChapter.update({
            where: { id },
            data: updateData,
        });
        return userChapter;
    } catch (error) {
        if (isMissingColumnError(error, '`assessmentPointsEarned`')) {
            const { assessmentPointsEarned, ...legacyData } = updateData || {};
            const userChapter = await prisma.userChapter.update({
                where: { id },
                data: legacyData,
                select: userChapterLegacySelect,
            });
            return userChapter;
        }
        throw new Error(error.message);
    }
}

exports.deleteUserChapter = async (id) => {
    try {
        await prisma.userChapter.delete({
            where: { id },
        });
        return `Successfully deleted userChapter with id: ${id}`;
    } catch (error) {
        throw new Error('Error deleting userChapter: ' + error.message);
    }
}

// SPECIAL SERVICES

exports.getUsersByCourse = async (courseId) => {
    try {
        const user = await prisma.userChapter.findMany({
            where: {
                courseId: parseInt(courseId)
            },
            select: {
                user: true
            }
        });

        if (!user.length) {
            throw new Error(`No user found for course with id ${courseId}`);
        }

        return user;
    } catch (error) {
        throw new Error(error.message);
    }
}

exports.getCoursesByUser = async (userId) => {
    try {
        const course = await prisma.userChapter.findMany({
            where: {
                userId: parseInt(userId)
            },
            select: {
                course: true
            }
        });

        if (!course || !course.length) {
            return [];
        }

        return course;
    } catch (error) {
        throw new Error(error.message);
    }
}

exports.getUserChapterByUserByChapter = async (userId, chapterId) => {
    try {
        const userChapter = await prisma.userChapter.findMany({
            where: {
                userId,
                chapterId
            },
        });
        return userChapter;
    } catch (error) {
        if (isMissingColumnError(error, '`graphci.user_chapters.assessmentPointsEarned`') || isMissingColumnError(error, '`assessmentPointsEarned`')) {
            const userChapter = await prisma.userChapter.findMany({
                where: {
                    userId,
                    chapterId
                },
                select: userChapterLegacySelect,
            });
            return userChapter;
        }
        throw new Error(error.message);
    }
}

exports.updateUserChapterByUserByChapter = async (userId, chapterId, updateData) => {
    try {
        // Find existing record to check current status
        const existing = await prisma.userChapter.findFirst({
            where: { userId, chapterId }
        });

        const materialDone = updateData.materialDone !== undefined ? updateData.materialDone : (existing?.materialDone || false);
        const assessmentDone = updateData.assessmentDone !== undefined ? updateData.assessmentDone : (existing?.assessmentDone || false);
        
        // A chapter is completed if both material and assessment are done
        const isCompleted = materialDone && assessmentDone;

        const dataToUpdate = {
            ...updateData,
            isCompleted
        };

        // Set timeFinished if it's newly completed
        if (isCompleted && (!existing || !existing.isCompleted)) {
            dataToUpdate.timeFinished = new Date();
        }

        const userChapter = await prisma.userChapter.updateMany({
            where: {
                userId,
                chapterId
            },
            data: dataToUpdate,
        });
        return userChapter;
    } catch (error) {
        if (isMissingColumnError(error, '`assessmentPointsEarned`')) {
            const { assessmentPointsEarned, ...legacyData } = updateData || {};
            const userChapter = await prisma.userChapter.updateMany({
                where: {
                    userId,
                    chapterId
                },
                data: legacyData,
            });
            return userChapter;
        }
        throw new Error(error.message);
    }
}