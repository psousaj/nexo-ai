import { captureException } from '@/sentry';
import { HermesRuntimeError } from '../contracts/runtime-error';
import { writeTurnAudit } from '../observability/turn-audit';
import type { HermesToolRegistry } from '../registries/tool-registry';
import type { ModelTurnRunner } from './model-turn-runner';
import { executeToolWithPolicy } from './tool-executor';

export interface KernelCallbacks {
	onToolStart?: (toolName: string, input: unknown) => void | Promise<void>;
	onToolEnd?: (toolName: string, result: unknown) => void | Promise<void>;
	onRespond?: (text: string) => void | Promise<void>;
	onDelta?: (delta: string) => void | Promise<void>;
}

export interface InterruptSignal {
	requested: boolean;
	message: string | null;
}

export class HermesKernel {
	constructor(
		private deps: {
			modelTurnRunner: ModelTurnRunner;
			toolRegistry: HermesToolRegistry;
		},
	) {}

	get modelTurnRunner(): ModelTurnRunner {
		return this.deps.modelTurnRunner;
	}

	get toolRegistry(): HermesToolRegistry {
		return this.deps.toolRegistry;
	}

	async runTurn(
		input: { sessionKey: string; userMessage: string; systemPrompt: string },
		callbacks?: KernelCallbacks,
		interrupt?: InterruptSignal,
	): Promise<{ text: string; interrupted?: boolean; interruptMessage?: string }> {
		const toolsUsed: string[] = [];
		const failures: string[] = [];

		// Auto-continue: if last message was a tool result after crash
		if (this.deps.modelTurnRunner.needsAutoContinue?.()) {
			input.userMessage = `[System note: Your turn was interrupted. Please continue.]\n\n${input.userMessage}`;
		}

		try {
			for (let step = 0; step < 6; step++) {
				// Interrupt check: before every LLM call
				if (interrupt?.requested) {
					void writeTurnAudit({ runType: 'interrupted', sessionKey: input.sessionKey, policies: [], tools: toolsUsed });
					return { text: '', interrupted: true, interruptMessage: interrupt.message ?? undefined };
				}

				const catalog = await this.deps.toolRegistry.buildHermesToolCatalog();
				const toolSchemas = catalog.map((t) => ({
					name: t.name,
					description: t.description,
					parameters: t.jsonSchema,
				}));

				const next = await this.deps.modelTurnRunner.next(
					{ ...input, tools: toolSchemas },
					{ stream: true, onDelta: callbacks?.onDelta },
				);

				if (next.type === 'tool' && next.toolCalls && next.toolCalls.length > 0) {
					// --- Batch execution: run ALL tool calls in parallel (Hermes pattern) ---
					for (const tc of next.toolCalls) {
						await callbacks?.onToolStart?.(tc.toolName, tc.input ?? {});
					}

					// Interrupt check: before tool execution
					// If the LLM just returned tool_calls and the assistant message
					// was already pushed to the runner, we MUST add stub results for
					// all tool_calls before returning. Otherwise the next LLM call
					// sees orphaned tool_calls and fails with 400.
					// The onToolStart callbacks already set up the UI (clarify buttons,
					// confirm inline keyboard), so the user can interact from there.
					if (interrupt?.requested) {
						for (const tc of next.toolCalls) {
							failures.push(tc.toolName);
							this.deps.modelTurnRunner.addToolResult?.(tc.toolName, tc.toolCallId ?? tc.toolName, {
								error: true,
								tool: tc.toolName,
								message: 'Interrompido antes de executar.',
							});
						}
						void writeTurnAudit({
							runType: 'interrupted',
							sessionKey: input.sessionKey,
							policies: [],
							tools: toolsUsed,
						});
						return { text: '', interrupted: true, interruptMessage: interrupt.message ?? undefined };
					}

					const results = await Promise.allSettled(
						next.toolCalls.map(async (tc) => {
							const descriptor = catalog.find((t) => t.name === tc.toolName);
							if (!descriptor) {
								captureException(new Error(`Tool not found: ${tc.toolName}`), { sessionKey: input.sessionKey });
								throw new HermesRuntimeError('tool_not_found', `Tool ${tc.toolName} not found in catalog`);
							}

							return executeToolWithPolicy({
								descriptor,
								execute: () => descriptor.execute(input, tc.input ?? {}),
							});
						}),
					);

					for (let i = 0; i < results.length; i++) {
						const tc = next.toolCalls[i];
						const settled = results[i];

						if (settled.status === 'rejected') {
							failures.push(tc.toolName);
							await callbacks?.onToolEnd?.(tc.toolName, { error: true });
							this.deps.modelTurnRunner.addToolResult?.(tc.toolName, tc.toolCallId ?? tc.toolName, {
								error: true,
								tool: tc.toolName,
								message: 'A ferramenta falhou ao executar.',
							});
							continue;
						}

						const result = settled.value;

						await callbacks?.onToolEnd?.(tc.toolName, result);

						if (result.status === 'blocked') {
							// Blocked tools (requiresConfirmation) already had their
							// UI handled by onToolStart callback (inline keyboard, etc).
							// No need to return early — just continue so all tools
							// in the batch get their results added to messages.
							if (result.requiresConfirmation) {
								failures.push(tc.toolName);
								this.deps.modelTurnRunner.addToolResult?.(tc.toolName, tc.toolCallId ?? tc.toolName, {
									error: true,
									tool: tc.toolName,
									message: `Tool ${tc.toolName} is denied by policy`,
								});
								continue;
							}
							failures.push(tc.toolName);
							this.deps.modelTurnRunner.addToolResult?.(tc.toolName, tc.toolCallId ?? tc.toolName, {
								error: true,
								tool: tc.toolName,
								message: `Tool ${tc.toolName} is denied by policy`,
							});
							continue;
						}

						if (result.status === 'error') {
							failures.push(tc.toolName);
							this.deps.modelTurnRunner.addToolResult?.(tc.toolName, tc.toolCallId ?? tc.toolName, {
								error: true,
								tool: tc.toolName,
								message: 'A ferramenta falhou ao executar.',
							});
							continue;
						}

						const resultData = result.data as Record<string, unknown> | undefined;
						if (resultData?._requiresInput) {
							// Tools that require user input (clarify) already had
							// their UI handled by onToolStart callback. Just add the
							// result and continue — no need to return early.
							toolsUsed.push(tc.toolName);
							this.deps.modelTurnRunner.addToolResult?.(tc.toolName, tc.toolCallId ?? tc.toolName, result);
							continue;
						}

						toolsUsed.push(tc.toolName);
						this.deps.modelTurnRunner.addToolResult?.(tc.toolName, tc.toolCallId ?? tc.toolName, result);
					}
				}

				if (next.type === 'respond') {
					await callbacks?.onRespond?.(next.text!);
					void writeTurnAudit({ runType: 'normal', sessionKey: input.sessionKey, policies: [], tools: toolsUsed });
					return { text: next.text! };
				}
			}

			throw new HermesRuntimeError('turn_budget_exhausted', 'HermesKernel exceeded the maximum step budget');
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));
			captureException(err, {
				sessionKey: input.sessionKey,
				toolsUsed: toolsUsed.join(','),
				failures: failures.join(','),
			});
			void writeTurnAudit({ runType: 'error', sessionKey: input.sessionKey, policies: [], tools: toolsUsed });
			throw error;
		}
	}
}
