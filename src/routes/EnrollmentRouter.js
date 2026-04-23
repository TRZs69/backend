const express = require("express");
const router = express.Router();
const enrollmentService = require("../services/EnrollmentService");

router.post("/enrollment", async (req, res) => {
    try {
        const { userId, courseId } = req.body;
        const enrollment = await enrollmentService.enrollUserToCourse(userId, courseId);
        res.status(201).json(enrollment);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get("/enrollment", async (_, res) => {
    try {
        const enrollments = await enrollmentService.getEnrollments();
        res.status(200).json(enrollments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
