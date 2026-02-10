const prisma = require('../prismaClient');

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
    return users;
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
    return user;
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
    return newUser;
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
    return user;
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
