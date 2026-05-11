const { GoogleAIClient } = require('../../src/services/GoogleAIClient');

describe('GoogleAIClient thinking mode', () => {
	const originalEnv = { ...process.env };

	beforeEach(() => {
		jest.resetModules();
		process.env = { ...originalEnv };
	});

	afterAll(() => {
		process.env = { ...originalEnv };
	});

	it('disables thinking mode by default for gemma-4 models', () => {
		process.env.LEVELY_LLM_THINKING_ENABLED = 'false';
		const client = new GoogleAIClient({ apiKey: 'k', model: 'gemma-4-26b-a4b-it' });
		
		expect(client.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'MINIMAL' });
	});

	it('enables thinking mode when LEVELY_LLM_THINKING_ENABLED=true for gemma-4 models', () => {
		process.env.LEVELY_LLM_THINKING_ENABLED = 'true';
		const client = new GoogleAIClient({ apiKey: 'k', model: 'gemma-4-26b-a4b-it' });
		
		expect(client.generationConfig.thinkingConfig).toBeUndefined();
	});
});
