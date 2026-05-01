import type { Language, MessageTone, ToneAnalysisResult } from '../types/analysis-result.types.js';
import { BaseAnalyzer } from './base-analyzer.js';

/**
 * Analisador de Tom de Mensagem
 *
 * Detecta se a mensagem é:
 * - Imperativa: comando direto ("mude", "configure")
 * - Pergunta: termina com "?"
 * - Pedido educado: usa "posso", "poderia", "por favor"
 * - Neutra: outros casos
 *
 * Usado para determinar se bot deve:
 * - Executar ação direta (imperativo)
 * - Dar resposta educada primeiro (pergunta educada)
 */
export class ToneAnalyzer extends BaseAnalyzer<ToneAnalysisResult> {
	protected readonly analyzerType = 'tone' as const;

	// Palavras que indicam educação/cortesia
	private readonly politeWords = {
		pt: new Set(['posso', 'poderia', 'gostaria', 'por favor', 'pfv', 'seria possível', 'você poderia']),
		en: new Set(['can i', 'could i', 'may i', 'please', 'would you', 'could you']),
	};

	// Palavras que indicam pedido de permissão
	private readonly permissionWords = {
		pt: new Set(['posso', 'pode', 'poderia', 'permite', 'deixa']),
		en: new Set(['can i', 'may i', 'could i', 'let me']),
	};

	// Padrões de verbos imperativos no início
	private readonly imperativePatterns = {
		pt: /^(mude|renomeie|configure|altere|troca|define|salve?|delete?|remove|coloca?|bota|põe|adiciona|marca)/i,
		en: /^(change|rename|set|configure|save|delete|remove|put|add|mark|update)/i,
	};

	analyze(message: string, language: Language = 'pt'): ToneAnalysisResult {
		// Se a mensagem estiver vazia, retorna resultado padrão neutro
		if (!message || typeof message !== 'string' || message.trim().length === 0) {
			return {
				type: this.analyzerType,
				timestamp: new Date(),
				confidence: 1.0,
				tone: 'neutral',
				isQuestion: false,
				isPolite: false,
				hasPermissionRequest: false,
			};
		}

		const normalized = this.normalizeMessage(message).toLowerCase();
		const trimmed = message.trim();

		// Detecta características
		const isQuestion = trimmed.endsWith('?');
		const isPolite = this.hasPoliteWords(normalized, language);
		const hasPermissionRequest = this.hasPermissionWords(normalized, language);
		const isImperative = this.imperativePatterns[language].test(normalized) && !isQuestion;

		// Determina tom
		let tone: MessageTone = 'neutral';

		if (isImperative) {
			tone = 'imperative';
		} else if (isQuestion) {
			tone = 'question';
		} else if (isPolite || hasPermissionRequest) {
			tone = 'polite_request';
		}

		// Confidence maior para casos claros
		let confidence = 0.8;
		if (isImperative || (isQuestion && hasPermissionRequest)) {
			confidence = 0.9;
		}

		return {
			type: 'tone',
			timestamp: new Date(),
			confidence,
			tone,
			isPolite,
			isQuestion,
			hasPermissionRequest,
		};
	}

	/**
	 * Verifica se mensagem contém palavras de cortesia
	 */
	private hasPoliteWords(message: string, language: Language): boolean {
		const words = this.politeWords[language];
		for (const word of words) {
			if (message.includes(word)) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Verifica se mensagem pede permissão
	 */
	private hasPermissionWords(message: string, language: Language): boolean {
		const words = this.permissionWords[language];
		for (const word of words) {
			if (message.includes(word)) {
				return true;
			}
		}
		return false;
	}
}
