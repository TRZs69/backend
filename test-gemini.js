const axios = require("axios");
require("dotenv").config();
const key = process.env.LEVELY_GEMINI_API_KEY;
const url = "https://generativelanguage.googleapis.com/v1beta/models/gemma-3-12b-it:streamGenerateContent?alt=sse&key=" + key;
axios.post(url, {
  contents: [{ role: "user", parts: [{ text: "Ceritakan sedikit" }] }]
}, { responseType: "stream" }).then(res => {
  res.data.on("data", chunk => console.log("RAW:", JSON.stringify(chunk.toString())));
}).catch(console.error);
