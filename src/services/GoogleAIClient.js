const axios = require('axios');
const { GoogleAuth } = require('google-auth-library');

class GoogleAIClient {
	constructor({
		apiKey,
		model = 'gemma-3-12b-it',
		baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models',
	}) {
		this.apiKey = apiKey;
		this.model = model;
		this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
		this.isVertex = this.baseUrl.includes('aiplatform.googleapis.com');
		this.supportsSystemInstruction = !String(this.model).toLowerCase().includes('gemma');

		if (this.isVertex) {
			this.authClient = new GoogleAuth({
				scopes: ['https://www.googleapis.com/auth/cloud-platform'],
			});
		}
	}

	async complete({ messages = [], system = null }) {
		if (!Array.isArray(messages) || !messages.length) {
			throw new Error('Messages are required');
		}

		if (!this.isVertex && !this.apiKey) {
			throw new Error('Missing Google AI API key');
		}

		const contents = messages.map((message) => ({
			role: message.role === 'assistant' ? 'model' : 'user',
			parts: [{ text: message.content }],
		}));

		if (system && !this.supportsSystemInstruction) {
			contents.unshift({
				role: 'user',
				parts: [{ text: `${system}\n\nIkuti instruksi di atas saat memberikan jawaban.` }],
			});
		}

		const payload = {
			contents,
			generationConfig: { temperature: 0.3 },
		};

		if (system && this.supportsSystemInstruction) {
			payload.systemInstruction = { parts: [{ text: system }] };
		}

		const url = this._buildUrl();
		const headers = await this._buildHeaders();
		const response = await axios.post(url, payload, { headers });

		const candidates = response?.data?.candidates || [];
		if (!candidates.length) {
			return '';
		}

		const parts = candidates[0]?.content?.parts || [];
		return parts
			.map((part) => (typeof part.text === 'string' ? part.text : ''))
			.filter(Boolean)
			.join('\n')
			.trim();
	}

	_buildUrl() {
		if (this.isVertex) {
			return `${this.baseUrl}/${this.model}:generateContent`;
		}
		return `${this.baseUrl}/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
	}

	async _buildHeaders() {
		if (this.isVertex) {
			if (!this.authClient) {
				throw new Error('Missing Google auth client for Vertex requests');
			}
			const googleHeaders = await this.authClient.getRequestHeaders();
			return {
				...googleHeaders,
				'Content-Type': 'application/json',
			};
		}

		return { 'Content-Type': 'application/json' };
	}
}

module.exports = { GoogleAIClient };
