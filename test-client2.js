const axios = require("axios");
const { GoogleAIClient } = require("./src/services/GoogleAIClient");
const client = new GoogleAIClient({ apiKey: 'AIzaSyAQSXTbENi5Q5WZ17FchQZWh2j1b-MTva0' });

const payload = client._buildRequestPayload({ messages: [{ role: "user", content: "hi" }] });
axios.post(client._buildUrl({stream: true}), payload, { responseType: 'stream' })
.then(res => {
    res.data.on('data', chunk => console.log(JSON.stringify(chunk.toString())));
});