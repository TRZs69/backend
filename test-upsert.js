require("dotenv").config();
const { ensureSession } = require("./src/services/ChatHistoryRepository");
ensureSession({ userId: 1 }).then(id => console.log("SESSION ID:", id)).catch(console.error);