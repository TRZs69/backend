const express = require('express');
const UserTradeController = require('../controllers/UserTradeController');

const router = express.Router();

router.get('/usertrade', UserTradeController.getAllUserTrades);

router.get('/usertrade/:id', UserTradeController.getUserTradeById);

router.post('/usertrade', UserTradeController.createUserTrade);

router.put('/usertrade/:id', UserTradeController.updateUserTrade);

router.delete('/usertrade/:id', UserTradeController.deleteUserTrade);

module.exports = router;
