const axios = require("axios");
const { GoogleAIClient } = require("./src/services/GoogleAIClient");
const client = new GoogleAIClient({ apiKey: 'AIzaSyAQSXTbENi5Q5WZ17FchQZWh2j1b-MTva0' });

client.streamComplete({
    messages: [{ role: "user", content: "Hitung 1 sampai 5" }],
    onChunk: (chunk) => process.stdout.write(chunk)
}).then(res => console.log("\nDONE:", res.text)).catch(console.error);