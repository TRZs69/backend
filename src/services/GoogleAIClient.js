const axios = require('axios');
const { GoogleAuth } = require('google-auth-library');
const http = require('http');
const https = require('https');
const { StringDecoder } = require('string_decoder');

const standardHttpAgent = new http.Agent({ keepAlive: false });
const standardHttpsAgent = new https.Agent({ keepAlive: false });

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

		const response = await this._doRequestWithRetry(() =>
			axios.post(url, payload, {
				headers,
				responseType: 'stream',
				signal: abortSignal,
				httpAgent: standardHttpAgent,
				httpsAgent: standardHttpsAgent,
			})
		);

		return new Promise((resolve, reject) => {
			const decoder = new StringDecoder('utf8');
			let buffer = '';
			let aggregatedText = '';
			let metadata = {};
			let settled = false;

			const finalize = () => {
				if (settled) return;
				settled = true;
				resolve({ text: aggregatedText, metadata });
			};

			const fail = (err) => {
				if (settled) return;
				settled = true;
				reject(err);
			};

			response.data.on('data', (chunk) => {
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
							} catch (e) {
								// Ignore invalid JSON blocks
							}
						}
					}
					newlineIndex = buffer.indexOf('\n');
				}
			});

			response.data.on('end', finalize);
			response.data.on('error', fail);
			if (abortSignal) {
				abortSignal.addEventListener('abort', () => {
					response.data.destroy();
					fail(new Error('Aborted'));
				});
			}
		});
	}

	async _doRequestWithRetry(requestFn, maxRetries = 5) {
		let lastError;
		for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
			try {
				return await requestFn();
			} catch (error) {
				lastError = error;
				const status = error?.response?.status;
				const isRetryable = status === 503 || status === 502 || status === 504 || status === 500 || status === 429;

				if (attempt < maxRetries && isRetryable) {
					const delay = Math.pow(2, attempt) * 1000 + Math.random() * 2000;
					console.warn(`[GoogleAIClient] Attempt ${attempt + 1} failed with ${status}. Retrying in ${Math.round(delay)}ms...`);
					await new Promise((resolve) => setTimeout(resolve, delay));
					continue;
				}
				throw error;
			}
		}
		throw lastError;
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

	async complete({ messages = [], system = null, generationConfig = null }) {
		const payload = this._buildRequestPayload({ messages, system, generationConfig });
		const url = this._buildUrl();
		const headers = { 'Content-Type': 'application/json' };
		if (this.isVertex) {
			const authHeaders = await this.authClient.getRequestHeaders();
			Object.assign(headers, authHeaders);
		}

		const response = await this._doRequestWithRetry(() =>
			axios.post(url, payload, {
				headers,
				httpAgent: standardHttpAgent,
				httpsAgent: standardHttpsAgent,
			})
		);

		return {
			text: this._extractTextFromParsed(response?.data) || '',
			metadata: response?.data?.usageMetadata || {},
		};
	}
}

module.exports = { GoogleAIClient };
