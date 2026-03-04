const prisma = require('../prismaClient');

const calculateEloTitle = (points) => {
  const p = points || 750;
  if (p >= 2000) return 'Mastery';
  if (p >= 1800) return 'Advanced';
  if (p >= 1600) return 'Proficient';
  if (p >= 1400) return 'Intermediate';
  if (p >= 1200) return 'Developing Learner';
  if (p >= 1000) return 'Basic Understanding';
  return 'Beginner';
};

const formatUser = (user) => {
  if (!user) return user;
  return {
    ...user,
    eloTitle: calculateEloTitle(user.points)
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
    const newUser = await prisma.user.create({
      data: {
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
