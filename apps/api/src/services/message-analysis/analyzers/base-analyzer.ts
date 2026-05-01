import type { BaseAnalysisResult, Language } from '../types/analysis-result.types';

export abstract class BaseAnalyzer<T extends BaseAnalysisResult> {
	protected abstract readonly analyzerType: T['type'];

	abstract analyze(message: string, language: Language): T | Promise<T>;

	protected validateInput(message: string): void {
		if (!message || typeof message !== 'string') {
			throw new Error('Message must be a non-empty string');
		}
	}

	protected normalizeMessage(message: string): string {
		return message.trim();
	}

	protected createBaseResult(confidence: number): Pick<BaseAnalysisResult, 'timestamp' | 'confidence' | 'type'> {
		return {
			type: this.analyzerType,
			timestamp: new Date(),
			confidence: Math.max(0, Math.min(1, confidence)),
		};
	}
}
