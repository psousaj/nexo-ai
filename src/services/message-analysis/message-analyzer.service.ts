import { AmbiguityAnalyzer } from './analyzers/ambiguity-analyzer.js';
import { NexoTrainer } from './training/nexo-trainer.js';
import {
	Language,
	AmbiguityAnalysisResult,
	SentimentAnalysisResult,
	IntentAnalysisResult,
	LanguageAnalysisResult,
	MessageAnalysisReport,
} from './types/analysis-result.types.js';
import { loggers } from '@/utils/logger';

export class MessageAnalyzerService {
	private trainer: NexoTrainer;
	private ambiguityAnalyzer: AmbiguityAnalyzer;
	private initialized = false;

	constructor() {
		this.trainer = new NexoTrainer({ log: false });
		this.ambiguityAnalyzer = new AmbiguityAnalyzer();
	}

	/**
	 * Inicializa o serviço (carrega ou treina modelo)
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return;

		loggers.ai.info('🔧 Inicializando MessageAnalyzerService...');

		// Tentar carregar modelo existente
		const loaded = await this.trainer.load();

		if (!loaded) {
			loggers.ai.info('⚠️ Modelo não encontrado, treinando...');
			await this.trainer.train();
		}

		this.initialized = true;
		loggers.ai.info('✅ MessageAnalyzerService inicializado');
	}

	/**
	 * Re-treina o modelo (use após adicionar novos dados)
	 */
	async retrain(): Promise<void> {
		loggers.ai.info('🔄 Re-treinando modelo...');
		await this.trainer.train();
		loggers.ai.info('✅ Modelo re-treinado');
	}

	/**
	 * Detecta automaticamente o idioma da mensagem
	 */
	detectLanguage(message: string): LanguageAnalysisResult {
		const manager = this.trainer.getManager();
		const guess = manager.guessLanguage(message);
		const detected = guess?.alpha2 === 'pt' || guess?.alpha2 === 'en' ? (guess.alpha2 as Language) : 'pt';

		return {
			type: 'language',
			timestamp: new Date(),
			confidence: guess?.score || 0.5,
			detectedLanguage: detected,
			languageName: detected === 'pt' ? 'Português' : 'English',
		};
	}

	/**
	 * Classifica intenção usando modelo neural treinado
	 */
	async classifyIntent(message: string): Promise<IntentAnalysisResult> {
		await this.ensureInitialized();

		const result = await this.trainer.process(message);

		// Mapear intent para action
		const intentToAction: Record<string, string> = {
			'greetings.hello': 'greet',
			'greetings.bye': 'farewell',
			'save.movie': 'save_movie',
			'save.tv_show': 'save_tv_show',
			'save.video': 'save_video',
			'save.link': 'save_link',
			'save.note': 'save_note',
			'save.previous': 'save_previous',
			'search.all': 'list_all',
			'search.movies': 'search',
			'search.tv_shows': 'search',
			'search.notes': 'search',
			'search.query': 'search',
			'delete.all': 'delete_all',
			'delete.item': 'delete_item',
			'delete.selection': 'delete_selected',
			'confirmation.yes': 'confirm',
			'confirmation.no': 'deny',
			'info.assistant_name': 'get_assistant_name',
			'info.help': 'get_help',
			'settings.change_name': 'update_settings',
		};

		return {
			type: 'intent',
			timestamp: new Date(),
			confidence: result.score || 0,
			intent: result.intent || 'unknown',
			action: intentToAction[result.intent] || 'unknown',
			score: result.score || 0,
			entities: this.extractEntities(result.entities || []),
			classifications: result.classifications || [],
		};
	}

	/**
	 * Extrai entidades do resultado do NLP
	 */
	private extractEntities(entities: any[]): Record<string, any> {
		const result: Record<string, any> = {};

		for (const entity of entities) {
			if (entity.entity === 'item_type') {
				result.itemType = entity.option;
			} else if (entity.entity === 'ordinal') {
				result.selection = parseInt(entity.option);
			} else if (entity.entity === 'genre') {
				result.genre = entity.option;
			} else if (entity.entity === 'url') {
				result.url = entity.sourceText;
			} else {
				result[entity.entity] = entity.sourceText || entity.option;
			}
		}

		return result;
	}

	/**
	 * Verifica ambiguidade de uma mensagem
	 */
	checkAmbiguity(message: string, language: Language = 'pt'): AmbiguityAnalysisResult {
		return this.ambiguityAnalyzer.analyze(message, language);
	}

	/**
	 * Analisa sentimento de uma mensagem usando nlp.js
	 */
	async analyzeSentiment(message: string, language: Language = 'pt'): Promise<SentimentAnalysisResult> {
		await this.ensureInitialized();

		const manager = this.trainer.getManager();
		const result = await manager.process(language, message);

		const sentiment = result.sentiment || { score: 0, comparative: 0, vote: 'neutral', numWords: 0, numHits: 0 };

		return {
			type: 'sentiment',
			timestamp: new Date(),
			confidence: Math.abs(sentiment.score) > 0 ? 0.85 : 0.5,
			sentiment: this.mapVoteToSentiment(sentiment.vote),
			score: sentiment.score || 0,
			comparative: sentiment.comparative || 0,
			vote: sentiment.vote || 'neutral',
			numWords: sentiment.numWords || 0,
			numHits: sentiment.numHits || 0,
		};
	}

	private mapVoteToSentiment(vote: string): 'positive' | 'negative' | 'neutral' {
		if (vote === 'positive') return 'positive';
		if (vote === 'negative') return 'negative';
		return 'neutral';
	}

	/**
	 * Verifica se mensagem contém conteúdo ofensivo
	 */
	async containsOffensiveContent(message: string): Promise<boolean> {
		const sentiment = await this.analyzeSentiment(message);
		return sentiment.score < -3;
	}

	/**
	 * Análise completa da mensagem
	 */
	async analyzeMessage(message: string): Promise<MessageAnalysisReport> {
		const startTime = Date.now();

		await this.ensureInitialized();

		const language = this.detectLanguage(message);

		const [intent, ambiguity, sentiment] = await Promise.all([
			this.classifyIntent(message),
			Promise.resolve(this.checkAmbiguity(message, language.detectedLanguage)),
			this.analyzeSentiment(message, language.detectedLanguage),
		]);

		return {
			originalMessage: message,
			language: language.detectedLanguage,
			analyzedAt: new Date(),
			processingTimeMs: Date.now() - startTime,
			results: {
				language,
				intent,
				ambiguity,
				sentiment,
			},
		};
	}

	private async ensureInitialized(): Promise<void> {
		if (!this.initialized) {
			await this.initialize();
		}
	}
}

// Singleton
export const messageAnalyzer = new MessageAnalyzerService();
