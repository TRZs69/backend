const axios = require('axios');

class LevelyLlmClient {
  async complete() {
    throw new Error('Not implemented');
  }
}

class GeminiApiClient extends LevelyLlmClient {
  constructor({ apiKey = process.env.LEVELY_GEMINI_API_KEY, 
    model = process.env.LEVELY_GEMINI_MODEL, 
    baseUrl = process.env.LEVELY_GEMINI_BASE_URL}) {
    super();
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  }

  async complete({ system, context, messages }) {
    const instruction = mergeInstruction(system, context);
    const payload = {
      contents: messages.map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      })),
      generationConfig: { temperature: 0.3 },
    };

    if (instruction) {
      payload.systemInstruction = { parts: [{ text: instruction }] };
    }

    const url = `${this.baseUrl}/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.data || !Array.isArray(response.data.candidates) || !response.data.candidates.length) {
      return '';
    }

    const parts = ((response.data.candidates[0] || {}).content || {}).parts || [];
    const text = parts
      .map((part) => (typeof part.text === 'string' ? part.text : ''))
      .filter(Boolean)
      .join('\n');
    return text.trim();
  }
}

function mergeInstruction(system, context) {
  const sys = (system || '').trim();
  const ctx = (context || '').trim();
  if (!sys && !ctx) return '';
  if (!sys) return ctx;
  if (!ctx) return sys;
  return `${sys}\n\n${ctx}`;
}

module.exports = {
  LevelyLlmClient,
  GeminiApiClient,
};
