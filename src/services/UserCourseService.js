const prisma = require('../prismaClient');

const isMissingColumnError = (error, columnName) => {
  const message = error?.message || '';
  return message.includes('does not exist in the current database') && message.includes(columnName);
};

const userCourseLegacySelect = {
  id: true,
  userId: true,
  courseId: true,
  progress: true,
  currentChapter: true,
  isCompleted: true,
  timeStarted: true,
  timeFinished: true,
  enrolledAt: true,
};

exports.getAllUserCourses = async () => {
  try {
    const userCourses = await prisma.userCourse.findMany();
    return userCourses;
  } catch (error) {
    throw new Error(error.message);
  }
};

exports.getUserCourseById = async (id) => {
  try {
    const userCourse = await prisma.userCourse.findUnique({
      where: {
        id,
      },
    });
    return userCourse;
  } catch (error) {
    throw new Error(`Error retrieving userCourse with id ${id}`);
  }
};

exports.createUserCourse = async (newData) => {
  try {
    const newUserCourse = await prisma.userCourse.create({
      data: newData,
    });
    return newUserCourse;
  } catch (error) {
    if (isMissingColumnError(error, '`elo`')) {
      const { elo, ...legacyData } = newData || {};
      const newUserCourse = await prisma.userCourse.create({
        data: legacyData,
        select: userCourseLegacySelect,
      });
      return newUserCourse;
    }
    throw new Error(error.message);
  }
};

exports.updateUserCourse = async (id, updateData) => {
  try {
    const userCourse = await prisma.userCourse.update({
      where: { id },
      data: updateData,
    });
    return userCourse;
  } catch (error) {
    if (isMissingColumnError(error, '`elo`')) {
      const { elo, ...legacyData } = updateData || {};
      const userCourse = await prisma.userCourse.update({
        where: { id },
        data: legacyData,
        select: userCourseLegacySelect,
      });
      return userCourse;
    }
    throw new Error(error.message);
  }
};

exports.deleteUserCourse = async (id) => {
  try {
    await prisma.userCourse.delete({
      where: { id },
    });
    return `Successfully deleted userCourse with id: ${id}`;
  } catch (error) {
    throw new Error("Error deleting userCourse: " + error.message);
  }
};

// SPECIAL SERVICES

exports.getUsersByCourse = async (courseId) => {
  try {
    const user = await prisma.userCourse.findMany({
      where: {
        courseId: parseInt(courseId),
      },
      select: {
        user: true,
      },
    });

    if (!user.length) {
      throw new Error(`No user found for course with id ${courseId}`);
    }

    return user.map((item) => item.user);
  } catch (error) {
    throw new Error(error.message);
  }
};

exports.getCoursesByUser = async (userId) => {
  try {
    const userCourses = await prisma.userCourse.findMany({
      where: {
        userId: parseInt(userId),
      },
      select: {
        progress: true,
        course: {
          select: {
            id: true,
            code: true,
            name: true,
            image: true,
            description: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!userCourses || !userCourses.length) {
      return [];
    }

    return userCourses.map((userCourse) => ({
      course: userCourse.course,
      progress: userCourse.progress,
    }));
  } catch (error) {
    throw new Error(error.message);
  }
};

exports.getUserCourseByUserByCourse = async (userId, courseId) => {
  try {
    const userCourse = await prisma.userCourse.findMany({
      where: {
        userId,
        courseId,
      },
    });
    return userCourse;
  } catch (error) {
    if (isMissingColumnError(error, '`graphci.user_courses.elo`') || isMissingColumnError(error, '`elo`')) {
      const userCourse = await prisma.userCourse.findMany({
        where: {
          userId,
          courseId,
        },
        select: userCourseLegacySelect,
      });
      return userCourse;
    }
    throw new Error(error.message);
  }
};
