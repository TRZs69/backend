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
const chatbotRoutes = require("./routes/ChatbotRouter.js");
const badgeRoutes = require("./routes/BadgeRouter.js");
const userBadgeRoutes = require("./routes/UserBadgeRouter.js");
const tradeRoutes = require("./routes/TradeRouter.js");
const userTradeRoutes = require("./routes/UserTradeRouter.js");
const cors = require("cors");

require("dotenv").config();

// Express Settings
const app = express();
app.use(express.json());

// app.use(multer({storage: fileStorage, fileFilter: fileFilter}).single('image'));
// Allow local dev hosts plus the original deployed host.
// Allow listed hosts and any localhost/127.0.0.1 origin (mobile/web dev serve random ports)
const allowedOrigins = [
  "http://31.97.67.152:7700",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://172.29.176.1:5173",
  "http://10.84.4.200:5173",
];

app.use(
  cors({
    origin: (origin, callback) => {
      const isLocalhost =
        origin &&
        (origin.startsWith("http://localhost") ||
          origin.startsWith("http://127.0.0.1"));

      if (!origin || allowedOrigins.includes(origin) || isLocalhost) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
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
app.use("/api", chatbotRoutes);
app.use("/api", userCourseRoutes);
app.use("/api", userChapterRoutes);
app.use("/api", badgeRoutes);
app.use("/api", userBadgeRoutes);
app.use("/api", tradeRoutes);
app.use("/api", userTradeRoutes);

app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

app.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 7000;
if (process.env.VERCEL !== "1")
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;