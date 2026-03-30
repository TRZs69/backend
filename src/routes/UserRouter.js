const express = require('express');
// @ts-ignore
const userController = require('../controllers/UserController');
const { uploadImage } = require('../middlewares/FileUpload');

const router = express.Router();

// Route for get all users
router.get('/user', userController.getAllUsers);

// Route for leaderboard (mahasiswa diurutkan berdasarkan Elo tertinggi)
// HARUS sebelum /user/:id agar tidak dianggap sebagai id parameter
router.get('/user/leaderboard', userController.getLeaderboard);

// Route for get user by id
router.get('/user/:id', userController.getUserById);

// Router for create user
router.post('/user', uploadImage, userController.createUser);

// Router for update user by id
router.put('/user/:id', uploadImage, userController.updateUser);

// Router for delete user by id
router.delete('/user/:id', userController.deleteUser);


// SPECIAL ROUTES

// Get Courses by User
router.get('/user/:id/courses', userController.getCoursesByUser);

// Get Badges by User
router.get('/user/:id/badges', userController.getBadgesByUser);

// Get Trades by User
router.get('/user/:id/trades', userController.getTradesByUser);

module.exports = router;
