import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import type { AIProvider, AIResponse, Message } from './types';
import { availableTools } from './tools';

/**
 * Gemini Provider usando SDK oficial
 * Suporta function calling e conversação com histórico
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
		this.model = this.client.getGenerativeModel({
			model: this.modelName,
			tools: [
				{
					functionDeclarations: availableTools.map((tool) => ({
						name: tool.name,
						description: tool.description,
						parameters: {
							type: 'OBJECT' as any,
							properties: tool.parameters.properties,
							required: tool.parameters.required,
						},
					})),
				},
			],
		});
		console.log('✅ [AI] Google Gemini SDK configurado');
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

			const chat = this.model.startChat({
				history: chatHistory as any,
				generationConfig: {
					temperature: 0.7,
					topK: 40,
					topP: 0.95,
					maxOutputTokens: 2048,
				},
				systemInstruction: systemPrompt,
			});

			const result = await chat.sendMessage(message);
			const response = result.response;

			// Verifica function calls
			const functionCalls = response.functionCalls();
			if (functionCalls && functionCalls.length > 0) {
				return {
					message: '',
					tool_calls: functionCalls.map((fc) => ({
						id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
						type: 'function',
						function: {
							name: fc.name,
							arguments: JSON.stringify(fc.args),
						},
					})),
				};
			}

			// Texto normal
			const text = response.text();
			return { message: text };
		} catch (error: any) {
			console.error('❌ Erro ao chamar Gemini SDK:', error);
			throw error;
		}
	}
}
