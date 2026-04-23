const express = require('express');
const UserBadgeController = require('../controllers/UserBadgeController');

const router = express.Router();

router.get('/userbadge', UserBadgeController.getAllUserBadges);

router.get('/userbadge/:id', UserBadgeController.getUserBadgeById);

router.post('/userbadge', UserBadgeController.createUserBadge);

router.put('/userbadge/:id', UserBadgeController.updateUserBadge);

router.delete('/userbadge/:id', UserBadgeController.deleteUserBadge);


module.exports = router;
