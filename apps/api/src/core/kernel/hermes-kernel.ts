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

				if (next.type === 'tool' && next.toolName) {
					await callbacks?.onToolStart?.(next.toolName, next.input ?? {});

					// Interrupt check: before tool execution
					if (interrupt?.requested) {
						void writeTurnAudit({
							runType: 'interrupted',
							sessionKey: input.sessionKey,
							policies: [],
							tools: toolsUsed,
						});
						return { text: '', interrupted: true, interruptMessage: interrupt.message ?? undefined };
					}

					const catalog = await this.deps.toolRegistry.buildHermesToolCatalog();
					const descriptor = catalog.find((t) => t.name === next.toolName);
					if (!descriptor) {
						captureException(new Error(`Tool not found: ${next.toolName}`), { sessionKey: input.sessionKey });
						throw new HermesRuntimeError('tool_not_found', `Tool ${next.toolName} not found in catalog`);
					}

					const result = await executeToolWithPolicy({
						descriptor,
						execute: () => descriptor.execute(input, next.input ?? {}),
					});

					await callbacks?.onToolEnd?.(next.toolName, result);

					if (result.status === 'blocked') {
						if (result.requiresConfirmation) return { text: `Tool ${next.toolName} requires confirmation.` };
						throw new HermesRuntimeError('tool_denied', `Tool ${next.toolName} is denied by policy`);
					}

					if (result.status === 'error') {
						failures.push(next.toolName);
						this.deps.modelTurnRunner.addToolResult?.(next.toolName, next.toolCallId ?? next.toolName, {
							error: true,
							tool: next.toolName,
							message: 'A ferramenta falhou ao executar.',
						});
						continue;
					}

					const resultData = result.data as Record<string, unknown> | undefined;
					if (resultData?._requiresInput) {
						toolsUsed.push(next.toolName);
						this.deps.modelTurnRunner.addToolResult?.(next.toolName, next.toolCallId ?? next.toolName, result);
						void writeTurnAudit({ runType: 'normal', sessionKey: input.sessionKey, policies: [], tools: toolsUsed });
						return { text: '' };
					}

					toolsUsed.push(next.toolName);
					this.deps.modelTurnRunner.addToolResult?.(next.toolName, next.toolCallId ?? next.toolName, result);
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
