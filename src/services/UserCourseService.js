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

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
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
  const userId = Number(newData?.userId);
  const courseId = Number(newData?.courseId);

  if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(courseId) || courseId <= 0) {
    throw createHttpError('userId and courseId must be positive integers', 400);
  }

  try {
    const newUserCourse = await prisma.userCourse.create({
      data: {
        ...newData,
        userId,
        courseId,
      },
    });
    return newUserCourse;
  } catch (error) {
    if (isMissingColumnError(error, '`elo`')) {
      const { elo, ...legacyData } = newData || {};
      const newUserCourse = await prisma.userCourse.create({
        data: {
          ...legacyData,
          userId,
          courseId,
        },
        select: userCourseLegacySelect,
      });
      return newUserCourse;
    }

    if (error?.code === 'P2002') {
      throw createHttpError('Student is already enrolled in this course', 409);
    }

    if (error?.code === 'P2003') {
      throw createHttpError('Invalid userId or courseId', 400);
    }

    throw new Error(error.message);
  }
};

exports.updateUserCourse = async (id, updateData) => {
  try {
    // Prevent the client from manually setting progress or isCompleted
    // We should always rely on our recalculateUserCourseProgress logic
    const { progress, isCompleted, ...safeUpdateData } = updateData;

    const userCourse = await prisma.userCourse.update({
      where: { id },
      data: safeUpdateData,
    });

    // After updating other fields (like currentChapter), trigger a recalculation
    // to ensure progress is still correct and persistent.
    void exports.recalculateUserCourseProgress(userCourse.userId, userCourse.courseId);

    return userCourse;
  } catch (error) {
    if (error.code === 'P2025') {
      return null;
    }
    if (isMissingColumnError(error, '`elo`')) {
      const { elo, progress, isCompleted, ...legacyData } = updateData || {};
      const userCourse = await prisma.userCourse.update({
        where: { id },
        data: legacyData,
        select: userCourseLegacySelect,
      });

      void exports.recalculateUserCourseProgress(userCourse.userId, userCourse.courseId);

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
    if (error.code === 'P2025') {
      return null;
    }
    throw new Error("Error deleting userCourse: " + error.message);
  }
};

exports.getUsersByCourse = async (courseId) => {
  try {
    const usersInCourse = await prisma.userCourse.findMany({
      where: {
        courseId: parseInt(courseId),
      },
      select: {
        user: true,
      },
    });

    return usersInCourse.map((item) => item.user);
  } catch (error) {
    if (isMissingColumnError(error, '`graphci.user_courses.elo`') || isMissingColumnError(error, '`elo`')) {
      const usersInCourse = await prisma.userCourse.findMany({
        where: {
          courseId: parseInt(courseId),
        },
        select: {
          id: true,
          userId: true,
          courseId: true,
          user: true,
        },
      });

      return usersInCourse.map((item) => item.user);
    }

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
      progress: userCourse.progress ?? 0,
    }));
  } catch (error) {
    throw new Error(error.message);
  }
};

exports.recalculateUserCourseProgress = async (userId, courseId) => {
  try {
    console.log(`[recalculateUserCourseProgress] Initiated for userId: ${userId} (${typeof userId}), courseId: ${courseId} (${typeof courseId})`);
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { chapters: true },
    });

    if (!course || course.chapters.length === 0) {
      console.log(`[recalculateUserCourseProgress] Course ${courseId} not found or has no chapters.`);
      return;
    }

    const chapterIds = course.chapters.map((c) => c.id);

    const completedChapters = await prisma.userChapter.findMany({
      where: {
        userId,
        chapterId: { in: chapterIds },
        isCompleted: true,
      },
      select: { chapterId: true },
    });

    const uniqueCompletedCount = new Set(completedChapters.map((c) => c.chapterId)).size;
    const progress = Math.round((uniqueCompletedCount / course.chapters.length) * 100);
    const isCompleted = progress === 100;
    
    console.log(`[recalculateUserCourseProgress] uniqueCompletedCount: ${uniqueCompletedCount}, totalChapters: ${course.chapters.length}, progress: ${progress}`);

    const dataToUpdate = { progress, isCompleted };
    if (isCompleted) {
      dataToUpdate.timeFinished = new Date();
    }

    await prisma.userCourse.updateMany({
      where: { userId, courseId },
      data: dataToUpdate,
    });
  } catch (error) {
    console.error(`Error recalculating progress for User ${userId}, Course ${courseId}:`, error);
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
