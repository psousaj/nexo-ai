import { instrumentService } from '@/services/service-instrumentation';
import type { ItemType } from '@/types';
import { loggers } from '@/utils/logger';
import { messageAnalyzer } from './message-analysis/message-analyzer.service';

/**
 * Classifica tipo de conteúdo baseado na mensagem do usuário
 * Usa NLP como preferência, regex como fallback
 */
export class ClassifierService {
	/**
	 * Detecta tipo de item pela mensagem usando NLP (com fallback em regex)
	 */
	async detectType(message: string): Promise<ItemType | null> {
		try {
			// 1️⃣ Tenta NLP primeiro (mais inteligente)
			const nlpResult = await messageAnalyzer.classifyIntent(message);

			// Mapeia intent NLP para ItemType
			const intentToType: Record<string, ItemType> = {
				'save.movie': 'movie',
				'save.tv_show': 'tv_show',
				'save.video': 'video',
				'save.link': 'link',
				'save.note': 'note',
			};

			// Se confiança > 70% e tem mapeamento, usa NLP
			if (nlpResult.confidence > 0.7 && nlpResult.intent in intentToType) {
				const type = intentToType[nlpResult.intent];
				loggers.ai.info({ type, confidence: nlpResult.confidence }, '🧠 Tipo detectado via NLP');
				return type;
			}

			// 2️⃣ Fallback em regex se NLP não teve confiança
			loggers.ai.info({ confidence: nlpResult.confidence }, '⚡ NLP inconclusivo, usando regex');
			return this.detectTypeWithRegex(message);
		} catch (error) {
			loggers.ai.warn({ error }, '⚠️ Erro no NLP, usando regex');
			return this.detectTypeWithRegex(message);
		}
	}

	/**
	 * Detecta tipo usando regex (fallback)
	 */
	private detectTypeWithRegex(message: string): ItemType | null {
		const lowerMsg = message.toLowerCase();

		// Detecta URLs de vídeo
		if (lowerMsg.includes('youtube.com') || lowerMsg.includes('youtu.be') || lowerMsg.includes('vimeo.com')) {
			return 'video';
		}

		// Detecta URLs genéricas
		if (lowerMsg.match(/https?:\/\//)) {
			return 'link';
		}

		// Detecta séries por palavras-chave
		const tvShowKeywords = ['série', 'serie', 'temporada', 'episódio', 'episodio', 'season', 'episode'];
		if (tvShowKeywords.some((kw) => lowerMsg.includes(kw))) {
			return 'tv_show';
		}

		// Detecta filmes por palavras-chave
		const movieKeywords = ['filme', 'movie', 'assistir', 'netflix', 'prime video', 'disney+'];
		if (movieKeywords.some((kw) => lowerMsg.includes(kw))) {
			return 'movie';
		}

		// Se não detectou nada específico, assume nota
		return 'note';
	}

	/**
	 * Extrai título/query da mensagem
	 */
	extractQuery(message: string, _type: ItemType): string {
		// Remove URLs
		let query = message.replace(/https?:\/\/[^\s]+/g, '').trim();

		// SEGURANÇA: Detecta e rejeita análises de contexto que vazaram
		// Se a query parecer uma explicação ao invés de um título, usa apenas palavras-chave
		const contextLeakPatterns = [
			/usuário anteriormente/i,
			/o usuário.*negou/i,
			/está tentando/i,
			/sugerindo que/i,
			/anteriormente.*enviou/i,
			/^["']?o usuário/i,
		];

		if (contextLeakPatterns.some((pattern) => pattern.test(query))) {
			loggers.ai.warn('⚠️ Detectado vazamento de contexto na query, limpando...');

			// Tenta extrair apenas títulos entre aspas ou palavras capitalizadas
			const quotedMatch = query.match(/["']([^"']+)["']/);
			if (quotedMatch) {
				query = quotedMatch[1].trim();
			} else {
				// Último recurso: pega apenas as últimas palavras (provavelmente o título)
				const words = query.split(/\s+/);
				const lastWords = words.slice(-4).join(' ');
				query = lastWords;
			}
		}

		// Remove palavras-chave comuns
		const keywords = ['filme', 'movie', 'série', 'serie', 'temporada', 'season', 'assistir', 'ver', 'quero ver'];
		keywords.forEach((kw) => {
			const regex = new RegExp(`\\b${kw}\\b`, 'gi');
			query = query.replace(regex, '').trim();
		});

		return query || message;
	}

	/**
	 * Extrai URL de uma mensagem
	 */
	extractUrl(message: string): string | null {
		const urlMatch = message.match(/https?:\/\/[^\s]+/);
		return urlMatch ? urlMatch[0] : null;
	}

	/**
	 * Detecta múltiplos itens na mensagem (separados por vírgula, quebra de linha, etc)
	 * IMPORTANTE: Não quebra frases naturais com vírgulas de contexto
	 */
	detectMultipleItems(message: string): string[] | null {
		// Remove URLs primeiro para não interferir
		const withoutUrls = message.replace(/https?:\/\/[^\s]+/g, '');

		// Verifica se tem quebra de linha (indicador forte de lista)
		if (withoutUrls.includes('\n')) {
			const items = message
				.split('\n')
				.map((item) => item.trim())
				.filter((item) => item.length > 2);

			if (items.length >= 2) {
				return items;
			}
		}

		// Detecta padrões de lista explícita
		// Ex: "Matrix, Inception, Interstellar" (múltiplas vírgulas + palavras curtas)
		const commaCount = (withoutUrls.match(/,/g) || []).length;
		const semicolonCount = (withoutUrls.match(/;/g) || []).length;

		// Só considera lista se tiver múltiplos separadores E palavras curtas (não frases longas)
		if (commaCount >= 2 || semicolonCount >= 1) {
			const items = message
				.split(/[,;]|\s+e\s+/)
				.map((item) => item.trim())
				.filter((item) => item.length > 2 && item.length < 100); // Evita frases longas

			// Valida que os itens parecem títulos (curtos) e não frases completas
			const avgLength = items.reduce((acc, item) => acc + item.length, 0) / items.length;

			if (items.length >= 2 && avgLength < 50) {
				return items;
			}
		}

		return null;
	}
}

export const classifierService = instrumentService('classifier', new ClassifierService());
