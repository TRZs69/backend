const UserTradeService = require('../services/UserTradeService');

const getAllUserTrades = async (_, res) => {
    try {
        const UserTrades = await UserTradeService.getAllUserTrades();
        res.status(200).json(UserTrades);
        console.log(`getAllUserTrades successfully requested`);
    } catch (error) {
        res.status(500).json({ message: "Failed to get UserTrades", detail: error.message });
        console.log(error.mesage);
    }
};

const getUserTradeById = async(req, res) => {
    const id = parseInt(req.params.id);

    try {
        const UserTrade = await UserTradeService.getUserTradeById(id);
        res.status(200).json(UserTrade);
    } catch (error) {
        res.status(500).json({ message: `Failed to get UserTrade with id ${ id }`})
        console.log(error.mesage);
        
    }
}

const createUserTrade = async (req, res) => {
    try {
        const newData = req.body;

        const UserTrade = await UserTradeService.createUserTrade(newData);
        res.status(201).json({message: `Successfully create new UserTrade ${newData.name}`, UserTrade: UserTrade});
    } catch (error) {
        res.status(500).json({ message: "Failed to create new UserTrade", data: error.message });
        console.log(error.message);
        
    }
};

const updateUserTrade = async (req, res) => {
    const id = parseInt(req.params.id);

    const updateData = req.body;

    try {
        const updateUserTrade = await UserTradeService.updateUserTrade(id, updateData);
        res.status(200).json({message: "Successfully updated UserTrade", UserTrade: updateUserTrade});
    } catch (error) {
        res.status(500).json({ message: "Failed to update UserTrade", detail: error.message });
        console.log(error.message);
        
    }
};

const deleteUserTrade = async (req, res) => {
    const id = parseInt(req.params.id);

    try {
        const deleteUserTrade = await UserTradeService.deleteUserTrade(id);
        res.status(200).json(deleteUserTrade);
    } catch (error) {
        res.status(500).json({ message: 'Failed to create UserTrade' });
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
