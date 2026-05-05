const badgeService = require('../services/BadgeService');

const getAllBadges = async (_, res) => {
    try {
        const badges = await badgeService.getAllBadges();
        res.status(200).json(badges);
        console.log(`getAllBadges successfully requested`);
    } catch (error) {
        res.status(500).json({ message: "Failed to get badges", detail: error.message });
        console.log(error.message);
    }
};

const getBadgeById = async(req, res) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid badge ID" });
    }

    try {
        const badge = await badgeService.getBadgeById(id);
        if (!badge) {
            return res.status(404).json({ message: `Badge with id ${id} not found` });
        }
        res.status(200).json(badge);
    } catch (error) {
        res.status(500).json({ message: `Failed to get badge with id ${ id }`, detail: error.message })
        console.log(error.message);
    }
}

const createBadge = async (req, res) => {
    try {
        const newData = req.body;

        const badge = await badgeService.createBadge(newData);
        res.status(201).json({message: `Successfully create new badge ${newData.name}`, badge: badge});
    } catch (error) {
        res.status(500).json({ message: "Failed to create new badge", detail: error.message });
        console.log(error.message);
    }
};

const updateBadge = async (req, res) => {
    const id = parseInt(req.params.id);
    const updateData = req.body;

    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid badge ID" });
    }

    try {
        const updatedBadge = await badgeService.updateBadge(id, updateData);
        if (!updatedBadge) {
            return res.status(404).json({ message: `Badge with id ${id} not found` });
        }
        res.status(200).json({message: "Successfully updated badge", badge: updatedBadge});
    } catch (error) {
        res.status(500).json({ message: "Failed to update badge", detail: error.message });
        console.log(error.message);
    }
};

const deleteBadge = async (req, res) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid badge ID" });
    }

    try {
        const result = await badgeService.deleteBadge(id);
        if (!result) {
            return res.status(404).json({ message: `Badge with id ${id} not found` });
        }
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete badge', detail: error.message });
        console.log(error.message);
    }
};


module.exports = {
    getAllBadges,
    getBadgeById,
    createBadge,
    updateBadge,
    deleteBadge,
};
