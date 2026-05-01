import { toolService } from '@/services/tools/tool.service';
import type { Language } from '../types/analysis-result.types';

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

/**
 * Gera opções de clarificação dinamicamente baseadas nas tools habilitadas
 *
 * ADR-019: Opções são geradas a partir das save tools globalmente habilitadas
 */
export async function getClarificationOptions(language: Language = 'pt'): Promise<string[]> {
	// Busca save tools habilitadas globalmente
	const saveTools = await toolService.getSaveTools();

	// Mapeia tools para opções no idioma correto
	const options = saveTools.map((tool) => {
		const label = language === 'pt' ? tool.label : tool.name.replace('save_', 'Save as ');
		return `${tool.icon} ${label}`;
	});

	// Adiciona opção de cancelar
	const cancelOption = language === 'pt' ? '❌ Cancelar' : '❌ Cancel';
	return [...options, cancelOption];
}

export function getClarificationMessages(language: Language = 'pt'): string[] {
	return clarificationMessages[language];
}

export function getRandomMessage(messages: string[]): string {
	return messages[Math.floor(Math.random() * messages.length)];
}
