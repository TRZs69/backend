const prisma = require('../prismaClient');

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
        throw new Error(error.message);
    }
}

exports.updateUserChapterByUserByChapter = async (userId, chapterId, updateData) => {
    try {
        const userChapter = await prisma.userChapter.update({
            where: {
                userId,
                chapterId
            },
            data: updateData,
        });
        return userChapter;
    } catch (error) {
        throw new Error(error.message);
    }
}