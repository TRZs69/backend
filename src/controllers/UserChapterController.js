const userChapterService = require('../services/UserChapterService');

const {validationResult} = require('express-validator');

const getAllUserChapters = async (_, res) => {
    try {
        const userChapters = await userChapterService.getAllUserChapters();
        res.status(200).json(userChapters);
        console.log(`getAllUserChapters successfully requested`);
    } catch (error) {
        res.status(500).json({ message: "Failed to get userChapters", detail: error.message });
        console.log(error.message);
    }
};

const getUserChapterById = async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid userChapter ID" });
    }

    try {
        const userChapter = await userChapterService.getUserChapterById(id);
        if (!userChapter) {
            return res.status(404).json({ message: `UserChapter with id ${id} not found` });
        }
        res.status(200).json(userChapter);
    } catch (error) {
        res.status(500).json({ message: `Failed to get userChapter with id ${id}`, detail: error.message });
        console.log(error.message);
    }
}

const createUserChapter = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Input value tidak sesuai', errors: errors.array() });
    }

    const newData = req.body;
    try {
        const userChapter = await userChapterService.createUserChapter(newData);
        res.status(201).json({ message: `Successfully create new userChapter`, userChapter: userChapter });
    } catch (error) {
        res.status(500).json({ message: "Failed to create new userChapter", detail: error.message });
        console.log(error.message);
    }
};

const updateUserChapter = async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid userChapter ID" });
    }
    const updateData = req.body;

    try {
        const updatedUserChapter = await userChapterService.updateUserChapter(id, updateData);
        if (!updatedUserChapter) {
            return res.status(404).json({ message: `UserChapter with id ${id} not found` });
        }
        res.status(200).json({ message: "Successfully updated userChapter", data: updatedUserChapter });
    } catch (error) {
        res.status(500).json({ message: "Failed to update userChapter", detail: error.message });
        console.log(error.message);
    }
};

const deleteUserChapter = async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid userChapter ID" });
    }

    try {
        const result = await userChapterService.deleteUserChapter(id);
        if (!result) {
            return res.status(404).json({ message: `UserChapter with id ${id} not found` });
        }
        res.status(200).json({ message: result });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete userChapter', detail: error.message });
        console.log(error.message);
    }
};

const getUserChapterByUserByChapter = async (req, res) => {
    const userId = parseInt(req.params.userId);
    const chapterId = parseInt(req.params.chapterId);

    if (isNaN(userId) || isNaN(chapterId)) {
        return res.status(400).json({ message: "Invalid user ID or chapter ID" });
    }

    try {
        const userChapter = await userChapterService.getUserChapterByUserByChapter(userId, chapterId);
        res.status(200).json(userChapter);
    } catch (error) {
        res.status(500).json({ message: `Failed to get userChapter from user Id: ${userId} and chapter Id: ${chapterId}`, detail: error.message })
        console.log(error.message);
    }
};

const updateUserChapterByUserByChapter = async (req, res) => {
    const userId = parseInt(req.params.userId);
    const chapterId = parseInt(req.params.chapterId);

    if (isNaN(userId) || isNaN(chapterId)) {
        return res.status(400).json({ message: "Invalid user ID or chapter ID" });
    }

    const updateData = req.body;
    try {
        const result = await userChapterService.updateUserChapterByUserByChapter(userId, chapterId, updateData);
        if (!result) {
            return res.status(404).json({ message: `UserChapter for user ${userId} and chapter ${chapterId} not found` });
        }
        res.status(200).json({ message: "Successfully updated userChapter", data: result });
    } catch (error) {
        res.status(500).json({ message: "Failed to update userChapter", detail: error.message });
        console.log(error.message);
    }
};

module.exports = {
    getAllUserChapters,
    getUserChapterById,
    createUserChapter,
    updateUserChapter,
    deleteUserChapter,
    getUserChapterByUserByChapter,
    updateUserChapterByUserByChapter
};
