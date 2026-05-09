import OpenAI from 'openai';
import type { ModelTurnOutput, ModelTurnRunner } from '../kernel/model-turn-runner';
import { CredentialPool } from './credential-pool';
import { detectApiMode, getTransport } from './transports';
import type { NormalizedResponse } from './transports/types';

export class DefaultModelTurnRunner implements ModelTurnRunner {
	private credentialPool: CredentialPool;
	private messages: Array<Record<string, unknown>> = [];
	private lastReasoningContent: string | null = null;

	constructor(
		private deps: {
			credentialPool?: CredentialPool;
			defaultProvider?: string;
			defaultModel?: string;
		} = {},
	) {
		this.credentialPool = deps.credentialPool ?? CredentialPool.fromEnv();
	}

	async next(context: unknown): Promise<ModelTurnOutput> {
		const ctx = context as { systemPrompt: string; sessionKey: string; userMessage: string };
		const provider = this.deps.defaultProvider;
		const model = this.deps.defaultModel;

		const resolved = provider ? this.credentialPool.resolve(provider) : this.credentialPool.resolveAny();

		if (!resolved) {
			return {
				type: 'respond',
				text: 'Nenhum provedor de IA configurado. Configure OPENAI_API_KEY ou DEEPSEEK_API_KEY no .env',
			};
		}

		const activeProvider = resolved.provider;
		const activeModel = model ?? (activeProvider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini');

		this.padReasoningContent(activeModel, activeProvider);

		if (this.messages.length === 0 && ctx.userMessage) {
			this.messages.push({ role: 'user', content: ctx.userMessage });
		}

		const apiMode = detectApiMode(resolved.baseURL);
		const transport = getTransport(apiMode);

		try {
			const client = new OpenAI({
				apiKey: resolved.apiKey,
				baseURL: resolved.baseURL,
			});

			const kwargs = transport.buildKwargs({
				model: activeModel,
				messages: this.messages,
				systemPrompt: ctx.systemPrompt,
			});

			const rawResponse = await client.chat.completions.create(kwargs as any);
			const normalized = transport.normalizeResponse(rawResponse);

			this.lastReasoningContent = (normalized.providerData?.reasoning_content as string) ?? null;

			const assistantMsg: Record<string, unknown> = {
				role: 'assistant',
				content: normalized.content ?? '',
			};
			if (normalized.toolCalls) {
				assistantMsg.tool_calls = normalized.toolCalls.map((tc) => ({
					id: tc.id,
					type: 'function',
					function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
				}));
			}
			if (this.lastReasoningContent) {
				assistantMsg.reasoning_content = this.lastReasoningContent;
			} else if (normalized.toolCalls && this.isDeepSeek(activeModel, activeProvider)) {
				assistantMsg.reasoning_content = ' ';
				this.lastReasoningContent = ' ';
			}
			this.messages.push(assistantMsg);

			return this.toModelTurnOutput(normalized);
		} catch (error: any) {
			if (error?.status === 429 || error?.status === 402) {
				this.credentialPool.markExhausted(activeProvider, resolved.apiKey);
				return { type: 'respond', text: 'O serviço de IA está sobrecarregado. Tente novamente em alguns instantes.' };
			}
			return { type: 'respond', text: 'Desculpe, não consegui processar sua mensagem agora.' };
		}
	}

	async addToolResult(toolName: string, result: unknown): Promise<void> {
		this.messages.push({
			role: 'tool',
			content: JSON.stringify(result),
			tool_call_id: toolName,
		});
	}

	private toModelTurnOutput(normalized: NormalizedResponse): ModelTurnOutput {
		if (normalized.toolCalls && normalized.toolCalls.length > 0) {
			const tc = normalized.toolCalls[0];
			return { type: 'tool', toolName: tc.name, input: tc.arguments };
		}
		return { type: 'respond', text: normalized.content ?? 'Entendi.' };
	}

	private padReasoningContent(model: string, provider: string): void {
		if (!this.isDeepSeek(model, provider)) return;
		if (this.messages.length === 0) return;
		const last = this.messages[this.messages.length - 1];
		if (last?.role !== 'assistant') return;
		if (!last.tool_calls) return;

		const rc = last.reasoning_content;
		if (rc !== undefined && rc !== null) return;

		last.reasoning_content = ' ';
	}

	private isDeepSeek(model: string, provider: string): boolean {
		return provider === 'deepseek' || model.toLowerCase().includes('deepseek');
	}
}
