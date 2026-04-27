const { GoogleAIClient } = require("./src/services/GoogleAIClient");
const client = new GoogleAIClient({ apiKey: process.env.GOOGLE_AI_API_KEY });
client.streamComplete({
    messages: [{ role: "user", content: "Context message" }, { role: "user", content: "User prompt" }],
    onChunk: (chunk) => process.stdout.write(chunk)
}).then(res => console.log("\nDONE:", res.text)).catch(console.error);