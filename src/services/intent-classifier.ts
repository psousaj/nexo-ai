import OpenAI from 'openai';
import { env } from '@/config/env';
import { INTENT_CLASSIFIER_PROMPT } from '@/config/prompts';
import { loggers } from '@/utils/logger';

/**
 * Classificador de intenções usando Cloudflare Workers AI
 *
 * Usa modelo @cf/meta/llama-4-scout-17b-16e-instruct via SDK OpenAI
 * - Input: mensagem simples do usuário
 * - Output: JSON estruturado
 * - Fallback: regex determinístico se API falhar
 */

export type UserIntent =
	| 'save_content' // Usuário quer guardar algo
	| 'search_content' // Usuário quer buscar/listar
	| 'delete_content' // Usuário quer deletar
	| 'update_content' // Usuário quer atualizar
	| 'get_info' // Usuário quer detalhes sobre algo
	| 'confirm' // Usuário confirma (sim, ok, 1, etc)
	| 'deny' // Usuário nega (não, cancela, etc)
	| 'casual_chat' // Conversa casual/saudação
	| 'unknown'; // Não identificado

export type ActionVerb =
	| 'save'
	| 'save_previous'
	| 'search'
	| 'list_all'
	| 'delete_all'
	| 'delete_item'
	| 'delete_selected'
	| 'update_item'
	| 'update_settings' // Atualizar configurações do usuário (nome do assistente, etc)
	| 'get_details'
	| 'get_assistant_name' // Usuário pergunta "qual é seu nome?"
	| 'confirm'
	| 'deny'
	| 'greet'
	| 'thank'
	| 'unknown';

export interface IntentResult {
	intent: UserIntent;
	action: ActionVerb; // Verbo de ação determinístico
	confidence: number; // 0-1
	entities?: {
		query?: string;
		selection?: number;
		url?: string;
		refersToPrevious?: boolean;
		target?: 'all' | 'item' | 'selection'; // Alvo da ação
		settingType?: 'assistant_name' | 'preferences'; // Tipo de configuração
		newValue?: string; // Novo valor para a configuração
	};
}

/**
 * Classificador de intenções usando LLM
 */
export class IntentClassifier {
	private client?: OpenAI;
	// DeepSeek R1 retorna <think> tags, use Llama para JSON puro
	private model = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

