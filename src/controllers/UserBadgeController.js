const UserBadgeService = require('../services/UserBadgeService');

const getAllUserBadges = async (_, res) => {
    try {
        const UserBadges = await UserBadgeService.getAllUserBadges();
        res.status(200).json(UserBadges);
        console.log(`getAllUserBadges successfully requested`);
    } catch (error) {
        res.status(500).json({ message: "Failed to get UserBadges", detail: error.message });
        console.log(error.message);
    }
};

const getUserBadgeById = async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid userBadge ID" });
    }

    try {
        const UserBadge = await UserBadgeService.getUserBadgeById(id);
        if (!UserBadge) {
            return res.status(404).json({ message: `UserBadge with id ${id} not found` });
        }
        res.status(200).json(UserBadge);
    } catch (error) {
        res.status(500).json({ message: `Failed to get UserBadge with id ${id}`, detail: error.message });
        console.log(error.message);
    }
}

const createUserBadge = async (req, res) => {
    try {
        const newData = req.body;
        const UserBadge = await UserBadgeService.createUserBadge(newData);
        res.status(201).json({ message: `Successfully created new UserBadge`, UserBadge: UserBadge });
    } catch (error) {
        res.status(500).json({ message: "Failed to create new UserBadge", detail: error.message });
        console.log(error.message);
    }
};

const updateUserBadge = async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid userBadge ID" });
    }
    const updateData = req.body;

    try {
        const updatedUserBadge = await UserBadgeService.updateUserBadge(id, updateData);
        if (!updatedUserBadge) {
            return res.status(404).json({ message: `UserBadge with id ${id} not found` });
        }
        res.status(200).json({ message: "Successfully updated UserBadge", UserBadge: updatedUserBadge });
    } catch (error) {
        res.status(500).json({ message: "Failed to update UserBadge", detail: error.message });
        console.log(error.message);
    }
};

const deleteUserBadge = async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid userBadge ID" });
    }

    try {
        const result = await UserBadgeService.deleteUserBadge(id);
        if (!result) {
            return res.status(404).json({ message: `UserBadge with id ${id} not found` });
        }
        res.status(200).json({ message: result });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete UserBadge', detail: error.message });
        console.log(error.message);
    }
};

module.exports = {
    getAllUserBadges,
    getUserBadgeById,
    createUserBadge,
    updateUserBadge,
    deleteUserBadge
};
