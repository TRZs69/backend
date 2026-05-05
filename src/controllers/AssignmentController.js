const assignmentService = require('../services/AssignmentService');

const getAllAssignments = async (_, res) => {
    try {
        const assignments = await assignmentService.getAllAssignments();
        res.status(200).json(assignments);
        console.log(`getAllAssignments successfully requested`);
    } catch (error) {
        res.status(500).json({ message: "Failed to get assignments", detail: error.message });
        console.log(error.mesage);
    }
};

const getAssignmentById = async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid assignment ID" });
    }

    try {
        const assignment = await assignmentService.getAssignmentById(id);
        if (!assignment) {
            return res.status(404).json({ message: `Assignment with id ${id} not found` });
        }
        res.status(200).json(assignment);
    } catch (error) {
        res.status(500).json({ message: `Failed to get assignment with id ${id}` })
        console.log(error.message);
    }
}

const createAssignment = async (req, res) => {
    try {
        const newData = req.body;

        const assignment = await assignmentService.createAssignment(newData);
        res.status(201).json({ message: `Successfully create new assignment ${newData.name}`, assignment: assignment });
    } catch (error) {
        res.status(500).json({ message: "Failed to create new assignment", data: error.message });
        console.log(error.message);

    }
};

const updateAssignment = async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid assignment ID" });
    }
    const updateData = req.body;

    try {
        const assignment = await assignmentService.updateAssignment(id, updateData);
        if (!assignment) {
            return res.status(404).json({ message: `Assignment with id ${id} not found` });
        }
        res.status(200).json({ message: "Successfully updated assignment", assignment: assignment });
    } catch (error) {
        res.status(500).json({ message: "Failed to update assignment", detail: error.message });
        console.log(error.message);

    }
};

const deleteAssignment = async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid assignment ID" });
    }

    try {
        const result = await assignmentService.deleteAssignment(id);
        if (!result) {
            return res.status(404).json({ message: `Assignment with id ${id} not found` });
        }
        res.status(200).json({ message: result });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete assignment' });
        console.log(error.message);

    }
};

module.exports = {
    getAllAssignments,
    getAssignmentById,
    createAssignment,
    updateAssignment,
    deleteAssignment
};
