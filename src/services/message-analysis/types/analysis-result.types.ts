export type AnalysisType = 'ambiguity' | 'profanity' | 'sentiment' | 'spam' | 'intent' | 'language';

export type Language = 'pt' | 'en';

export type SeverityLevel = 'low' | 'medium' | 'high';

export interface BaseAnalysisResult {
	type: AnalysisType;
	timestamp: Date;
	confidence: number;
}

export interface LanguageAnalysisResult extends BaseAnalysisResult {
	type: 'language';
	detectedLanguage: Language;
	languageName: string;
}

export interface AmbiguityAnalysisResult extends BaseAnalysisResult {
	type: 'ambiguity';
	isAmbiguous: boolean;
	reason?: 'long_without_command' | 'short_without_command';
	suggestedAction?: 'request_clarification' | 'proceed';
}

export interface SentimentAnalysisResult extends BaseAnalysisResult {
	type: 'sentiment';
	sentiment: 'positive' | 'negative' | 'neutral';
	score: number;
	comparative: number;
	vote: string;
	numWords: number;
	numHits: number;
}

export interface IntentAnalysisResult extends BaseAnalysisResult {
	type: 'intent';
	intent: string;
	action: string;
	score: number;
	entities: Record<string, any>;
	classifications: Array<{ intent: string; score: number }>;
}

export interface ProfanityAnalysisResult extends BaseAnalysisResult {
	type: 'profanity';
	hasProfanity: boolean;
	severity?: SeverityLevel;
	detectedWords?: string[];
}

export interface SpamAnalysisResult extends BaseAnalysisResult {
	type: 'spam';
	isSpam: boolean;
	reasons?: string[];
}

export interface MessageAnalysisReport {
	messageId?: string;
	originalMessage: string;
	language: Language;
	analyzedAt: Date;
	processingTimeMs: number;
	results: {
		language?: LanguageAnalysisResult;
		intent?: IntentAnalysisResult;
		ambiguity?: AmbiguityAnalysisResult;
		sentiment?: SentimentAnalysisResult;
		profanity?: ProfanityAnalysisResult;
		spam?: SpamAnalysisResult;
	};
}
