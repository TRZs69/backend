const { GoogleAIClient } = require('../../src/services/GoogleAIClient');

describe('GoogleAIClient Auto-Selection', () => {
	const originalEnv = { ...process.env };

	beforeEach(() => {
		process.env.LEVELY_LLM_MODEL = 'gemma-4-26b-a4b-it';
		process.env.LEVELY_LLM_MODEL_TOOLS = 'gemma-4-31b';
	});

	afterEach(() => {
		process.env = { ...originalEnv };
	});

	it('auto-selects model from LEVELY_LLM_MODEL_TOOLS when tools are present', () => {
		const client = new GoogleAIClient({ apiKey: 'test-key' });

		const payload = client._buildRequestPayload({
			messages: [{ role: 'user', content: 'test' }],
			tools: [{ function_declarations: [{ name: 'get_weather' }] }]
		});

		const modelToUse = client._determineModelName(payload);
		expect(modelToUse).toBe('gemma-4-31b');
	});

	it('stays on LEVELY_LLM_MODEL when tools are NOT present', () => {
		const client = new GoogleAIClient({ apiKey: 'test-key' });

		const payload = client._buildRequestPayload({
			messages: [{ role: 'user', content: 'test' }]
		});

		const modelToUse = client._determineModelName(payload);
		expect(modelToUse).toBe('gemma-4-26b-a4b-it');
	});

	it('uses custom modelTools if provided in constructor', () => {
		const client = new GoogleAIClient({ 
			apiKey: 'test-key', 
			model: 'standard-model',
			modelTools: 'special-tools-model'
		});

		const payload = client._buildRequestPayload({
			messages: [{ role: 'user', content: 'test' }],
			tools: [{ function_declarations: [{ name: 'get_weather' }] }]
		});

		const modelToUse = client._determineModelName(payload);
		expect(modelToUse).toBe('special-tools-model');
	});
});
