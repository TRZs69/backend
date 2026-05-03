const express = require('express');
const userController = require('../controllers/UserController');
const { uploadImage } = require('../middlewares/FileUpload');

const router = express.Router();

router.get('/user', userController.getAllUsers);

router.get('/user/leaderboard', userController.getLeaderboard);

router.get('/user/:id', userController.getUserById);

router.post('/user', uploadImage, userController.createUser);

router.put('/:id', uploadImage, userController.updateUser);
router.patch('/:id', userController.patchUser);
router.delete('/:id', userController.deleteUser);


router.get('/user/:id/courses', userController.getCoursesByUser);

router.get('/user/:id/badges', userController.getBadgesByUser);

router.get('/user/:id/trades', userController.getTradesByUser);

module.exports = router;
