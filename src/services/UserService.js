const prisma = require('../prismaClient');
const { determineDifficulty } = require('../utils/elo');

const formatUser = (user) => {
  if (!user) return user;
  const isStudent = String(user.role || '').toUpperCase() === 'STUDENT';
  const effectivePoints = (user.points === null || user.points === undefined) ? 0 : user.points;
  const effectiveElo = (user.elo === null || user.elo === undefined) ? 750 : user.elo;
  return {
    ...user,
    points: isStudent ? Math.max(0, effectivePoints) : null,
    eloTitle: isStudent ? determineDifficulty(effectiveElo) : null
  };
};

exports.getAllUsers = async (role) => {
  try {
    let users;
    const isStudent = role && role.toUpperCase() === 'STUDENT';
    if (role) {
      users = await prisma.user.findMany({
        where: { role: role.toUpperCase() },
        // Jika role STUDENT, urutkan berdasarkan Elo tertinggi
        orderBy: isStudent ? { elo: 'desc' } : { createdAt: 'asc' },
      });
    } else {
      users = await prisma.user.findMany({
        orderBy: { createdAt: 'asc' },
      });
    }
    return users.map(formatUser);
  } catch (error) {
    throw new Error("Error retrieving users");
  }
};

/**
 * Mendapatkan papan peringkat mahasiswa berdasarkan Elo tertinggi.
 * @param {number} limit - Jumlah mahasiswa yang ditampilkan (default 50)
 * @returns {Array} Daftar mahasiswa STUDENT diurutkan Elo descending, dengan tambahan field `rank`
 */
exports.getLeaderboard = async (limit = 50) => {
  try {
    const students = await prisma.user.findMany({
      where: { role: 'STUDENT' },
      orderBy: { elo: 'desc' },
      take: limit,
      select: {
        id: true,
        name: true,
        username: true,
        studentId: true,
        elo: true,
        points: true,
        image: true,
        badges: true,
        totalCourses: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return students.map((student, index) => ({
      ...formatUser(student),
      rank: index + 1,
    }));
  } catch (error) {
    throw new Error('Error retrieving leaderboard: ' + error.message);
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
      ? (points === null || points === undefined || points === '' ? 0 : points)
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
      updateData.points = 0;
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
    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingUser) {
      throw new Error(`User with id ${id} not found`);
    }

    await prisma.user.delete({
      where: { id },
    });
    return `Success deleting user with id ${id}`;
  } catch (error) {
    throw new Error("Error deleting user: " + error.message);
  }
};
