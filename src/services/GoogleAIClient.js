const https = require('https');
const { StringDecoder } = require('string_decoder');
const { GoogleAuth } = require('google-auth-library');

class GoogleAIClient {
	constructor({
		apiKey,
		model = 'gemma-3-12b-it',
		baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models',
	}) {
		this.apiKey = typeof apiKey === 'string' ? apiKey.trim() : apiKey;
		this.model = model;
		this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
		this.isVertex = this.baseUrl.includes('aiplatform.googleapis.com');
		this.generationConfig = this._buildGenerationConfig();

		if (this.isVertex) {
			this.authClient = new GoogleAuth({
				scopes: ['https://www.googleapis.com/auth/cloud-platform'],
			});
		}
	}

	_buildGenerationConfig() {
		return {
			temperature: Number(process.env.LEVELY_GEMINI_TEMPERATURE || 0.3),
			maxOutputTokens: Number(process.env.LEVELY_GEMINI_MAX_OUTPUT_TOKENS || 384),
			topP: Number(process.env.LEVELY_GEMINI_TOP_P || 0.9),
		};
	}

	async streamComplete({ messages = [], system = null, onChunk, abortSignal, generationConfig = null }) {
		const payload = this._buildRequestPayload({ messages, system, generationConfig });
		const url = this._buildUrl({ stream: true });
		
		const headers = { 'Content-Type': 'application/json' };
		if (this.isVertex) {
			const authHeaders = await this.authClient.getRequestHeaders();
			Object.assign(headers, authHeaders);
		}

		return new Promise((resolve, reject) => {
			const req = https.request(url, { method: 'POST', headers, signal: abortSignal }, (res) => {
				const decoder = new StringDecoder('utf8');
				let buffer = '';
				let aggregatedText = '';
				let metadata = {};

				res.on('data', (chunk) => {
					buffer += decoder.write(chunk);
					let newlineIndex = buffer.indexOf('\n');
					
					while (newlineIndex !== -1) {
						const line = buffer.slice(0, newlineIndex).trim();
						buffer = buffer.slice(newlineIndex + 1);

						if (line.startsWith('data:')) {
							const jsonStr = line.slice(5).trim();
							if (jsonStr !== '[DONE]') {
								try {
									const parsed = JSON.parse(jsonStr);
									if (parsed?.usageMetadata) metadata = { ...metadata, ...parsed.usageMetadata };
									
									const text = this._extractTextFromParsed(parsed);
									if (text) {
										aggregatedText += text;
										if (onChunk) onChunk(text);
									}
								} catch (e) { /* partial JSON */ }
							}
						}
						newlineIndex = buffer.indexOf('\n');
					}
				});

				res.on('end', () => resolve({ text: aggregatedText, metadata }));
				res.on('error', (err) => reject(err));
			});

			req.on('error', (err) => reject(err));
			req.write(JSON.stringify(payload));
			req.end();
		});
	}

	_extractTextFromParsed(payload) {
		const parts = payload?.candidates?.[0]?.content?.parts || [];
		return parts.map(p => p.text || '').join('');
	}

	_buildRequestPayload({ messages, system, generationConfig }) {
		const contents = messages.map(m => ({
			role: m.role === 'assistant' ? 'model' : 'user',
			parts: [{ text: m.content || '' }, ...(m.media || [])]
		}));

		if (system) {
			contents.unshift({ role: 'user', parts: [{ text: `SYSTEM INSTRUCTION: ${system}` }] });
			contents.push({ role: 'model', parts: [{ text: 'Understood.' }] });
		}

		return {
			contents,
			generationConfig: { ...this.generationConfig, ...generationConfig }
		};
	}

	_buildUrl({ stream = false } = {}) {
		const action = stream ? 'streamGenerateContent' : 'generateContent';
		if (this.isVertex) return `${this.baseUrl}/${this.model}:${action}`;
		return `${this.baseUrl}/${this.model}:${action}?key=${this.apiKey}${stream ? '&alt=sse' : ''}`;
	}

	async complete(args) {
		// Minimal implementation for warmup
		const res = await this.streamComplete({ ...args, onChunk: null });
		return res;
	}
}

module.exports = { GoogleAIClient };
