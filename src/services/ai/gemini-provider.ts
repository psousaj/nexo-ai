import type { AIProvider, AIResponse, Message } from './types';
import { availableTools } from './tools';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Interfaces para tipagem da API REST do Gemini
 */
interface GeminiPart {
	text?: string;
	functionCall?: {
		name: string;
		args: Record<string, any>;
	};
	functionResponse?: {
		name: string;
		response: Record<string, any>;
	};
}

interface GeminiContent {
	role: 'user' | 'model';
	parts: GeminiPart[];
}

interface GeminiFunctionDeclaration {
	name: string;
	description: string;
	parameters: {
		type: string;
		properties: Record<string, any>;
		required: string[];
	};
}

interface GeminiRequest {
	contents: GeminiContent[];
	systemInstruction?: {
		parts: { text: string }[];
	};
	tools?: {
		functionDeclarations: GeminiFunctionDeclaration[];
	}[];
	generationConfig?: {
		temperature?: number;
		topK?: number;
		topP?: number;
		maxOutputTokens?: number;
	};
}

interface GeminiCandidate {
	content: {
		parts: GeminiPart[];
		role: string;
	};
	finishReason: string;
}

interface GeminiResponse {
	candidates: GeminiCandidate[];
	usageMetadata?: {
		promptTokenCount: number;
		candidatesTokenCount: number;
		totalTokenCount: number;
	};
	error?: {
		code: number;
		message: string;
		status: string;
	};
}

/**
 * Erro customizado com status HTTP
 */
class GeminiAPIError extends Error {
	status: number;

	constructor(message: string, status: number) {
		super(message);
		this.name = 'GeminiAPIError';
		this.status = status;
	}
}

/**
 * Provider para Google Gemini API (REST)
 * Usando a API REST diretamente sem SDK
 */
export class GeminiProvider implements AIProvider {
	private apiKey: string;
	private model: string;

	constructor(apiKey: string, model: string = 'gemini-2.0-flash') {
		this.apiKey = apiKey;
		this.model = model;
	}

	async callLLM(params: { message: string; history?: Message[]; systemPrompt?: string }): Promise<AIResponse> {
		const { message, history = [], systemPrompt } = params;

		try {
			// Converter tools para formato Gemini
			const functionDeclarations: GeminiFunctionDeclaration[] = availableTools.map((tool) => ({
				name: tool.name,
				description: tool.description,
				parameters: {
					type: 'object',
					properties: tool.parameters.properties,
					required: tool.parameters.required,
				},
			}));

			// Converter histórico para formato Gemini
			let geminiHistory: GeminiContent[] = history.map((msg) => ({
				role: msg.role === 'assistant' ? 'model' : 'user',
				parts: [{ text: msg.content }],
			}));

			// Gemini exige que histórico sempre comece com 'user'
			while (geminiHistory.length > 0 && geminiHistory[0].role !== 'user') {
				geminiHistory = geminiHistory.slice(1);
			}

			// Adicionar mensagem atual
			const contents: GeminiContent[] = [
				...geminiHistory,
				{
					role: 'user',
					parts: [{ text: message }],
				},
			];

			// Montar request body
			const requestBody: GeminiRequest = {
				contents,
				generationConfig: {
					temperature: 1.0, // Recomendado para Gemini 2.x/3.x
					maxOutputTokens: 2048,
				},
			};

			// Adicionar system instruction se fornecido
			if (systemPrompt) {
				requestBody.systemInstruction = {
					parts: [{ text: systemPrompt }],
				};
			}

			// Adicionar tools se disponíveis
			if (functionDeclarations.length > 0) {
				requestBody.tools = [{ functionDeclarations }];
			}

			// Fazer request para API REST
			const url = `${GEMINI_BASE_URL}/models/${this.model}:generateContent`;

			console.log(`🔗 [Gemini REST] Chamando ${this.model}`);

			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-goog-api-key': this.apiKey,
				},
				body: JSON.stringify(requestBody),
			});

			// Tratar erros HTTP
			if (!response.ok) {
				const errorData = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
				const errorMessage = errorData?.error?.message || `HTTP ${response.status}`;
				console.error(`❌ [Gemini REST] Erro HTTP ${response.status}:`, errorMessage);
				throw new GeminiAPIError(errorMessage, response.status);
			}

			const data = (await response.json()) as GeminiResponse;

			// Verificar se há erro na resposta
			if (data.error) {
				console.error(`❌ [Gemini REST] Erro na resposta:`, data.error);
				throw new GeminiAPIError(data.error.message, data.error.code);
			}

			// Verificar se há candidatos
			if (!data.candidates || data.candidates.length === 0) {
				console.warn(`⚠️ [Gemini REST] Nenhum candidato retornado`);
				return {
					message: '😅 Hmm... não consegui processar isso. Pode reformular?',
				};
			}

			const candidate = data.candidates[0];
			const parts = candidate.content?.parts || [];

			// Log de uso de tokens
			if (data.usageMetadata) {
				console.log(
					`📊 [Gemini REST] Tokens: ${data.usageMetadata.promptTokenCount} prompt + ${data.usageMetadata.candidatesTokenCount} resposta = ${data.usageMetadata.totalTokenCount} total`
				);
			}

			// Verificar se há function calls
			const functionCallParts = parts.filter((p) => p.functionCall);
			if (functionCallParts.length > 0) {
				console.log(`🔧 [Gemini REST] ${functionCallParts.length} function call(s) detectado(s)`);
				return {
					message: '', // Vazio quando tem tool calls
					tool_calls: functionCallParts.map((p, index) => ({
						id: `call_${index}_${Date.now()}`,
						type: 'function' as const,
						function: {
							name: p.functionCall!.name,
							arguments: JSON.stringify(p.functionCall!.args),
						},
					})),
				};
			}

			// Resposta de texto normal
			const textParts = parts.filter((p) => p.text);
			const text = textParts.map((p) => p.text).join('');

			if (!text) {
				console.warn(`⚠️ [Gemini REST] Resposta vazia`);
				return {
					message: '😅 Hmm... algo deu errado. Pode tentar de novo?',
				};
			}

			return {
				message: text,
			};
		} catch (error: any) {
			console.error('❌ [Gemini REST] Erro:', error);

			// Propagar erros de API com status
			if (error instanceof GeminiAPIError) {
				throw error;
			}

			// Erro de rede ou outro
			if (error?.message?.includes('fetch')) {
				throw new GeminiAPIError('Erro de conexão com a API do Gemini', 503);
			}

			// Erro genérico
			return {
				message: '😅 Hmm... estou com problemas pra te responder no momento. Pode tentar novamente mais tarde?',
			};
		}
	}

	getName(): string {
		return 'gemini';
	}
}
