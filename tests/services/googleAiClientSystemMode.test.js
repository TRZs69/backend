describe('GoogleAIClient system instruction mode', () => {
	const originalEnv = { ...process.env };

	afterEach(() => {
		jest.resetModules();
		process.env = { ...originalEnv };
	});

	it('uses wrapper mode when LEVELY_GEMINI_SYSTEM_INSTRUCTION_MODE=wrapper', () => {
		process.env.LEVELY_GEMINI_SYSTEM_INSTRUCTION_MODE = 'wrapper';
		const { GoogleAIClient } = require('../../src/services/GoogleAIClient');
		const client = new GoogleAIClient({ apiKey: 'k', model: 'gemma-3-12b-it' });

		const payload = client._buildRequestPayload({
			system: 'SYSTEM RULE',
			messages: [{ role: 'user', content: 'Halo' }],
		});

		expect(payload.systemInstruction).toBeUndefined();
		expect(payload.contents[0].role).toBe('user');
		expect(payload.contents[0].parts[0].text).toContain('INSTRUKSI SISTEM PRIORITAS TERTINGGI');
		expect(payload.contents[1].role).toBe('model');
	});

	it('uses native mode when LEVELY_GEMINI_SYSTEM_INSTRUCTION_MODE=native', () => {
		process.env.LEVELY_GEMINI_SYSTEM_INSTRUCTION_MODE = 'native';
		const { GoogleAIClient } = require('../../src/services/GoogleAIClient');
		const client = new GoogleAIClient({ apiKey: 'k', model: 'gemma-3-12b-it' });

		const payload = client._buildRequestPayload({
			system: 'SYSTEM RULE',
			messages: [{ role: 'user', content: 'Halo' }],
		});

		expect(payload.systemInstruction).toEqual({ parts: [{ text: 'SYSTEM RULE' }] });
		expect(payload.contents.length).toBe(1);
		expect(payload.contents[0].parts[0].text).toBe('Halo');
	});

	it('auto mode keeps gemma on wrapper and non-gemma on native', () => {
		process.env.LEVELY_GEMINI_SYSTEM_INSTRUCTION_MODE = 'auto';
		const { GoogleAIClient } = require('../../src/services/GoogleAIClient');

		const gemmaClient = new GoogleAIClient({ apiKey: 'k', model: 'gemma-3-12b-it' });
		const gemmaPayload = gemmaClient._buildRequestPayload({
			system: 'SYSTEM RULE',
			messages: [{ role: 'user', content: 'Halo' }],
		});
		expect(gemmaPayload.systemInstruction).toBeUndefined();
		expect(gemmaPayload.contents[0].parts[0].text).toContain('INSTRUKSI SISTEM PRIORITAS TERTINGGI');

		const nativeClient = new GoogleAIClient({ apiKey: 'k', model: 'gemini-2.5-pro' });
		const nativePayload = nativeClient._buildRequestPayload({
			system: 'SYSTEM RULE',
			messages: [{ role: 'user', content: 'Halo' }],
		});
		expect(nativePayload.systemInstruction).toEqual({ parts: [{ text: 'SYSTEM RULE' }] });
		expect(nativePayload.contents.length).toBe(1);
	});
});
