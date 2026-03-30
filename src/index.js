const express = require("express");
const multer = require("multer");
const path = require("path");

const authRoutes = require("./routes/AuthRoutes.js");
const authMiddleware = require("./middlewares/AuthMiddleware.js");
const userRoutes = require("./routes/UserRouter.js");
const courseRoutes = require("./routes/CourseRouter.js");
const userCourseRoutes = require("./routes/UserCourseRouter.js");
const userChapterRoutes = require("./routes/UserChapterRouter.js");
const chapterRoutes = require("./routes/ChapterRouter.js");
const materialRoutes = require("./routes/MaterialRouter.js");
const assessmentRoutes = require("./routes/AssessmentRouter.js");
const assignmentRoutes = require("./routes/AssignmentRouter.js");
const badgeRoutes = require("./routes/BadgeRouter.js");
const userBadgeRoutes = require("./routes/UserBadgeRouter.js");
const tradeRoutes = require("./routes/TradeRouter.js");
const userTradeRoutes = require("./routes/UserTradeRouter.js");
const evaluationRoutes = require("./routes/EvaluationRouter.js");
const cors = require("cors");

require("dotenv").config();

// Express Settings
const app = express();
app.use(express.json());

// app.use(multer({storage: fileStorage, fileFilter: fileFilter}).single('image'));
app.use(
  cors({
    origin: ["http://31.97.67.152:7700"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  }),
);

app.use("/api", authRoutes);

// app.use('/api', authMiddleware);

app.use("/api", userRoutes);
app.use("/api", courseRoutes);
app.use("/api", chapterRoutes);
app.use("/api", materialRoutes);
app.use("/api", assessmentRoutes);
app.use("/api", assignmentRoutes);
app.use("/api", userCourseRoutes);
app.use("/api", userChapterRoutes);
app.use("/api", badgeRoutes);
app.use("/api", userBadgeRoutes);
app.use("/api", tradeRoutes);
app.use("/api", userTradeRoutes);
app.use("/api", evaluationRoutes);

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
