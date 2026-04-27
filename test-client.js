const axios = require("axios");
const { GoogleAIClient } = require("./src/services/GoogleAIClient");
const client = new GoogleAIClient({ apiKey: process.env.LEVELY_GEMINI_API_KEY });

client.streamComplete({
    messages: [{ role: "user", content: "Hitung 1 sampai 5" }],
    onChunk: (chunk) => process.stdout.write(chunk)
}).then(res => console.log("\nDONE:", res.text)).catch(console.error);