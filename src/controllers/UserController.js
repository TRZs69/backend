const bcrypt = require('bcrypt');

const userService = require("../services/UserService");
const userCourseService = require("../services/UserCourseService");
const userBadgeService = require("../services/UserBadgeService");
const UserTradeService = require("../services/UserTradeService");

const { validationResult } = require("express-validator");

const getAllUsers = async (req, res) => {
  const { role } = req.query;
  try {
    const users = await userService.getAllUsers(role);
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

const getLeaderboard = async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  try {
    const leaderboard = await userService.getLeaderboard(limit);
    res.status(200).json(leaderboard);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data leaderboard', details: error.message });
  }
};

const getUserById = async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ message: "Invalid user ID" });
  }

  try {
    const user = await userService.getUserById(id);
    if (!user) {
      return res.status(404).json({ message: `User with id ${id} not found` });
    }
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: `Failed to get user with id ${id}`, detail: error.message });
    console.log(error.message);
  }
};

const createUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: "Input value tidak sesuai", errors: errors.array() });
  }

  const { name,
    username,
    password,
    role,
    student_id,
    student_point,
    student_course,
    student_badge,
    instructor_id,
    instructor_course,
    image
  } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await userService.createUser(
      name,
      username,
      hashedPassword,
      role,
      student_id,
      student_point,
      student_course,
      student_badge,
      instructor_id,
      instructor_course,
      image
    );

    res.status(200).json({
      message: `Successfully registered user ${name} as ${role}`,
      user: newUser,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to create user", detail: error.message });
    console.log(error.message);
  }
};

const updateUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: "Input value tidak sesuai", errors: errors.array() });
  }

  const id = parseInt(req.params.id);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ message: 'Invalid user id' });
  }

  const updateData = req.body;
  if (updateData.password) {
    updateData.password = await bcrypt.hash(updateData.password, 10);
  }

  const numericFields = ['points', 'totalCourses', 'badges', 'instructorCourses'];
  numericFields.forEach(field => {
    if (updateData[field] !== undefined) {
      updateData[field] = parseInt(updateData[field]) || (field === 'instructorCourses' ? null : 0);
    }
  });

  if (updateData.studentId) {
    updateData.studentId = String(updateData.studentId);
  }

  try {
    const updatedUser = await userService.updateUser(id, updateData);
    if (!updatedUser) {
      return res.status(404).json({ message: `User with id ${id} not found` });
    }
    res.status(200).json({
      message: `Successfully updated ${updateData.name || 'user'}'s data`,
      user: updatedUser,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update user", detail: error.message });
    console.log(error.message);
  }
};

const patchUser = async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ message: "Invalid user ID" });
  }
  const updateData = req.body;

  if (updateData.password) {
    updateData.password = await bcrypt.hash(updateData.password, 10);
  }

  try {
    const updatedUser = await userService.patchUser(id, updateData);
    if (!updatedUser) {
      return res.status(404).json({ message: `User with id ${id} not found` });
    }
    res.status(200).json({ message: "Successfully patched user", user: updatedUser });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: "Username sudah digunakan oleh pengguna lain." });
    }
    res.status(500).json({ message: "Failed to patch user", detail: error.message });
  }
};

const deleteUser = async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ message: 'Invalid user id' });
  }

  try {
    const result = await userService.deleteUser(id);
    if (!result) {
      return res.status(404).json({ message: `User with id ${id} not found` });
    }
    res.status(200).json({ message: result });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete user", detail: error.message });
    console.log(error.message);
  }
};

const getCoursesByUser = async (req, res) => {
  const userId = parseInt(req.params.id);

  try {
    const courses = await userCourseService.getCoursesByUser(userId);

    res.status(200).json(courses);
  } catch (error) {
    res
      .status(500)
      .json({
        message: `Failed to get courses in user ${userId}`,
        details: error.message,
      });
    console.log(error.message);
  }
};

const getBadgesByUser = async (req, res) => {
  const userId = parseInt(req.params.id);

  try {
    const badges = await userBadgeService.getBadgesByUser(userId);

    res.status(200).json(badges);
  } catch (error) {
    res
      .status(500)
      .json({
        message: `Failed to get trades in user ${userId}`,
        details: error.message,
      });
    console.log(error.message);
  }
};

const getTradesByUser = async (req, res) => {
  const userId = parseInt(req.params.id);

  try {
    const trades = await UserTradeService.getTradesByUser(userId);

    res.status(200).json(trades);
  } catch (error) {
    res
      .status(500)
      .json({
        message: `Failed to get badges in user ${userId}`,
        details: error.message,
      });
    console.log(error.message);
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  patchUser,
  deleteUser,
  getTradesByUser,
  getCoursesByUser,
  getBadgesByUser,
  getLeaderboard,
};
