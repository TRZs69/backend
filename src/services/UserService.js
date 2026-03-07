const prisma = require('../prismaClient');
const { determineDifficulty } = require('../utils/elo');

const formatUser = (user) => {
  if (!user) return user;
  const isStudent = String(user.role || '').toUpperCase() === 'STUDENT';
  const effectivePoints = (user.points === null || user.points === undefined) ? 750 : user.points;
  const effectiveElo = (user.elo === null || user.elo === undefined) ? 750 : user.elo;
  return {
    ...user,
    points: isStudent ? Math.max(0, effectivePoints - 750) : null,
    eloTitle: isStudent ? determineDifficulty(effectiveElo) : null
  };
};

exports.getAllUsers = async (role) => {
  try {
    let users;
    if (role) {
      users = await prisma.user.findMany({
        where: { role: role.toUpperCase() },
      });
    } else {
      users = await prisma.user.findMany();
    }
    return users.map(formatUser);
  } catch (error) {
    throw new Error("Error retrieving users");
  }
};

exports.getUserById = async (id) => {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id,
      },
    });
    return formatUser(user);
  } catch (error) {
    throw new Error(error.message);
  }
};

exports.createUser = async (
  name,
  username,
  password,
  role,
  studentId,
  points,
  totalCourses,
  badges,
  instructorId,
  instructorCourses,
  image
) => {
  try {
    const normalizedRole = String(role || '').toUpperCase();
    const isStudent = normalizedRole === 'STUDENT';
    const finalPoints = isStudent
      ? (points === null || points === undefined || points === '' ? 750 : points)
      : null;

    const newUser = await prisma.user.create({
      data: {
        name,
        username,
        password,
        role: normalizedRole || role,
        studentId,
        points: finalPoints,
        totalCourses,
        badges,
        instructorId,
        instructorCourses,
        image,
        createdAt: new Date(),
      },
    });
    return formatUser(newUser);
  } catch (error) {
    throw new Error(error.message);
  }
};

exports.updateUser = async (id, updateData) => {
  try {
    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: { role: true },
    });

    if (!existingUser) {
      throw new Error(`User with id ${id} not found`);
    }

    const normalizedRole = updateData?.role ? String(updateData.role).toUpperCase() : null;
    const effectiveRole = normalizedRole || String(existingUser.role || '').toUpperCase();

    if (effectiveRole !== 'STUDENT') {
      updateData.points = null;
    } else if (updateData.points === null || updateData.points === undefined || updateData.points === '') {
      updateData.points = 750;
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
    });
    return formatUser(user);
  } catch (error) {
    throw new Error(error.message);
  }
};

exports.deleteUser = async (id) => {
  try {
    await prisma.user.delete({
      where: { id },
    });
    return `Success deleting user with id ${id}`;
  } catch (error) {
    throw new Error("Error deleting user: " + error.message);
  }
};
