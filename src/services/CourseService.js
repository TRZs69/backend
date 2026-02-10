const prisma = require('../prismaClient');

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

exports.updateCourse = async(id, updateData) => {
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

exports.deleteCourse = async(id) => {
    try {
        await prisma.course.delete({
            where: { id },
        });
        return "Success deleting course";
    } catch (error) {
        throw new Error('Error deleting course: ' + error.message); 
    }
}

// Special Services

exports.getChapterByCourse = async(id) => {
    try {
        const chapters = await prisma.chapter.findMany({
            where: {
                courseId: parseInt(id)
            }
        });

        if (!chapters.length) {
            throw new Error(`No chapter found for course with id ${id}`);
        }

        return chapters;
    } catch (error) {
        throw new Error(error.message);
    }
}