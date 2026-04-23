const express = require('express');
const badgeController = require('../controllers/BadgeController');

const router = express.Router();

router.get('/badge', badgeController.getAllBadges);

router.get('/badge/:id', badgeController.getBadgeById);

router.post('/badge', badgeController.createBadge);

router.put('/badge/:id', badgeController.updateBadge);

router.delete('/badge/:id', badgeController.deleteBadge);


module.exports = router;