	constructor() {
		if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN) {
			loggers.ai.warn('⚠️ Cloudflare não configurado para Intent Classifier, usando fallback regex');
		} else {
			this.client = new OpenAI({
				apiKey: env.CLOUDFLARE_API_TOKEN,
				baseURL: `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/v1`,
			});
			loggers.ai.info('✅ Cloudflare Workers AI configurado');
		}
	}

	/**
	 * Detecta intenção da mensagem do usuário
	 */
	async classify(message: string): Promise<IntentResult> {
		// Valida que message é uma string válida
		if (!message || typeof message !== 'string') {
			loggers.ai.warn('⚠️ Mensagem inválida para classificação, usando fallback');
			return this.classifyWithRegex(message || '');
		}

		// Fallback regex se Cloudflare não configurado
		if (!this.client) {
			return this.classifyWithRegex(message);
		}

		try {
			loggers.ai.info({ messageSnippet: message.substring(0, 50) }, '🎯 Classificando intenção');

			const response = await this.client.chat.completions.create({
				model: this.model,
				messages: [
					{
						role: 'system',
						content: INTENT_CLASSIFIER_PROMPT,
					},
					{
						role: 'user',
						content: message,
					},
				],
				temperature: 0.1, // Muito baixo para consistência
				max_tokens: 200, // Reduzido, JSON é pequeno
			});

			const content = response.choices[0]?.message?.content;
			if (!content) {
				loggers.ai.warn('⚠️ Resposta do Intent Classifier vazia, usando fallback');
				loggers.ai.debug({ response }, 'Response completo do Cloudflare AI');
				return this.classifyWithRegex(message);
			}

			loggers.ai.debug({ content }, '📥 Resposta bruta do Intent Classifier');

			let result: IntentResult;

			// Cloudflare Workers AI pode retornar content como objeto OU string
			if (typeof content === 'object') {
				// Já é um objeto JSON parseado
				loggers.ai.info('✅ Content já é objeto, usando direto');
				result = content as IntentResult;
			} else if (typeof content === 'string') {
				// É string, precisa parsear
				loggers.ai.info('🔄 Content é string, fazendo parse...');

				// Limpar tags <think>, <answer>, etc (modelos de reasoning)
				let jsonContent = content
					.replace(/<think>[\s\S]*?<\/think>/gi, '') // Remove blocos <think>...</think>
					.replace(/<answer>/gi, '') // Remove tag <answer>
					.replace(/<\/answer>/gi, '') // Remove tag </answer>
					.trim();

				// Se não começa com {, tentar encontrar JSON no texto
				if (!jsonContent.startsWith('{')) {
					loggers.ai.info('⚠️ Resposta não começa com {, tentando extrair JSON...');
					const jsonMatch = jsonContent.match(/\{[\s\S]*\}/);
					if (jsonMatch) {
						jsonContent = jsonMatch[0];
						loggers.ai.info('✅ JSON extraído com sucesso');
					} else {
						loggers.ai.warn({ content }, '❌ Resposta não contém JSON válido');
						return this.classifyWithRegex(message);
					}
				}

				loggers.ai.debug({ jsonContent }, '🧹 JSON limpo para parse');
				result = JSON.parse(jsonContent);
			} else {
				loggers.ai.warn({ contentType: typeof content }, '⚠️ Tipo de content inesperado');
				return this.classifyWithRegex(message);
			}

			loggers.ai.info({ result }, '✅ Resultado da classificação de intenção');

			return result;
		} catch (error) {
			loggers.ai.error({ err: error }, '❌ Erro ao classificar intenção');
			return this.classifyWithRegex(message);
		}
	}

	/**
	 * Fallback com regex (mantém lógica antiga)
	 */
	private classifyWithRegex(message: string): IntentResult {
		// Garante que message é string válida
		const safeMessage = typeof message === 'string' ? message : '';
		loggers.ai.info({ messageSnippet: safeMessage.substring(0, 50) }, '🎯 Usando fallback regex para classificação');
		const lowerMsg = safeMessage.toLowerCase().trim();

		// 1. CONFIRMAÇÃO/NEGAÇÃO (mais específico primeiro)
		if (this.isConfirmation(lowerMsg)) {
			const result = {
				intent: 'confirm' as const,
				action: 'confirm' as const,
				confidence: 0.95,
				entities: {
					selection: this.extractSelection(message),
				},
			};
			loggers.ai.info({ intent: result.intent, action: result.action, confidence: result.confidence }, '🎯 Intenção detectada (regex)');
			return result;
		}

		if (this.isDenial(lowerMsg)) {
			loggers.ai.info({ intent: 'deny', action: 'deny', confidence: 0.95 }, '🎯 Intenção detectada (regex)');
			return {
				intent: 'deny',
				action: 'deny',
				confidence: 0.95,
			};
		}

		// 2. DELETAR (CRÍTICO: detectar antes de search)
		const deleteResult = this.isDeleteRequest(lowerMsg);
		if (deleteResult) {
			loggers.ai.info(
				{ intent: deleteResult.intent, action: deleteResult.action, confidence: deleteResult.confidence },
				'🎯 Intenção detectada (regex)'
			);
			return deleteResult;
		}

		// 3. BUSCA/LISTAGEM
		if (this.isSearch(lowerMsg)) {
			const query = this.extractSearchQuery(message);
			const action = query ? 'search' : 'list_all';
			const result = {
				intent: 'search_content' as const,
				action: action as ActionVerb,
				confidence: 0.9,
				entities: { query },
			};
			loggers.ai.info({ intent: result.intent, action: result.action, confidence: result.confidence }, '🎯 Intenção detectada (regex)');
			return result;
		}

		// 4. PERGUNTAR NOME DO ASSISTENTE (antes de info request genérico)
		if (this.isAskingAssistantName(lowerMsg)) {
			loggers.ai.info({ intent: 'get_info', action: 'get_assistant_name', confidence: 0.95 }, '🎯 Intenção detectada (regex)');
			return {
				intent: 'get_info',
				action: 'get_assistant_name',
				confidence: 0.95,
			};
		}

		// 5. SOLICITAR INFORMAÇÕES
		if (this.isInfoRequest(lowerMsg)) {
			loggers.ai.info({ intent: 'get_info', action: 'get_details', confidence: 0.85 }, '🎯 Intenção detectada (regex)');
			return {
				intent: 'get_info',
				action: 'get_details',
				confidence: 0.85,
				entities: {
					query: this.extractInfoQuery(message),
				},
			};
		}

		// 5. SALVAR CONTEÚDO (URLs, títulos, etc)
		if (this.isSaveRequest(lowerMsg, message)) {
			// Verifica se é referência ao anterior ("salva ai", "guarda isso")
			const saveReferencePatterns = [
				/salva (isso|ai|aí|esse)/i,
				/guarda (isso|ai|aí|esse)/i,
				/anota (isso|ai|aí|esse)/i,
				/(pode )?salvar (por favor|pra mim|pfv)?$/i,
				/(pode )?guardar (por favor|pra mim|pfv)?$/i,
			];

			const refersToPrevious = saveReferencePatterns.some((pattern) => pattern.test(lowerMsg));
			const action = refersToPrevious ? 'save_previous' : 'save';

			const result = {
				intent: 'save_content' as const,
				action: action as ActionVerb,
				confidence: 0.9,
				entities: {
					query: refersToPrevious ? undefined : message.trim(),
					url: this.extractURL(message),
					refersToPrevious,
				},
			};
			loggers.ai.info({ intent: result.intent, action: result.action, confidence: result.confidence }, '🎯 Intenção detectada (regex)');
			return result;
		}

		// 6. CONVERSA CASUAL
		if (this.isCasualChat(lowerMsg)) {
			const action = this.getCasualAction(lowerMsg);
			loggers.ai.info({ intent: 'casual_chat', action, confidence: 0.8 }, '🎯 Intenção detectada (regex)');
			return {
				intent: 'casual_chat',
				action,
				confidence: 0.8,
			};
		}

		// 7. ATUALIZAR CONFIGURAÇÕES (nome do assistente, etc)
		const updateResult = this.isUpdateSettings(lowerMsg, message);
		if (updateResult) {
			loggers.ai.info(
				{ intent: updateResult.intent, action: updateResult.action, confidence: updateResult.confidence },
				'🎯 Intenção detectada (regex)'
			);
			return updateResult;
		}

		// 8. DESCONHECIDO (deixa para LLM decidir)
		loggers.ai.info({ intent: 'unknown', confidence: 0.5 }, '🎯 Intenção não identificada (regex)');
		return {
			intent: 'unknown',
			action: 'unknown',
			confidence: 0.5,
			entities: {
				query: message.trim(),
			},
		};
	}

	/**
	 * Verifica se é confirmação
	 */
	private isConfirmation(msg: string): boolean {
		// Remove pontuação para normalizar
		const normalized = msg.replace(/[!.?]/g, '').trim();

		const confirmPatterns = [
			/^(sim|yes|s|y)$/i,
			/^(ok|okay)$/i,
			/^(confirmo|confirma|confirmar)$/i,
			/^(aceito|aceita|aceitar)$/i,
			/^(isso|esse|essa)$/i,
			/^(\d+)$/, // números (seleção)
			/^(o primeiro|a primeira|primeiro|primeira)$/i,
			/^(o segundo|a segunda|segundo|segunda)$/i,
			/^(o terceiro|a terceira|terceiro|terceira)$/i,
			/^(1|2|3|4|5|6|7|8|9)$/,
		];

		return confirmPatterns.some((pattern) => pattern.test(normalized));
	}

	/**
	 * Verifica se é negação
	 */
	private isDenial(msg: string): boolean {
		const denyPatterns = [/^(não|nao|no|n)$/i, /^(cancela|cancelar)$/i, /^(deixa pra lá|deixa|esquece)$/i, /^(outro|outra)$/i];

		return denyPatterns.some((pattern) => pattern.test(msg));
	}

	/**
	 * Verifica se é busca/listagem
	 */
	private isSearch(msg: string): boolean {
		// Mensagens muito longas (>100 chars) provavelmente não são busca
		if (msg.length > 100) {
			return false;
		}

		const searchKeywords = [
			'o que eu salvei',
			'o que tenho',
			'mostra',
			'lista',
			'busca',
			'procura',
			'encontra',
			'filmes salvos',
			'séries salvas',
			'meus filmes',
			'minhas séries',
			'ver lista',
			'minha lista',
			'que eu guardei',
		];

		return searchKeywords.some((kw) => msg.includes(kw));
	}

	/**
	 * Verifica se usuário está perguntando o nome do assistente
	 */
	private isAskingAssistantName(msg: string): boolean {
		const namePatterns = [
			/qual (é |e )?(o )?seu nome/i,
			/como (você|vc|tu) se chama/i,
			/você tem nome/i,
			/tem nome/i,
			/seu nome é/i,
			/^qual seu nome/i,
			/^como te chamo/i,
			/posso saber seu nome/i,
		];

		return namePatterns.some((pattern) => pattern.test(msg));
	}

	/**
	 * Verifica se é pedido de informação
	 */
	private isInfoRequest(msg: string): boolean {
		const infoKeywords = [
			'o que é',
			'quem é',
			'quando',
			'onde',
			'como',
			'por que',
			'qual',
			'me fala sobre',
			'conte sobre',
			'explica',
			'detalhes',
			'informações',
		];

		return infoKeywords.some((kw) => msg.includes(kw));
	}

	/**
	 * Verifica se é pedido para salvar
	 */
	private isSaveRequest(msg: string, originalMsg: string): boolean {
		// Detecta "salva ai", "guarda isso", etc (referência ao conteúdo anterior)
		const saveReferencePatterns = [
			/salva (isso|ai|aí|esse)/i,
			/guarda (isso|ai|aí|esse)/i,
			/anota (isso|ai|aí|esse)/i,
			/(pode )?salvar (por favor|pra mim|pfv)?$/i,
			/(pode )?guardar (por favor|pra mim|pfv)?$/i,
		];

		const isSaveReference = saveReferencePatterns.some((pattern) => pattern.test(msg));
		if (isSaveReference) {
			// Marca como save_content mas indica que é referência ao anterior
			return true;
		}

		// URLs são sempre save
		if (this.extractURL(originalMsg)) {
			return true;
		}

		// Palavras-chave explícitas
		const saveKeywords = [
			'salva',
			'salvar',
			'guarda',
			'guardar',
			'adiciona',
			'adicionar',
			'quero ver',
			'quero assistir',
			'anota',
			'anotar',
		];

		if (saveKeywords.some((kw) => msg.includes(kw))) {
			return true;
		}

		// Se tem nome de streaming COM menção de conteúdo, provavelmente quer salvar
		const streamingServices = ['netflix', 'prime', 'disney', 'hbo', 'max', 'spotify'];
		const hasStreaming = streamingServices.some((s) => msg.includes(s));

		// Mensagens muito longas (>80 chars) descritivas SEM palavras de pergunta/dúvida
		// provavelmente são descrições/ideias para salvar
		const isLongDescription = originalMsg.length > 80 && !msg.includes('?') && !this.hasQuestionWords(msg);

		// Se mensagem não é pergunta e menciona conteúdo explicitamente
		const isNotQuestion = !msg.startsWith('o que') && !msg.startsWith('qual') && !msg.includes('?');
		const mentionsContent =
			msg.includes('filme') || msg.includes('série') || msg.includes('video') || msg.includes('aplicativo') || msg.includes('ideia');

		// Se é mensagem longa descritiva OU tem streaming + conteúdo
		return isLongDescription || (isNotQuestion && hasStreaming && mentionsContent);
	}

	/**
	 * Verifica se tem palavras que indicam pergunta/dúvida
	 */
	private hasQuestionWords(msg: string): boolean {
		const questionWords = [
			'estava pensando',
			'poderia',
			'será',
			'talvez',
			'não sei',
			'ajuda',
			'ajudar',
			'como',
			'quando',
			'onde',
			'por que',
			'pra que',
		];
		return questionWords.some((w) => msg.includes(w));
	}

	/**
	 * Verifica se é pedido para atualizar configurações (nome do assistente, etc)
	 */
	private isUpdateSettings(msg: string, originalMsg: string): IntentResult | null {
		// Detectar pedido para mudar nome do assistente
		const nameChangePatterns = [
			/posso te (chamar|dar) (de|um|outro)? ?(nome|apelido)?/i,
			/quero te chamar de (.+)/i,
			/(muda|altera|troca) (seu|teu) nome (para|pra) (.+)/i,
			/te chamo de (.+)/i,
			/vou te chamar de (.+)/i,
		];

		for (const pattern of nameChangePatterns) {
			const match = originalMsg.match(pattern);
			if (match) {
				// Se é pergunta (posso...), não extrai o nome ainda
				const isQuestion = msg.startsWith('posso') || msg.includes('posso');

				// Tenta extrair o novo nome (último grupo de captura)
				const newName = match[match.length - 1]?.trim();

				return {
					intent: 'update_content',
					action: 'update_settings',
					confidence: 0.9,
					entities: {
						settingType: 'assistant_name',
						newValue: isQuestion ? undefined : newName,
						query: isQuestion ? 'assistant_name' : undefined,
					},
				};
			}
		}

		return null;
	}

	/**
	 * Detecta pedido de deletar
	 */
	private isDeleteRequest(msg: string): IntentResult | null {
		const deleteKeywords = ['deleta', 'deletar', 'apaga', 'apagar', 'remove', 'remover', 'limpa', 'limpar', 'exclui', 'excluir'];

		const hasDeleteKeyword = deleteKeywords.some((kw) => msg.includes(kw));
		if (!hasDeleteKeyword) return null;

		// Detectar alvo: tudo, item específico, ou seleção
		if (msg.includes('tudo') || msg.includes('tudo mesmo') || msg.includes('todos')) {
			return {
				intent: 'delete_content',
				action: 'delete_all',
				confidence: 0.95,
				entities: {
					target: 'all',
				},
			};
		}

		// Número específico (ex: "deleta 1", "apaga o primeiro")
		const selection = this.extractSelection(msg);
		if (selection) {
			return {
				intent: 'delete_content',
				action: 'delete_selected',
				confidence: 0.9,
				entities: {
					selection,
					target: 'selection',
				},
			};
		}

		// Item específico (query)
		const cleaned = msg.replace(/deleta|deletar|apaga|apagar|remove|remover/gi, '').trim();

		if (cleaned) {
			return {
				intent: 'delete_content',
				action: 'delete_item',
				confidence: 0.85,
				entities: {
					query: cleaned,
					target: 'item',
				},
			};
		}

		// Genérico: "deleta" (sem especificar o que) -> pedir confirmação
		return {
			intent: 'delete_content',
			action: 'delete_item',
			confidence: 0.7,
			entities: {
				target: 'item',
			},
		};
	}

	/**
	 * Detecta ação de conversa casual
	 */
	private getCasualAction(msg: string): ActionVerb {
		const greetings = ['oi', 'olá', 'ola', 'hey', 'hi', 'hello', 'bom dia', 'boa tarde', 'boa noite'];
		const thanks = ['obrigado', 'obrigada', 'valeu', 'thanks'];

		if (greetings.some((g) => msg.includes(g))) return 'greet';
		if (thanks.some((t) => msg.includes(t))) return 'thank';

		return 'greet'; // default
	}

	/**
	 * Verifica se é conversa casual
	 */
	private isCasualChat(msg: string): boolean {
		const casualPatterns = [
			/^(oi|olá|ola|hey|hi|hello)$/i,
			/^(tudo bem|como vai|como está)$/i,
			/^(bom dia|boa tarde|boa noite)$/i,
			/^(obrigado|obrigada|valeu|thanks)$/i,
			/^(tchau|até logo|bye)$/i,
		];

		return casualPatterns.some((pattern) => pattern.test(msg));
	}

	/**
	 * Extrai número de seleção (1, 2, 3...)
	 */
	private extractSelection(msg: string): number | undefined {
		// "o primeiro", "a segunda", etc (priorizar ordinais)
		const ordinalMap: Record<string, number> = {
			primeiro: 1,
			primeira: 1,
			segundo: 2,
			segunda: 2,
			terceiro: 3,
			terceira: 3,
		};

		for (const [word, num] of Object.entries(ordinalMap)) {
			if (msg.includes(word)) {
				return num;
			}
		}

		// Número direto (em qualquer posição, mas isolado)
		const numberMatch = msg.match(/\b(\d+)\b/);
		if (numberMatch) {
			return parseInt(numberMatch[1]);
		}

		return undefined;
	}

	/**
	 * Extrai URL da mensagem
	 */
	private extractURL(msg: string): string | undefined {
		const urlMatch = msg.match(/https?:\/\/[^\s]+/);
		return urlMatch?.[0];
	}

	/**
	 * Extrai query de busca
	 */
	private extractSearchQuery(msg: string): string | undefined {
		// Comandos genéricos que significam "listar tudo" (sem filtro)
		const listAllPatterns = [
			/^(o que (eu )?salvei|o que (eu )?tenho)$/i,
			/^(mostra|lista)$/i,
			/^(minha|minhas) (lista|coisas)$/i,
			/^(ver lista|ver tudo)$/i,
		];

		// Se é comando genérico, retorna undefined (sem query = listar tudo)
		if (listAllPatterns.some((pattern) => pattern.test(msg))) {
			return undefined;
		}

		// Remove palavras-chave de busca para extrair o filtro
		const cleaned = msg
			.replace(/o que (eu )?salvei/gi, '')
			.replace(/o que (eu )?tenho/gi, '')
			.replace(/mostra/gi, '')
			.replace(/lista/gi, '')
			.replace(/busca/gi, '')
			.replace(/procura/gi, '')
			.replace(/minha|minhas|meus|meu/gi, '')
			.trim();

		// Se sobrou algo específico, é a query
		// Se sobrou só palavras genéricas (de/a/o), retorna undefined (listar tudo)
		const genericWords = ['de', 'a', 'o', 'os', 'as'];
		if (!cleaned || genericWords.includes(cleaned.toLowerCase())) {
			return undefined;
		}

		return cleaned;
	}

	/**
	 * Extrai query de informação
	 */
	private extractInfoQuery(msg: string): string | undefined {
		const cleaned = msg
			.replace(/o que é/gi, '')
			.replace(/quem é/gi, '')
			.replace(/me fala sobre/gi, '')
			.replace(/conte sobre/gi, '')
			.replace(/explica/gi, '')
			.trim();

		return cleaned || undefined;
	}
}

// Singleton
export const intentClassifier = new IntentClassifier();
