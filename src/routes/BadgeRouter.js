const express = require('express');
// @ts-ignore
const badgeController = require('../controllers/BadgeController');

const router = express.Router();

// Route for get all badges
router.get('/badge', badgeController.getAllBadges);

// Route for get badge by id
router.get('/badge/:id', badgeController.getBadgeById);

// Router for create badge
router.post('/badge', badgeController.createBadge);

// Router for update badge by id
router.put('/badge/:id', badgeController.updateBadge);

// Router for delete badge by id
router.delete('/badge/:id', badgeController.deleteBadge);


module.exports = router;