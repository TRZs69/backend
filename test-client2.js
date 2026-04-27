const axios = require("axios");
const { GoogleAIClient } = require("./src/services/GoogleAIClient");
const client = new GoogleAIClient({ apiKey: process.env.GOOGLE_AI_API_KEY });

const payload = client._buildRequestPayload({ messages: [{ role: "user", content: "hi" }] });
axios.post(client._buildUrl({stream: true}), payload, { responseType: 'stream' })
.then(res => {
    res.data.on('data', chunk => console.log(JSON.stringify(chunk.toString())));
});