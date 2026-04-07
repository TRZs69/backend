const prisma = require('../prismaClient');

const chapterListSelect = {
    id: true,
    name: true,
    description: true,
    level: true,
    courseId: true,
    isCheckpoint: true,
    createdAt: true,
    updatedAt: true,
};

const userChapterSelect = {
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
    assessmentPointsEarned: true,  // ← Diperlukan untuk tampilan "Poin Didapat"
    submission: true,
    timeStarted: true,
    timeFinished: true,
    assignmentScore: true,
    assignmentFeedback: true,
    createdAt: true,
    updatedAt: true,
};

exports.getAllCourses = async () => {
    try {
        const courses = await prisma.course.findMany();
        return courses;
    } catch (error) {
        throw new Error(error.message);
    }
};

exports.getCourseById = async (id) => {
    try {
        const course = await prisma.course.findUnique({
            where: {
                id
            },
        });
        return course;
    } catch (error) {
        throw new Error(`Error retrieving course with id ${id}`);
    }
}

exports.createCourse = async (newData) => {
    try {
        const newCourse = await prisma.course.create({
            data: newData,
        });

        return newCourse;
    } catch (error) {
        throw new Error(error.message);
    }
};

exports.updateCourse = async (id, updateData) => {
    try {
        const course = await prisma.course.update({
            where: { id },
            data: updateData,
        });
        return course;
    } catch (error) {
        throw new Error(error.message);
    }
}

exports.deleteCourse = async (id) => {
    try {
        const existingCourse = await prisma.course.findUnique({
            where: { id },
            select: { id: true },
        });

        if (!existingCourse) {
            throw new Error(`Course with id ${id} not found`);
        }

        await prisma.course.delete({
            where: { id },
        });
        return "Success deleting course";
    } catch (error) {
        throw new Error('Error deleting course: ' + error.message);
    }
}

// Special Services

exports.getChapterByCourse = async (id) => {
    try {
        const chapters = await prisma.chapter.findMany({
            where: {
                courseId: parseInt(id)
            },
            orderBy: {
                level: 'asc'
            },
            select: chapterListSelect,
        });

        return chapters;
    } catch (error) {
        throw new Error(error.message);
    }
}

exports.getChapterByCourseForUser = async (courseId, userId) => {
    try {
        const chapters = await prisma.chapter.findMany({
            where: {
                courseId: parseInt(courseId)
            },
            orderBy: {
                level: 'asc'
            },
            select: {
                ...chapterListSelect,
                userProgress: {
                    where: {
                        userId: parseInt(userId)
                    },
                    orderBy: {
                        id: 'desc'
                    },
                    take: 1,
                    select: userChapterSelect,
                }
            }
        });

        return chapters.map((chapter) => ({
            ...chapter,
            status: chapter.userProgress[0] || null,
        }));
    } catch (error) {
        throw new Error(error.message);
    }
}