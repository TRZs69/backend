const express = require('express');
const tradeController = require('../controllers/TradeController');

const router = express.Router();

router.get('/trade', tradeController.getAllTrades);

router.get('/trade/:id', tradeController.getTradeById);

router.post('/trade', tradeController.createTrade);

router.put('/trade/:id', tradeController.updateTrade);

router.delete('/trade/:id', tradeController.deleteTrade);

module.exports = router;
