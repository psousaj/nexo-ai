import type { Language } from '../types/analysis-result.types';

export const clarificationOptions: Record<Language, string[]> = {
	pt: ['💡 Salvar como nota', '🎬 Salvar como filme', '📺 Salvar como série', '🔗 Salvar como link', '❌ Cancelar'],
	en: ['💡 Save as note', '🎬 Save as movie', '📺 Save as series', '🔗 Save as link', '❌ Cancel'],
};

export const clarificationMessages: Record<Language, string[]> = {
	pt: [
		'Recebi sua mensagem. O que deseja fazer?',
		'Entendi! Como você gostaria de classificar esse conteúdo?',
		'Preciso de mais contexto: isso é uma nota, filme, série ou outro tipo?',
	],
	en: [
		'Got your message. What would you like to do?',
		'Understood! How would you like to classify this content?',
		'I need more context: is this a note, movie, series, or something else?',
	],
};

export function getClarificationOptions(language: Language = 'pt'): string[] {
	return clarificationOptions[language];
}

export function getClarificationMessages(language: Language = 'pt'): string[] {
	return clarificationMessages[language];
}

export function getRandomMessage(messages: string[]): string {
	return messages[Math.floor(Math.random() * messages.length)];
}
