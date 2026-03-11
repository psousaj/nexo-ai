export const clarificationMessages = [
	'Recebi sua mensagem. O que deseja fazer?',
	'Entendi! Como você gostaria de classificar esse conteúdo?',
	'Preciso de mais contexto: isso é uma nota, filme, série ou outro tipo?',
];

export const confirmationMessages = [
	'Entendido! Deseja salvar como {type}?',
	'Posso salvar como {type}. Confirma?',
	'Confirma o salvamento como {type}?',
];

export const enrichmentMessages = [
	'Buscando informações adicionais...',
	'Enriquecendo seu conteúdo, aguarde um instante.',
	'Coletando dados extras para melhorar sua experiência.',
];

// Adicione outras categorias conforme necessário
export const clarificationOptions = [
	'💡 Salvar como nota',
	'🎬 Salvar como filme',
	'📺 Salvar como série',
	'🔗 Salvar como link',
	'❌ Cancelar',
];

export const cancellationMessages = [
	'❌ Operação cancelada.',
	'🚫 Tudo bem, cancelei a operação.',
	'👌 Ok, cancelado!',
	'✋ Cancelado conforme solicitado.',
	'🙅 Entendi, vou cancelar isso.',
];

export const processingMessages = [
	'⏳ Aguarde, ainda estou processando sua última mensagem.',
	'🔄 Só um momento, já estou finalizando.',
	'⌛ Calma, estou terminando o que você pediu antes.',
	'⏸️ Um instante, ainda estou trabalhando na sua última solicitação.',
	'🕐 Peraí, quase pronto com o anterior!',
];

/**
 * Helper para selecionar mensagem aleatória e substituir placeholders
 */
export function getRandomMessage(templates: string[], replacements?: Record<string, string>): string {
	const template = templates[Math.floor(Math.random() * templates.length)];

	if (!replacements) {
		return template;
	}

	return Object.entries(replacements).reduce(
		(msg, [key, value]) => msg.replace(new RegExp(`\\{${key}\\}`, 'g'), value),
		template,
	);
}
