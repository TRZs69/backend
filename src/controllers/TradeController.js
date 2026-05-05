const tradeService = require('../services/TradeService');

const getAllTrades = async (_, res) => {
    try {
        const trades = await tradeService.getAllTrades();
        res.status(200).json(trades);
        console.log(`getAllTrades successfully requested`);
    } catch (error) {
        res.status(500).json({ message: "Failed to get trades", detail: error.message });
        console.log(error.message);
    }
};

const getTradeById = async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid trade ID" });
    }

    try {
        const trade = await tradeService.getTradeById(id);
        if (!trade) {
            return res.status(404).json({ message: `Trade with id ${id} not found` });
        }
        res.status(200).json(trade);
    } catch (error) {
        res.status(500).json({ message: `Failed to get trade with id ${id}`, detail: error.message });
        console.log(error.message);
    }
}

const createTrade = async (req, res) => {
    try {
        const newData = req.body;
        const trade = await tradeService.createTrade(newData);
        res.status(201).json({ message: `Successfully create new trade ${newData.title || ''}`, trade: trade });
    } catch (error) {
        res.status(500).json({ message: "Failed to create new trade", detail: error.message });
        console.log(error.message);
    }
};

const updateTrade = async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid trade ID" });
    }
    const updateData = req.body;

    try {
        const updatedTrade = await tradeService.updateTrade(id, updateData);
        if (!updatedTrade) {
            return res.status(404).json({ message: `Trade with id ${id} not found` });
        }
        res.status(200).json({ message: "Successfully updated trade", trade: updatedTrade });
    } catch (error) {
        res.status(500).json({ message: "Failed to update trade", detail: error.message });
        console.log(error.message);
    }
};

const deleteTrade = async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
        return res.status(400).json({ message: 'Invalid trade id' });
    }

    try {
        const result = await tradeService.deleteTrade(id);
        if (!result) {
            return res.status(404).json({ message: `Trade with id ${id} not found` });
        }
        res.status(200).json({ message: result });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete trade', detail: error.message });
        console.log(error.message);
    }
};

module.exports = {
    getAllTrades,
    getTradeById,
    createTrade,
    updateTrade,
    deleteTrade
};
