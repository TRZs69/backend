const userChapterService = require('../services/UserChapterService');

const {validationResult} = require('express-validator');

const getAllUserChapters = async (_, res) => {
    try {
        const userChapters = await userChapterService.getAllUserChapters();
        res.status(200).json(userChapters);
        console.log(`getAllUserChapters successfully requested`);
    } catch (error) {
        res.status(500).json({ message: "Failed to get userChapters", detail: error.message });
        console.log(error.mesage);
    }
};

const getUserChapterById = async(req, res) => {
    const id = parseInt(req.params.id);

    try {
        const userChapter = await userChapterService.getUserChapterById(id);
        res.status(200).json(userChapter);
    } catch (error) {
        res.status(500).json({ message: `Failed to get userChapter with id ${ id }`})
        console.log(error.mesage);
    }
}

const createUserChapter = async (req, res) => {

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        const err = new Error('Input value tidak sesuai');
        err.errorStatus = 400;
        err.data = errors.array();
        throw err;
    }

    const newData = req.body;

    try {
        const userChapter = await userChapterService.createUserChapter(newData);
        res.status(201).json({message: `Successfully create new userChapter ${newData.name}`, userChapter: userChapter});
    } catch (error) {
        res.status(500).json({ message: "Failed to create new userChapter", data: error.message });
        console.log(error.message);
        
    }
};

const updateUserChapter = async (req, res) => {
    const user_course_id = parseInt(req.params.id);

    const updateData = req.body;

    try {
        const updateUserChapter = await userChapterService.updateUserChapter(user_course_id, updateData);
        res.status(200).json({message: "Successfully updated userChapter", data: updateUserChapter});
    } catch (error) {
        res.status(500).json({ message: "Failed to update userChapter", detail: error.message });
        console.log(error.message);
    }
};

const deleteUserChapter = async (req, res) => {
    const id = parseInt(req.params.id);

    try {
        const deleteUserChapter = await userChapterService.deleteUserChapter(id);
        res.status(200).json(deleteUserChapter);
    } catch (error) {
        res.status(500).json({ message: 'Failed to create userChapter' });
        console.log(error.message);
        
    }
};

const getUserChapterByUserByChapter = async (req, res) => {
    const userId = parseInt(req.params.userId);
    const chapterId = parseInt(req.params.chapterId);

    try {
        const userChapter = await userChapterService.getUserChapterByUserByChapter(userId, chapterId);
        res.status(200).json(userChapter);
    } catch (error) {
        res.status(500).json({ message: `Failed to get userChapter from user Id: ${ userId } and course Id: ${ chapterId }`, detail: error.message})
        console.log(error.message);
    }
};

const updateUserChapterByUserByChapter = async (req, res) => {
    const userId = parseInt(req.params.userId);
    const chapterId = parseInt(req.params.chapterId);

    const updateData = req.body;

    try {
        const updateUserChapter = await userChapterService.updateUserChapterByUserByChapter(userId, chapterId, updateData);
        res.status(200).json({message: "Successfully updated userChapter", data: updateUserChapter});
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
