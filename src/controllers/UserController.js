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

  try {
    const user = await userService.getUserById(id);

    res.status(200).json(user);
  } catch (error) {
    res
      .status(500)
      .json({
        message: `Failed to get user with id ${id}`,
        details: error.message,
      });
    console.log(error.message);
  }
};

const createUser = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const err = new Error("Input value tidak sesuai");
    err.errorStatus = 400;
    err.data = errors.array();
    throw err;
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

    const hashedPassword = await bcrypt.hash(password, 10);

    try {
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

    const response = {
      message: `Successfully registered user ${name} as ${role}`,
      user: newUser,
    };
    res.status(200).json(response);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to create user", details: error.message });
    console.log(error.message);
  }
};

const updateUser = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const err = new Error("Input value tidak sesuai");
    err.errorStatus = 400;
    err.data = errors.array();
    throw err;
  }

    const id = parseInt(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid user id' });
    }
    
    const updateData = req.body;
    console.log("DEBUG: Updating user with data:", updateData);

    if(updateData.password) {
      const hashedPassword = await bcrypt.hash(updateData.password, 10);
      updateData.password = hashedPassword;
    }

    if (updateData.points) {
        updateData.points = parseInt(updateData.points);
    }
    if (updateData.totalCourses) {
        updateData.totalCourses = parseInt(updateData.totalCourses);
    }
    if (updateData.badges) {
        updateData.badges = parseInt(updateData.badges);
    }
    if (updateData.instructorCourses) {
        updateData.instructorCourses = parseInt(updateData.instructorCourses) || null;
    }
    if (updateData.studentId) {
        updateData.studentId = String(updateData.studentId)
    }

  updateData.instructorCourses = updateData.instructorCourses
    ? parseInt(updateData.instructorCourses)
    : null;

  try {
    const updateUser = await userService.updateUser(id, updateData);
    res
      .status(200)
      .json({
        message: `Successfully updated ${updateData.name || 'user'}'s data`,
        user: updateUser,
      });
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ message: error.message });
    }

    res.status(500).json({ message: error.message });
    console.log(error.message);
  }
};

const patchUser = async (req, res) => {
    const id = parseInt(req.params.id);
    const updateData = req.body;

    console.log("DEBUG: Patching user with data:", updateData);

    if(updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }

    try {
        const updatedUser = await userService.patchUser(id, updateData);
        res.status(200).json({ message: "Successfully patched user", user: updatedUser });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteUser = async (req, res) => {
  const id = parseInt(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: 'Invalid user id' });
  }

  try {
    const deleteUser = await userService.deleteUser(id);
    res.status(200).json(deleteUser);
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ message: error.message });
    }

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
