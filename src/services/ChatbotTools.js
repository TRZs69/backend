
const AVAILABLE_TOOLS = [
	{
		function_declarations: [
			{
				name: 'search_learning_materials',
				description: 'Search for specific topics or keywords within the course learning materials.',
				parameters: {
					type: 'OBJECT',
					properties: {
						query: {
							type: 'STRING',
							description: 'The search term or topic to look for.'
						}
					},
					required: ['query']
				}
			},
			{
				name: 'check_student_progress',
				description: 'Retrieve the current student progress, points, and badges for detailed analysis.',
				parameters: {
					type: 'OBJECT',
					properties: {
						userId: {
							type: 'NUMBER',
							description: 'The ID of the student to check.'
						}
					},
					required: ['userId']
				}
			}
		]
	}
];

const resolveRequiredTools = (prompt, { route, hasMaterialContext }) => {
	const tools = [];
	const normalizedPrompt = String(prompt || '').toLowerCase();

	// Logic: If user asks for search or material not in context, provide the search tool
	if (normalizedPrompt.includes('cari') || normalizedPrompt.includes('search') || (!hasMaterialContext && normalizedPrompt.includes('materi'))) {
		tools.push(AVAILABLE_TOOLS[0]); 
	}

	
	if (route === 'coaching_mode' || normalizedPrompt.includes('poin') || normalizedPrompt.includes('progres') || normalizedPrompt.includes('lencana')) {
		
		if (!tools.includes(AVAILABLE_TOOLS[0])) {
			tools.push(AVAILABLE_TOOLS[0]);
		}
	}

	return tools.length > 0 ? tools : null;
};

const resolveTargetModel = (prompt, { route } = {}) => {
	const normalizedPrompt = String(prompt || '').toLowerCase();
	
	// Keywords that suggest a need for the more capable 31b model
	const complexKeywords = [
		'analisis', 'jelaskan mendalam', 'komprehensif', 'step by step', 
		'langkah demi langkah', 'perbandingan', 'evaluasi', 'kritisi'
	];

	const isComplexIntent = complexKeywords.some(k => normalizedPrompt.includes(k));
	const isCoaching = route === 'coaching_mode';

	
	if (isComplexIntent || isCoaching) {
		return process.env.LEVELY_LLM_MODEL_TOOLS; 
	}

	return process.env.LEVELY_LLM_MODEL; 
};

module.exports = {
	AVAILABLE_TOOLS,
	resolveRequiredTools,
	resolveTargetModel
};
