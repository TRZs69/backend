const express = require('express');
// @ts-ignore
const badgeController = require('../controllers/BadgeController');
const cacheMiddleware = require('../middlewares/cacheMiddleware');

const router = express.Router();

// Route for get all badges
router.get('/badge', cacheMiddleware(300), badgeController.getAllBadges);

// Route for get badge by id
router.get('/badge/:id', cacheMiddleware(300), badgeController.getBadgeById);

// Router for create badge
router.post('/badge', badgeController.createBadge);

// Router for update badge by id
router.put('/badge/:id', badgeController.updateBadge);

// Router for delete badge by id
router.delete('/badge/:id', badgeController.deleteBadge);


module.exports = router;