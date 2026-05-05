const UserTradeService = require('../services/UserTradeService');

const getAllUserTrades = async (_, res) => {
    try {
        const UserTrades = await UserTradeService.getAllUserTrades();
        res.status(200).json(UserTrades);
        console.log(`getAllUserTrades successfully requested`);
    } catch (error) {
        res.status(500).json({ message: "Failed to get UserTrades", detail: error.message });
        console.log(error.message);
    }
};

const getUserTradeById = async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid userTrade ID" });
    }

    try {
        const UserTrade = await UserTradeService.getUserTradeById(id);
        if (!UserTrade) {
            return res.status(404).json({ message: `UserTrade with id ${id} not found` });
        }
        res.status(200).json(UserTrade);
    } catch (error) {
        res.status(500).json({ message: `Failed to get UserTrade with id ${id}`, detail: error.message });
        console.log(error.message);
    }
}

const createUserTrade = async (req, res) => {
    try {
        const newData = req.body;
        const UserTrade = await UserTradeService.createUserTrade(newData);
        res.status(201).json({ message: `Successfully created new UserTrade`, UserTrade: UserTrade });
    } catch (error) {
        res.status(500).json({ message: "Failed to create new UserTrade", detail: error.message });
        console.log(error.message);
    }
};

const updateUserTrade = async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid userTrade ID" });
    }
    const updateData = req.body;

    try {
        const updatedUserTrade = await UserTradeService.updateUserTrade(id, updateData);
        if (!updatedUserTrade) {
            return res.status(404).json({ message: `UserTrade with id ${id} not found` });
        }
        res.status(200).json({ message: "Successfully updated UserTrade", UserTrade: updatedUserTrade });
    } catch (error) {
        res.status(500).json({ message: "Failed to update UserTrade", detail: error.message });
        console.log(error.message);
    }
};

const deleteUserTrade = async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid userTrade ID" });
    }

    try {
        const result = await UserTradeService.deleteUserTrade(id);
        if (!result) {
            return res.status(404).json({ message: `UserTrade with id ${id} not found` });
        }
        res.status(200).json({ message: result });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete UserTrade', detail: error.message });
        console.log(error.message);
    }
};

module.exports = {
    getAllUserTrades,
    getUserTradeById,
    createUserTrade,
    updateUserTrade,
    deleteUserTrade
};
