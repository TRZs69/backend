const prisma = require('../prismaClient');

exports.enrollUserToCourse = async (userId, courseId) => {
    try {
        const enrollment = await prisma.enrollment.create({
            data: {
                userId,
                courseId,
            },
        });
        return enrollment;
    } catch (error) {
        throw new Error(error.message);
    }
};

exports.getEnrollments = async () => {
    try {
        return await prisma.enrollment.findMany({
            include: {
                user: true,
                course: true,
            },
        });
    } catch (error) {
        throw new Error(error.message);
    }
};