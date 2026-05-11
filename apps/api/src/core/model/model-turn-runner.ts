import OpenAI from 'openai';
import type { ModelTurnOutput, ModelTurnRunner } from '../kernel/model-turn-runner';
import type { PostgresTranscriptStore, TranscriptEntry } from '../session/transcript-store';
import { CredentialPool } from './credential-pool';
import { detectApiMode, getTransport } from './transports';
import type { NormalizedResponse } from './transports/types';

export class DefaultModelTurnRunner implements ModelTurnRunner {
	private credentialPool: CredentialPool;
	private messages: Array<Record<string, unknown>> = [];
	private lastReasoningContent: string | null = null;
	private lastUserMessage: string | null = null;
	private pendingToolCalls: Array<{ name: string; id: string; arguments: Record<string, unknown> }> | null = null;
	private sequenceCounter = 0;
	private historyLoaded?: Promise<void>;

	constructor(
		private deps: {
			credentialPool?: CredentialPool;
			defaultProvider?: string;
			defaultModel?: string;
			transcriptStore?: PostgresTranscriptStore;
			sessionId?: string;
		} = {},
	) {
		this.credentialPool = deps.credentialPool ?? CredentialPool.fromEnv();

		// Load existing history
		if (deps.transcriptStore && deps.sessionId) {
			this.historyLoaded = this.loadHistory(deps.transcriptStore, deps.sessionId);
		}
	}

	async next(context: unknown): Promise<ModelTurnOutput> {
		// Wait for history to load before proceeding
		if (this.historyLoaded) {
			await this.historyLoaded;
		}

		// Drain pending tool calls from previous assistant message
		if (this.pendingToolCalls && this.pendingToolCalls.length > 0) {
			const tc = this.pendingToolCalls.shift()!;
			return { type: 'tool', toolName: tc.name, toolCallId: tc.id, input: tc.arguments };
		}

		const ctx = context as {
			systemPrompt: string;
			sessionKey: string;
			userMessage: string;
			tools?: Array<{ name: string; description: string; parameters: Record<string, unknown> }>;
		};
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

		if (ctx.userMessage && ctx.userMessage !== this.lastUserMessage) {
			this.messages.push({ role: 'user', content: ctx.userMessage });
			this.lastUserMessage = ctx.userMessage;
			await this.persistMessage({ role: 'user', content: ctx.userMessage, timestamp: new Date() });
		}

		const apiMode = detectApiMode(resolved.baseURL);
		const transport = getTransport(apiMode);

		try {
			const client = new OpenAI({
				apiKey: resolved.apiKey,
				baseURL: resolved.baseURL,
			});

			const openaiTools = ctx.tools?.map((t) => ({
				type: 'function' as const,
				function: {
					name: t.name,
					description: t.description,
					parameters: t.parameters,
				},
			}));

			if (!ctx.tools || ctx.tools.length === 0) {
				console.warn('[LLM] No tools in context! Catalog may be empty.');
			} else {
				console.log(`[LLM] Tools available: ${ctx.tools.map((t) => t.name).join(', ')}`);
			}

			const kwargs = transport.buildKwargs({
				model: activeModel,
				messages: this.messages,
				systemPrompt: ctx.systemPrompt,
				tools: openaiTools as Array<Record<string, unknown>>,
			});

			const rawResponse = await client.chat.completions.create(kwargs as any);
			const normalized = transport.normalizeResponse(rawResponse);

			if (!normalized.toolCalls && normalized.content) {
				console.log(`[LLM] No tool calls. Response: "${normalized.content.slice(0, 100)}..."`);
			} else if (normalized.toolCalls) {
				console.log(`[LLM] Tool calls: ${normalized.toolCalls.map((t) => t.name).join(', ')}`);
			}

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
			await this.persistMessage({
				role: 'assistant',
				content: (assistantMsg.content as string) ?? '',
				tool_calls: (assistantMsg.tool_calls as any),
				timestamp: new Date(),
			});

			return this.toModelTurnOutput(normalized);
		} catch (error: any) {
			console.error(
				'[ModelTurnRunner] LLM API error:',
				error?.status,
				error?.message,
				JSON.stringify(error?.stack ?? '').slice(0, 300),
			);
			if (error?.status === 429 || error?.status === 402) {
				this.credentialPool.markExhausted(activeProvider, resolved.apiKey);
				return { type: 'respond', text: 'O serviço de IA está sobrecarregado. Tente novamente em alguns instantes.' };
			}
			return { type: 'respond', text: 'Desculpe, não consegui processar sua mensagem agora.' };
		}
	}

	async addToolResult(toolName: string, toolCallId: string, result: unknown): Promise<void> {
		// Wait for history to load before mutating messages
		if (this.historyLoaded) {
			await this.historyLoaded;
		}

		this.messages.push({
			role: 'tool',
			content: JSON.stringify(result),
			tool_call_id: toolCallId,
		});
		await this.persistMessage({
			role: 'tool',
			content: JSON.stringify(result),
			timestamp: new Date(),
		});
	}

	needsAutoContinue(): boolean {
		if (this.messages.length === 0) return false;
		const last = this.messages[this.messages.length - 1];
		return last?.role === 'tool';
	}

	private async loadHistory(store: PostgresTranscriptStore, sessionId: string): Promise<void> {
		const transcripts = await store.load(sessionId);
		this.messages = transcripts.map((t) => ({
			role: t.role,
			content: t.content,
			...(t.tool_calls ? { tool_calls: t.tool_calls } : {}),
		}));
		this.sequenceCounter = transcripts.length > 0 ? Math.max(...transcripts.map((t) => t.sequence)) + 1 : 0;
	}

	private async persistMessage(entry: Omit<TranscriptEntry, 'sequence'>): Promise<void> {
		if (this.deps.transcriptStore && this.deps.sessionId) {
			await this.deps.transcriptStore.append(this.deps.sessionId, {
				...entry,
				sequence: this.sequenceCounter++,
			});
		}
	}

	private toModelTurnOutput(normalized: NormalizedResponse): ModelTurnOutput {
		if (normalized.toolCalls && normalized.toolCalls.length > 0) {
			// Store extra tool calls for subsequent next() calls
			if (normalized.toolCalls.length > 1) {
				this.pendingToolCalls = normalized.toolCalls.slice(1).map((tc) => ({
					name: tc.name,
					id: tc.id,
					arguments: tc.arguments,
				}));
			}
			const tc = normalized.toolCalls[0];
			return { type: 'tool', toolName: tc.name, toolCallId: tc.id, input: tc.arguments };
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
