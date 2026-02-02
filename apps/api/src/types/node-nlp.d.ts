declare module 'node-nlp' {
	export class NlpManager {
		constructor(settings?: any);
		addDocument(locale: string, utterance: string, intent: string): void;
		addAnswer(locale: string, intent: string, answer: string): void;
		addNamedEntityText(entityName: string, optionName: string, languages: string[], texts: string[]): void;
		train(): Promise<any>;
		process(locale: string, text: string): Promise<any>;
		save(filename?: string): void;
		load(filename?: string): void;
		guessLanguage(text: string): { alpha2: string; score: number } | undefined;
	}

	export class SentimentManager {
		process(options: { locale: string; text: string }): Promise<{
			sentiment: {
				score: number;
				comparative: number;
				vote: string;
				numWords: number;
				numHits: number;
			};
		}>;
	}
}
