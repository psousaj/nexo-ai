import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import { encode } from '@toon-format/toon';
import type { AIProvider, AIResponse, Message } from './types';
import { aiProviderLogs, getRandomLogMessage } from '@/services/conversation/logMessages';

/**
 * Gemini Provider usando SDK oficial
 * Modo JSON APENAS - sem function calling
 * Alinhado com arquitetura determinística v0.3.0
 *
 * Histórico convertido para TOON para reduzir tokens de entrada
 */
export class GeminiProvider implements AIProvider {
	private readonly client: GoogleGenerativeAI;
	private readonly model: GenerativeModel;
	private readonly modelName: string = 'gemini-2.5-flash';

	constructor(apiKey: string) {
		if (!apiKey) {
			throw new Error('Gemini API key não configurada');
		}
		this.client = new GoogleGenerativeAI(apiKey);
		// SEM tools - força resposta JSON
		this.model = this.client.getGenerativeModel({
			model: this.modelName,
			generationConfig: {
				responseMimeType: 'application/json',
			},
		});
		console.log('✅ [AI] Google Gemini configurado (modo JSON)');
	}

	getName(): string {
		return 'gemini';
	}

	async callLLM(params: { message: string; history?: Message[]; systemPrompt?: string }): Promise<AIResponse> {
		const { message, history = [], systemPrompt } = params;
		const startTime = Date.now();

		try {
			// Log: requisição iniciada
			console.log(
				getRandomLogMessage(aiProviderLogs.requesting, {
					provider: 'Gemini',
				})
			);
			console.log(`🤖 [Gemini] Enviando para ${this.modelName}`);

			// Converter histórico para TOON (economiza 30-60% tokens)
			let userMessage = message;

			if (history.length > 0) {
				// Garantir que histórico começa com user (requisito do Gemini)
				const validHistory =
					history[0]?.role === 'user' ? history : [{ role: 'user' as const, content: '(conversa anterior)' }, ...history];

				const historyData = validHistory.map((msg) => ({
					role: msg.role,
					content: msg.content,
				}));

				const toonHistory = encode(historyData, { delimiter: '\t' });

				userMessage = `Histórico da conversa em formato TOON (tab-separated):

\`\`\`toon
${toonHistory}
\`\`\`

Mensagem atual: ${message}`;
			}

			// Configura o chat SEM histórico (tudo vai na mensagem)
			const chatConfig: any = {
				history: [], // Histórico vazio - tudo em TOON na mensagem
				generationConfig: {
					temperature: 0.7,
					topK: 40,
					topP: 0.95,
					maxOutputTokens: 2048,
				},
			};

			// System prompt continua como texto (não TOON)
			if (systemPrompt) {
				chatConfig.systemInstruction = {
					parts: [{ text: systemPrompt }],
				};
			}

			const chat = this.model.startChat(chatConfig);

			const result = await chat.sendMessage(userMessage);
			const response = result.response;

			// Retorna texto JSON (sem function calling)
			const text = String(response.text() || '');
			
			const duration = Date.now() - startTime;

			// Log: resposta recebida
			console.log(
				getRandomLogMessage(aiProviderLogs.success, {
					provider: 'Gemini',
					duration,
				})
			);

			if (!text) {
				console.warn('⚠️ [Gemini] Resposta vazia!');
			}

			return { message: text.trim() };
		} catch (error: any) {
			const duration = Date.now() - startTime;

			// Log: erro
			console.error(
				getRandomLogMessage(aiProviderLogs.error, {
					provider: 'Gemini',
					error: error instanceof Error ? error.message : String(error),
				})
			);
			console.error('❌ Erro ao chamar Gemini SDK:', error);
			throw error;
		}
	}
}
