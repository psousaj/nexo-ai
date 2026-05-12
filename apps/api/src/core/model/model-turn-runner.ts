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

	async next(context: unknown, options?: import('../kernel/model-turn-runner').NextOptions): Promise<ModelTurnOutput> {
		// Wait for history to load before proceeding
		if (this.historyLoaded) {
			await this.historyLoaded;
		}

		if (options?.stream) {
			return this.nextStreaming(context, options);
		}

		return this.nextBlocking(context);
	}

	private async nextBlocking(context: unknown): Promise<ModelTurnOutput> {
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
				tool_calls: assistantMsg.tool_calls as any,
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
			// DEBUG: log message sequence to find root cause
			const msgSeq = this.messages.map((m: any) => {
				const tc = m.tool_calls;
				const tcIds = tc ? (tc as any[]).map((t: any) => t.id) : [];
				return `${m.role}${tcIds.length ? `[tc:${tcIds.join(',')}]` : ''}${m.tool_call_id ? `[result:${m.tool_call_id}]` : ''}`;
			});
			console.error('[DEBUG-MSG] Messages:', JSON.stringify(msgSeq));
			if (error?.status === 429 || error?.status === 402) {
				this.credentialPool.markExhausted(activeProvider, resolved.apiKey);
				return { type: 'respond', text: 'O serviço de IA está sobrecarregado. Tente novamente em alguns instantes.' };
			}
			return { type: 'respond', text: 'Desculpe, não consegui processar sua mensagem agora.' };
		}
	}

	private async nextStreaming(
		context: unknown,
		options: import('../kernel/model-turn-runner').NextOptions,
	): Promise<ModelTurnOutput> {
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
				stream: true,
			});

			const stream = await client.chat.completions.create({
				...kwargs,
				stream: true,
			} as any);

			let fullContent = '';
			const toolCallMap = new Map<number, any>();
			let finishReason: string | undefined;

			for await (const chunk of stream) {
				const normalized = transport.normalizeStreamChunk(chunk);

				if (normalized.delta) {
					fullContent += normalized.delta;
					await options.onDelta?.(normalized.delta);
				}

				if (normalized.toolCalls) {
					for (const tc of normalized.toolCalls) {
						const existing = toolCallMap.get(tc.index);
						if (existing) {
							if (tc.id) existing.id = tc.id;
							if (tc.function?.name) existing.function.name = tc.function.name;
							if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;
						} else {
							toolCallMap.set(tc.index, {
								index: tc.index,
								id: tc.id,
								type: tc.type,
								function: {
									name: tc.function?.name || '',
									arguments: tc.function?.arguments || '',
								},
							});
						}
					}
				}

				if (normalized.finishReason) {
					finishReason = normalized.finishReason;
				}
			}

			const accumulatedToolCalls = Array.from(toolCallMap.values()).sort((a, b) => a.index - b.index);

			const toolCallsResult: ToolCall[] | null = accumulatedToolCalls.length
				? accumulatedToolCalls.map((tc) => ({
						id: tc.id,
						name: tc.function.name,
						arguments: JSON.parse(tc.function.arguments || '{}'),
					}))
				: null;

			this.lastReasoningContent = null;

			const assistantMsg: Record<string, unknown> = {
				role: 'assistant',
				content: fullContent,
			};
			if (toolCallsResult) {
				assistantMsg.tool_calls = accumulatedToolCalls.map((tc) => ({
					id: tc.id,
					type: 'function',
					function: { name: tc.function.name, arguments: tc.function.arguments },
				}));
			}
			this.messages.push(assistantMsg);
			await this.persistMessage({
				role: 'assistant',
				content: (assistantMsg.content as string) ?? '',
				tool_calls: assistantMsg.tool_calls as any,
				timestamp: new Date(),
			});

			const normalizedResponse: NormalizedResponse = {
				content: fullContent,
				toolCalls: toolCallsResult,
				finishReason: (finishReason as NormalizedResponse['finishReason']) || 'stop',
				reasoning: null,
				usage: null,
				providerData: null,
			};

			return this.toModelTurnOutput(normalizedResponse);
		} catch (error: any) {
			console.error(
				'[ModelTurnRunner] LLM API error:',
				error?.status,
				error?.message,
				JSON.stringify(error?.stack ?? '').slice(0, 300),
			);
			// DEBUG: log message sequence to find root cause
			const msgSeq = this.messages.map((m: any) => {
				const tc = m.tool_calls;
				const tcIds = tc ? (tc as any[]).map((t: any) => t.id) : [];
				return `${m.role}${tcIds.length ? `[tc:${tcIds.join(',')}]` : ''}${m.tool_call_id ? `[result:${m.tool_call_id}]` : ''}`;
			});
			console.error('[DEBUG-MSG] Messages:', JSON.stringify(msgSeq));
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
			tool_call_id: toolCallId,
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
		this.messages = transcripts
			.filter((t) => {
				if (t.role === 'tool' && !t.tool_call_id) return false;
				return true;
			})
			.map((t) => ({
				role: t.role,
				content: t.content,
				...(t.tool_call_id ? { tool_call_id: t.tool_call_id } : {}),
				...(t.tool_calls ? { tool_calls: t.tool_calls } : {}),
			}));
		this.sequenceCounter = transcripts.length > 0 ? Math.max(...transcripts.map((t) => t.sequence)) + 1 : 0;
		this.sanitizeIncompleteToolCallsInHistory();
	}

	/**
	 * After loading history, detect and fix incomplete tool_call/tool_result pairs.
	 *
	 * If the last assistant message has tool_calls but some are missing their
	 * corresponding tool responses (crash during parallel execution), insert
	 * stub results. This prevents the "tool_calls must be followed by tool
	 * messages" API error.
	 *
	 * Mirrors Hermes' _sanitize_tool_pairs / Phase 4 concept.
	 */
	private sanitizeIncompleteToolCallsInHistory(): void {
		// Scan ALL assistant messages with tool_calls, not just the last one.
		// Old code from crashed sessions may have orphaned pairs anywhere.
		for (let idx = this.messages.length - 1; idx >= 0; idx--) {
			const m = this.messages[idx] as Record<string, unknown>;
			if (m.role !== 'assistant' || !Array.isArray(m.tool_calls) || (m.tool_calls as any[]).length === 0) {
				continue;
			}

			const toolCalls = (m as any).tool_calls as Array<{ id: string }>;

			// Collect tool response IDs after this assistant
			const respondedIds = new Set<string>();
			for (let i = idx + 1; i < this.messages.length; i++) {
				const msg = this.messages[i] as Record<string, unknown>;
				if (msg.role === 'tool' && msg.tool_call_id) {
					respondedIds.add(msg.tool_call_id as string);
				}
			}

			// Find missing tool responses
			const missing = toolCalls.filter((tc) => !respondedIds.has(tc.id));
			if (missing.length === 0) continue;

			// Insert stub results for missing tool calls
			for (const tc of missing) {
				this.messages.push({
					role: 'tool',
					tool_call_id: tc.id,
					content: '[Result from earlier conversation]',
				});
			}
		}
	}

	private async persistMessage(entry: Omit<TranscriptEntry, 'sequence'>): Promise<void> {
		if (this.deps.transcriptStore && this.deps.sessionId) {
			await this.deps.transcriptStore.append(this.deps.sessionId, {
				...entry,
				sequence: this.sequenceCounter++,
			});
		}
	}

	getMessages(): Array<Record<string, unknown>> {
		return this.messages;
	}

	setMessages(messages: Array<Record<string, unknown>>): void {
		this.messages = messages;
		this.lastUserMessage = null;
	}

	clearMessages(): void {
		this.messages = [];
		this.lastUserMessage = null;
		this.lastReasoningContent = null;
	}

	private toModelTurnOutput(normalized: NormalizedResponse): ModelTurnOutput {
		if (normalized.toolCalls && normalized.toolCalls.length > 0) {
			return {
				type: 'tool',
				toolCalls: normalized.toolCalls.map((tc) => ({
					toolName: tc.name,
					toolCallId: tc.id,
					input: tc.arguments,
				})),
			};
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
