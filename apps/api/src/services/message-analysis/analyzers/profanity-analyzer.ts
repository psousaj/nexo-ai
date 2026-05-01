import type { Language, ProfanityAnalysisResult, SeverityLevel } from '../types/analysis-result.types.js';
import { BaseAnalyzer } from './base-analyzer.js';

/**
 * Detector de palavrões e conteúdo ofensivo
 *
 * Suporta:
 * - Dicionário PT-BR e EN
 * - Detecção de variações (l33t speak: m3rd@, p0rr4)
 * - Classificação de severidade (low/medium/high)
 */
export class ProfanityAnalyzer extends BaseAnalyzer<ProfanityAnalysisResult> {
	protected readonly analyzerType = 'profanity' as const;

	// Dicionários de palavrões por severidade
	private readonly profanityDictionaries: Record<Language, Record<SeverityLevel, Set<string>>> = {
		pt: {
			high: new Set([
				'fdp',
				'filho da puta',
				'puta que pariu',
				'vai tomar no cu',
				'vtmnc',
				'vsf',
				'vai se fuder',
				'arrombado',
				'desgraçado',
				'cuzao',
				'cuzão',
				'filha da puta',
				'pqp',
				'tnc',
				'vtnc',
				'foda-se',
				'fodase',
			]),
			medium: new Set([
				'cu',
				'caralho',
				'porra',
				'merda',
				'bosta',
				'cacete',
				'puta',
				'corno',
				'viado',
				'bicha',
				'buceta',
				'piroca',
				'rola',
				'foder',
			]),
			low: new Set([
				'burro',
				'idiota',
				'imbecil',
				'retardado',
				'estúpido',
				'babaca',
				'cala a boca',
				'cala boca',
				'lixo',
				'inútil',
				'incompetente',
				'otário',
				'trouxa',
				'mané',
				'anta',
				'jumento',
			]),
		},
		en: {
			high: new Set(['fuck', 'fucking', 'motherfucker', 'fucker', 'cunt', 'nigger', 'faggot', 'fag', 'stfu', 'gtfo']),
			medium: new Set(['shit', 'ass', 'asshole', 'bitch', 'dick', 'cock', 'pussy', 'damn', 'bastard', 'whore', 'slut']),
			low: new Set(['stupid', 'idiot', 'dumb', 'moron', 'jerk', 'loser', 'shut up', 'trash', 'useless', 'pathetic']),
		},
	};

	// Mapa de substituições l33t speak
	private readonly leetMap: Record<string, string> = {
		'@': 'a',
		'4': 'a',
		'^': 'a',
		'3': 'e',
		'€': 'e',
		'1': 'i',
		'!': 'i',
		'|': 'i',
		'0': 'o',
		ø: 'o',
		$: 's',
		'5': 's',
		'7': 't',
		'+': 't',
		µ: 'u',
		ü: 'u',
	};

	analyze(message: string, language: Language = 'pt'): ProfanityAnalysisResult {
		this.validateInput(message);

		const normalized = this.normalizeMessage(message).toLowerCase();
		const deleet = this.decodeLeetSpeak(normalized);
		const dictionary = this.profanityDictionaries[language];
		const detectedWords: string[] = [];
		let maxSeverity: SeverityLevel = 'low';

		// Verifica cada nível de severidade (do mais alto ao mais baixo)
		const severityLevels: SeverityLevel[] = ['high', 'medium', 'low'];

		for (const severity of severityLevels) {
			for (const badWord of dictionary[severity]) {
				if (this.containsWord(normalized, badWord) || this.containsWord(deleet, badWord)) {
					if (!detectedWords.includes(badWord)) {
						detectedWords.push(badWord);
					}
					// Mantém a maior severidade encontrada
					if (severity === 'high') maxSeverity = 'high';
					else if (severity === 'medium' && maxSeverity !== 'high') maxSeverity = 'medium';
				}
			}
		}

		const hasProfanity = detectedWords.length > 0;

		return {
			type: 'profanity' as const,
			timestamp: new Date(),
			confidence: hasProfanity ? 0.95 : 0.9,
			hasProfanity,
			severity: hasProfanity ? maxSeverity : undefined,
			detectedWords: hasProfanity ? detectedWords : undefined,
		};
	}

	/**
	 * Decodifica l33t speak para texto normal
	 */
	private decodeLeetSpeak(text: string): string {
		let decoded = text;
		for (const [leet, char] of Object.entries(this.leetMap)) {
			decoded = decoded.split(leet).join(char);
		}
		return decoded;
	}

	/**
	 * Verifica se mensagem contém palavra (com word boundaries)
	 */
	private containsWord(message: string, word: string): boolean {
		// Busca exata com word boundary
		const regex = new RegExp(`\\b${this.escapeRegex(word)}\\b`, 'i');
		if (regex.test(message)) return true;

		// Busca sem espaços (palavras coladas: "vaisefu*r")
		const noSpaces = word.replace(/\s+/g, '');
		if (noSpaces !== word && message.includes(noSpaces)) return true;

		return false;
	}

	/**
	 * Escapa caracteres especiais de regex
	 */
	private escapeRegex(str: string): string {
		return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	/**
	 * Adiciona palavras ao dicionário em runtime
	 */
	addProfanityWords(words: string[], language: Language = 'pt', severity: SeverityLevel = 'medium'): void {
		for (const word of words) {
			this.profanityDictionaries[language][severity].add(word.toLowerCase());
		}
	}
}
