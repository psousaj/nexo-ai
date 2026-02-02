import { BaseAnalyzer } from './base-analyzer.js';
import { SpamAnalysisResult, Language } from '../types/analysis-result.types.js';

/**
 * Detector de spam e flood
 *
 * Heurísticas:
 * - Caracteres repetidos (aaaaaaa)
 * - Excesso de CAPS (>70%)
 * - Spam de emojis (10+)
 * - Múltiplas URLs (3+)
 */
export class SpamAnalyzer extends BaseAnalyzer<SpamAnalysisResult> {
	protected readonly analyzerType = 'spam' as const;

	private readonly REPEATED_CHAR_THRESHOLD = 5;
	private readonly CAPS_PERCENTAGE_THRESHOLD = 0.7;
	private readonly EMOJI_SPAM_THRESHOLD = 10;
	private readonly URL_SPAM_THRESHOLD = 3;
	private readonly MIN_LENGTH_FOR_CAPS_CHECK = 10;

	analyze(message: string, language: Language = 'pt'): SpamAnalysisResult {
		this.validateInput(message);

		const normalized = this.normalizeMessage(message);
		const reasons: string[] = [];

		// Verifica caracteres repetidos (ex: "aaaaaaa", "!!!!!!")
		if (this.hasRepeatedChars(normalized)) {
			reasons.push('repeated_characters');
		}

		// Verifica excesso de maiúsculas (GRITARIA)
		if (this.hasExcessiveCaps(normalized)) {
			reasons.push('excessive_caps');
		}

		// Verifica spam de emojis
		if (this.hasEmojiSpam(normalized)) {
			reasons.push('emoji_spam');
		}

		// Verifica múltiplas URLs
		if (this.hasMultipleUrls(normalized)) {
			reasons.push('multiple_urls');
		}

		// Considera spam se 2+ indicadores
		const isSpam = reasons.length >= 2;

		return {
			type: 'spam' as const,
			timestamp: new Date(),
			confidence: isSpam ? 0.85 : 0.9,
			isSpam,
			reasons: reasons.length > 0 ? reasons : undefined,
		};
	}

	/**
	 * Detecta caracteres repetidos (ex: "aaaaaaa", "!!!!!!")
	 */
	private hasRepeatedChars(message: string): boolean {
		const pattern = new RegExp(`(.)\\1{${this.REPEATED_CHAR_THRESHOLD},}`, 'g');
		return pattern.test(message);
	}

	/**
	 * Detecta excesso de maiúsculas (GRITARIA)
	 */
	private hasExcessiveCaps(message: string): boolean {
		const letters = message.replace(/[^a-zA-Z]/g, '');
		if (letters.length < this.MIN_LENGTH_FOR_CAPS_CHECK) return false;

		const upperCase = message.replace(/[^A-Z]/g, '');
		return upperCase.length / letters.length > this.CAPS_PERCENTAGE_THRESHOLD;
	}

	/**
	 * Detecta spam de emojis
	 */
	private hasEmojiSpam(message: string): boolean {
		// Regex para emojis Unicode
		const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
		const matches = message.match(emojiRegex);
		return (matches?.length ?? 0) > this.EMOJI_SPAM_THRESHOLD;
	}

	/**
	 * Detecta múltiplas URLs (possível spam de links)
	 */
	private hasMultipleUrls(message: string): boolean {
		const urlRegex = /(https?:\/\/[^\s]+)/g;
		const matches = message.match(urlRegex);
		return (matches?.length ?? 0) > this.URL_SPAM_THRESHOLD;
	}
}
