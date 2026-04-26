const axios = require("axios");
const { GoogleAIClient } = require("./src/services/GoogleAIClient");
const client = new GoogleAIClient({ apiKey: 'AIzaSyAQSXTbENi5Q5WZ17FchQZWh2j1b-MTva0' });

const start = Date.now();
client.streamComplete({
    messages: [{ role: "user", content: "Hitung 1 sampai 10" }],
    onChunk: (chunk) => console.log(`[${Date.now() - start}ms] CHUNK: ${chunk}`)
}).then(res => console.log(`[${Date.now() - start}ms] DONE`)).catch(console.error);
