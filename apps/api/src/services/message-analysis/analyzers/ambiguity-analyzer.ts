import type { AmbiguityAnalysisResult, Language } from '../types/analysis-result.types';
import { BaseAnalyzer } from './base-analyzer';

export class AmbiguityAnalyzer extends BaseAnalyzer<AmbiguityAnalysisResult> {
	protected readonly analyzerType = 'ambiguity' as const;

	private readonly commandPatterns: Record<Language, RegExp> = {
		pt: /^(salva|adiciona|busca|lista|deleta|procura|mostra|remove|cria|cadastra|registra|anota|guarda|lembra)\s+\w+/i,
		en: /^(save|add|search|list|delete|find|show|remove|create|register|note|remember)\s+\w+/i,
	};

	private readonly LONG_MESSAGE_THRESHOLD = 150;
	private readonly SHORT_MESSAGE_THRESHOLD = 50;

	private cache = new Map<string, AmbiguityAnalysisResult>();
	private readonly MAX_CACHE_SIZE = 1000;

	analyze(message: string, language: Language = 'pt'): AmbiguityAnalysisResult {
		this.validateInput(message);

		const cacheKey = `${language}:${message}`;
		const cached = this.cache.get(cacheKey);
		if (cached) return cached;

		const result = this.analyzeInternal(message, language);
		this.cacheResult(cacheKey, result);

		return result;
	}

	private analyzeInternal(message: string, language: Language): AmbiguityAnalysisResult {
		const normalized = this.normalizeMessage(message);
		const pattern = this.commandPatterns[language];
		const hasDirectCommand = pattern.test(normalized);
		const length = normalized.length;

		// Telegram commands (e.g., /start, /help) are NOT ambiguous
		if (message.trim().startsWith('/')) {
			return {
				type: 'ambiguity' as const,
				timestamp: new Date(),
				confidence: 1.0,
				isAmbiguous: false,
				suggestedAction: 'proceed',
			};
		}

		if (length > this.LONG_MESSAGE_THRESHOLD && !hasDirectCommand) {
			return {
				type: 'ambiguity' as const,
				timestamp: new Date(),
				confidence: 0.8,
				isAmbiguous: true,
				reason: 'long_without_command',
				suggestedAction: 'request_clarification',
			};
		}

		if (length < this.SHORT_MESSAGE_THRESHOLD && !hasDirectCommand) {
			return {
				type: 'ambiguity' as const,
				timestamp: new Date(),
				confidence: 0.7,
				isAmbiguous: true,
				reason: 'short_without_command',
				suggestedAction: 'request_clarification',
			};
		}

		return {
			type: 'ambiguity' as const,
			timestamp: new Date(),
			confidence: 0.9,
			isAmbiguous: false,
			suggestedAction: 'proceed',
		};
	}

	private cacheResult(key: string, result: AmbiguityAnalysisResult): void {
		if (this.cache.size >= this.MAX_CACHE_SIZE) {
			const firstKey = this.cache.keys().next().value;
			if (firstKey) this.cache.delete(firstKey);
		}
		this.cache.set(key, result);
	}
}
