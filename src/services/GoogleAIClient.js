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
		this._assertMessages(messages);
		this._assertCredentials();

		const payload = this._buildRequestPayload({ messages, system });
		const url = this._buildUrl();
		const headers = await this._buildHeaders();
		const response = await axios.post(url, payload, { headers });

		return this._extractTextFromCandidates(response?.data)?.trim() || '';
	}

	async streamComplete({ messages = [], system = null, onChunk, abortSignal } = {}) {
		this._assertMessages(messages);
		this._assertCredentials();

		if (abortSignal?.aborted) {
			throw new Error('Stream aborted');
		}

		const payload = this._buildRequestPayload({ messages, system });
		const url = this._buildUrl({ stream: true });
		const headers = await this._buildHeaders();
		const response = await axios.post(url, payload, {
			headers,
			responseType: 'stream',
			signal: abortSignal,
		});

		return new Promise((resolve, reject) => {
			let aggregated = '';
			let buffer = '';
			let eventBuffer = '';
			let settled = false;

			const emitChunk = (text) => {
				if (!text) {
					return;
				}
				aggregated += text;
				if (typeof onChunk === 'function') {
					onChunk(text);
				}
			};

			const tryProcessEvent = () => {
				const trimmed = eventBuffer.trim();
				if (!trimmed) {
					return;
				}
				if (trimmed === '[DONE]') {
					eventBuffer = '';
					return;
				}
				try {
					const parsed = JSON.parse(trimmed);
					eventBuffer = '';
					emitChunk(this._extractTextFromCandidates(parsed));
				} catch (error) {
					// Wait for more data.
				}
			};

			const handleLine = (line) => {
				const trimmedLine = line.replace(/\r$/, '');
				if (!trimmedLine) {
					tryProcessEvent();
					return;
				}
				if (trimmedLine.startsWith('data:')) {
					const payloadPart = trimmedLine.slice(5).trim();
					eventBuffer += (eventBuffer ? '\n' : '') + payloadPart;
					tryProcessEvent();
					return;
				}
				eventBuffer += (eventBuffer ? '\n' : '') + trimmedLine;
				tryProcessEvent();
			};

			const onData = (chunk) => {
				buffer += chunk.toString('utf8');
				let newlineIndex = buffer.indexOf('\n');
				while (newlineIndex !== -1) {
					const line = buffer.slice(0, newlineIndex);
					buffer = buffer.slice(newlineIndex + 1);
					handleLine(line);
					newlineIndex = buffer.indexOf('\n');
				}
			};

			const finalize = () => {
				if (buffer) {
					handleLine(buffer);
					buffer = '';
				}
				tryProcessEvent();
				settled = true;
				cleanup();
				resolve(aggregated.trim());
			};

			const fail = (error) => {
				if (settled) {
					return;
				}
				settled = true;
				cleanup();
				reject(error);
			};

			const cleanup = () => {
				const stream = response.data;
				if (stream) {
					const remover = typeof stream.off === 'function' ? stream.off.bind(stream) : stream.removeListener.bind(stream);
					remover('data', onData);
					remover('end', finalize);
					remover('error', fail);
				}
				if (abortSignal && typeof abortSignal.removeEventListener === 'function') {
					abortSignal.removeEventListener('abort', onAbort);
				}
			};

			const onAbort = () => {
				response.data?.destroy(new Error('Stream aborted'));
				fail(new Error('Stream aborted'));
			};

			if (abortSignal && typeof abortSignal.addEventListener === 'function') {
				abortSignal.addEventListener('abort', onAbort);
			}

			response.data.on('data', onData);
			response.data.on('end', finalize);
			response.data.on('error', fail);
		});
	}

	_buildRequestPayload({ messages, system }) {
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

		return payload;
	}

	_extractTextFromCandidates(payload) {
		const candidates = payload?.candidates || [];
		if (!candidates.length) {
			return '';
		}

		const parts = candidates[0]?.content?.parts || [];
		return parts
			.map((part) => (typeof part.text === 'string' ? part.text : ''))
			.filter(Boolean)
			.join('\n');
	}

	_buildUrl({ stream = false } = {}) {
		const action = stream ? 'streamGenerateContent' : 'generateContent';
		if (this.isVertex) {
			return `${this.baseUrl}/${this.model}:${action}`;
		}
		const encodedKey = encodeURIComponent(this.apiKey);
		return `${this.baseUrl}/${this.model}:${action}?key=${encodedKey}`;
	}

	_assertMessages(messages) {
		if (!Array.isArray(messages) || !messages.length) {
			throw new Error('Messages are required');
		}
	}

	_assertCredentials() {
		if (!this.isVertex && !this.apiKey) {
			throw new Error('Missing Google AI API key');
		}
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
