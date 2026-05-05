const assessmentService = require('../services/AssessmentService');

const getAllAssessments = async (_, res) => {
    try {
        const assessments = await assessmentService.getAllAssessments();
        res.status(200).json(assessments);
        console.log(`getAllAssessments successfully requested`);
    } catch (error) {
        res.status(500).json({ message: "Failed to get assessments", detail: error.message });
        console.log(error.message);
    }
};

const getAssessmentById = async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid assessment ID" });
    }

    try {
        const assessment = await assessmentService.getAssessmentById(id);
        if (!assessment) {
            return res.status(404).json({ message: `Assessment with id ${id} not found` });
        }
        res.status(200).json(assessment);
    } catch (error) {
        res.status(500).json({ message: `Failed to get assessment with id ${id}`, detail: error.message });
        console.log(error.message);
    }
}

const createAssessment = async (req, res) => {
    try {
        const newData = req.body;
        const assessment = await assessmentService.createAssessment(newData);
        res.status(201).json({ message: `Successfully create new assessment`, assessment: assessment });
    } catch (error) {
        res.status(500).json({ message: "Failed to create new assessment", detail: error.message });
        console.log(error.message);
    }
};

const updateAssessment = async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid assessment ID" });
    }
    const updateData = req.body;

    try {
        const updatedAssessment = await assessmentService.updateAssessment(id, updateData);
        if (!updatedAssessment) {
            return res.status(404).json({ message: `Assessment with id ${id} not found` });
        }
        res.status(200).json({ message: "Successfully updated assessment", assessment: updatedAssessment });
    } catch (error) {
        res.status(500).json({ message: "Failed to update assessment", detail: error.message });
        console.log(error.message);
    }
};

const deleteAssessment = async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid assessment ID" });
    }

    try {
        const result = await assessmentService.deleteAssessment(id);
        if (!result) {
            return res.status(404).json({ message: `Assessment with id ${id} not found` });
        }
        res.status(200).json({ message: result });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete assessment', detail: error.message });
        console.log(error.message);
    }
};

const submitAssessment = async (req, res) => {
    try {
        const { userId, chapterId, answers, attemptId } = req.body;

        const result = await assessmentService.processSubmission(userId, chapterId, answers, attemptId);

        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const prefetchAttempt = async (req, res) => {
    try {
        const { userId, chapterId } = req.body || {};
        const result = await assessmentService.prefetchAttempt(userId, chapterId);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const startAttempt = async (req, res) => {
    try {
        const { userId, chapterId, forceNew } = req.body || {};
        const result = await assessmentService.startAttempt(userId, chapterId, forceNew === true);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getCurrentAttempt = async (req, res) => {
    try {
        const userId = req.query.userId ? Number(req.query.userId) : null;
        const chapterId = req.query.chapterId ? Number(req.query.chapterId) : null;
        const result = await assessmentService.getCurrentAttempt(userId, chapterId);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getLatestAttempt = async (req, res) => {
    try {
        const userId = req.query.userId ? Number(req.query.userId) : null;
        const chapterId = req.query.chapterId ? Number(req.query.chapterId) : null;
        const result = await assessmentService.getLatestAttempt(userId, chapterId);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const answerAttemptQuestion = async (req, res) => {
    try {
        const { userId, chapterId, attemptId, questionId, answer } = req.body || {};
        const result = await assessmentService.answerAttemptQuestion(
            userId,
            chapterId,
            attemptId,
            questionId,
            answer,
        );
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getAllAssessments,
    getAssessmentById,
    createAssessment,
    updateAssessment,
    deleteAssessment,
    submitAssessment,
    prefetchAttempt,
    startAttempt,
    getCurrentAttempt,
    getLatestAttempt,
    answerAttemptQuestion
};
