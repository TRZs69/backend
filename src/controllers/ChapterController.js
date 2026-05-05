const chapterService = require('../services/ChapterService');

const getAllChapters = async (_, res) => {
    try {
        const chapters = await chapterService.getAllChapters();
        res.status(200).json(chapters);
        console.log(`getAllChapters successfully requested`);
    } catch (error) {
        res.status(500).json({ message: "Failed to get chapters", detail: error.message });
        console.log(error.message);
    }
};

const getChapterById = async (req, res) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid chapter ID" });
    }

    try {
        const chapter = await chapterService.getChapterById(id);
        if (!chapter) {
            return res.status(404).json({ message: `Chapter with id ${id} not found` });
        }
        res.status(200).json(chapter);
    } catch (error) {
        res.status(500).json({ message: `Failed to get chapter with id ${id}`, detail: error.message })
        console.log(error.message);
    }
}

const createChapter = async (req, res) => {
    try {
        const newData = req.body;

        const chapter = await chapterService.createChapter(newData);
        res.status(201).json({ message: `Successfully create new chapter ${newData.name}`, chapter: chapter });
    } catch (error) {
        res.status(500).json({ message: "Failed to create new chapter", detail: error.message });
        console.log(error.message);
    }
};

const updateChapter = async (req, res) => {
    const id = parseInt(req.params.id);
    const updateData = req.body;

    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid chapter ID" });
    }

    try {
        const updatedChapter = await chapterService.updateChapter(id, updateData);
        if (!updatedChapter) {
            return res.status(404).json({ message: `Chapter with id ${id} not found` });
        }
        res.status(200).json({ message: "Successfully updated chapter", chapter: updatedChapter });
    } catch (error) {
        res.status(500).json({ message: "Failed to update chapter", detail: error.message });
        console.log(error.message);
    }
};

const deleteChapter = async (req, res) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid chapter ID" });
    }

    try {
        const result = await chapterService.deleteChapter(id);
        if (!result) {
            return res.status(404).json({ message: `Chapter with id ${id} not found` });
        }
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete chapter', detail: error.message });
        console.log(error.message);
    }
};

const getMaterialsByChapter = async (req, res) => {
    const chapterId = parseInt(req.params.id);

    if (isNaN(chapterId)) {
        return res.status(400).json({ message: "Invalid chapter ID" });
    }

    try {
        const materials = await chapterService.getMaterialsByChapter(chapterId);
        res.status(200).json(materials);
    } catch (error) {
        res.status(500).json({ message: `Failed to get material from chapter ${chapterId}`, detail: error.message });
        console.log(error.message);
    }
};

const getAssessmentsByChapter = async (req, res) => {
    const chapterId = parseInt(req.params.id);
    const userId = req.query.userId ? parseInt(req.query.userId) : null;

    if (isNaN(chapterId)) {
        return res.status(400).json({ message: "Invalid chapter ID" });
    }

    try {
        const assessments = await chapterService.getAssessmentsByChapter(chapterId, userId);
        res.status(200).json(assessments);
    } catch (error) {
        res.status(500).json({ message: `Failed to get assessment from chapter ${chapterId}`, detail: error.message });
        console.log(error.message);
    }
};

const getAssignmentsByChapter = async (req, res) => {
    const chapterId = parseInt(req.params.id);

    if (isNaN(chapterId)) {
        return res.status(400).json({ message: "Invalid chapter ID" });
    }

    try {
        const assignments = await chapterService.getAssignmentsByChapter(chapterId);
        res.status(200).json(assignments);
    } catch (error) {
        res.status(500).json({ message: `Failed to get assignment from chapter ${chapterId}`, detail: error.message });
        console.log(error.message);
    }
};

const getContentByChapter = async (req, res) => {
    const chapterId = parseInt(req.params.id);

    if (isNaN(chapterId)) {
        return res.status(400).json({ message: "Invalid chapter ID" });
    }

    try {
        const materials = await chapterService.getMaterialsByChapter(chapterId);
        const assessments = await chapterService.getAssessmentsByChapter(chapterId);
        const assignments = await chapterService.getAssignmentsByChapter(chapterId);

        const chapterContent = { materials, assessments, assignments };

        res.status(200).json(chapterContent);
    } catch (error) {
        res.status(500).json({ message: `Failed to get contents from chapter ${chapterId}`, detail: error.message });
        console.log(error.message);
    }
}

const getUserChapterByChapterId = async (req, res) => {
    const chapterId = parseInt(req.params.id);

    if (isNaN(chapterId)) {
        return res.status(400).json({ message: "Invalid chapter ID" });
    }

    try {
        const userChapter = await chapterService.getUserChapterByChapterId(chapterId);
        res.status(200).json(userChapter);
    } catch (error) {
        res.status(500).json({ message: `Failed to get user chapters from chapter ${chapterId}`, detail: error.message });
        console.log(error.message);
    }
}


module.exports = {
    getAllChapters,
    getChapterById,
    createChapter,
    updateChapter,
    deleteChapter,
    getMaterialsByChapter,
    getAssessmentsByChapter,
    getAssignmentsByChapter,
    getContentByChapter,
    getUserChapterByChapterId
};
