import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import type { AIProvider, AIResponse, Message } from './types';

/**
 * Gemini Provider usando SDK oficial
 * Modo JSON APENAS - sem function calling
 * Alinhado com arquitetura determinística v0.3.0
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

		try {
			// Cria chat session com histórico
			const chatHistory = history.map((msg) => ({
				role: msg.role === 'user' ? 'user' : 'model',
				parts: [{ text: msg.content }],
			}));

			// Configura o chat com ou sem system instruction
			const chatConfig: any = {
				history: chatHistory,
				generationConfig: {
					temperature: 0.7,
					topK: 40,
					topP: 0.95,
					maxOutputTokens: 2048,
				},
			};

			// Só adiciona systemInstruction se fornecido (formato Content)
			if (systemPrompt) {
				chatConfig.systemInstruction = {
					role: 'system',
					parts: [{ text: systemPrompt }],
				};
			}

			const chat = this.model.startChat(chatConfig);

			const result = await chat.sendMessage(message);
			const response = result.response;

			// Retorna texto JSON (sem function calling)
			const text = response.text();
			return { message: text };
		} catch (error: any) {
			console.error('❌ Erro ao chamar Gemini SDK:', error);
			throw error;
		}
	}
}
