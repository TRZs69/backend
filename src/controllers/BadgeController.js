const badgeService = require('../services/BadgeService');

// Controller untuk mendapatkan daftar badge
const getAllBadges = async (req, res) => {
    try {
        const badges = await badgeService.getAllBadges();
        res.status(200).json(badges);
        console.log(`getAllBadges successfully requested`);
    } catch (error) {
        res.status(500).json({ message: "Failed to get badges", detail: error.message });
        console.log(error.mesage);
    }
};

// Controller untuk mendapatkan badge by id
const getBadgeById = async(req, res) => {
    const id = parseInt(req.params.id);

    try {
        const badge = await badgeService.getBadgeById(id);
        res.status(200).json(badge);
    } catch (error) {
        res.status(500).json({ message: `Failed to get badge with id ${ id }`})
        console.log(error.mesage);
        
    }
}

// Controller untuk membuat badge baru
const createBadge = async (req, res) => {
    try {
        const newData = req.body;

        const badge = await badgeService.createBadge(newData);
        res.status(201).json({message: `Successfully create new badge ${newData.name}`, badge: badge});
    } catch (error) {
        res.status(500).json({ message: "Failed to create new badge", data: error.message });
        console.log(error.message);
        
    }
};

// Controller untuk update badge by id
const updateBadge = async (req, res) => {
    const id = parseInt(req.params.id);

    const updateData = req.body;

    try {
        const updateBadge = await badgeService.updateBadge(id, updateData);
        res.status(200).json({message: "Successfully updated badge", badge: updateBadge});
    } catch (error) {
        res.status(500).json({ message: "Failed to update badge", detail: error.message });
        console.log(error.message);
        
    }
};

// Controller untuk delete badge by id
const deleteBadge = async (req, res) => {
    const id = parseInt(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ message: 'Invalid badge id' });
    }

    try {
        const deleteBadge = await badgeService.deleteBadge(id);
        res.status(200).json(deleteBadge);
    } catch (error) {
        if (error.message.includes('not found')) {
            return res.status(404).json({ message: error.message });
        }

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
