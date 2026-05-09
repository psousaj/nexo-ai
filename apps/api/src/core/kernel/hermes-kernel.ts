import { HermesRuntimeError } from '../contracts/runtime-error';
import type { HermesToolRegistry } from '../registries/tool-registry';
import type { ModelTurnRunner } from './model-turn-runner';
import { executeToolWithPolicy } from './tool-executor';

export interface KernelCallbacks {
	onToolStart?: (toolName: string, input: unknown) => void;
	onToolEnd?: (toolName: string, result: unknown) => void;
	onRespond?: (text: string) => void;
}

export class HermesKernel {
	constructor(
		private deps: {
			modelTurnRunner: ModelTurnRunner;
			toolRegistry: HermesToolRegistry;
		},
	) {}

	async runTurn(
		input: { sessionKey: string; userMessage: string; systemPrompt: string },
		callbacks?: KernelCallbacks,
	): Promise<{ text: string }> {
		for (let step = 0; step < 6; step++) {
			const catalog = await this.deps.toolRegistry.buildHermesToolCatalog();
			const toolSchemas = catalog.map((t) => ({
				name: t.name,
				description: t.description,
				parameters: t.jsonSchema,
			}));

			const next = await this.deps.modelTurnRunner.next({
				...input,
				tools: toolSchemas,
			});

			if (next.type === 'tool' && next.toolName) {
				callbacks?.onToolStart?.(next.toolName, next.input ?? {});
				const catalog = await this.deps.toolRegistry.buildHermesToolCatalog();
				const descriptor = catalog.find((t) => t.name === next.toolName);
				if (!descriptor) {
					throw new HermesRuntimeError('tool_not_found', `Tool ${next.toolName} not found in catalog`);
				}

				const result = await executeToolWithPolicy({
					descriptor,
					execute: () => descriptor.execute(input, next.input ?? {}),
				});

				callbacks?.onToolEnd?.(next.toolName, result);

				if (result.status === 'blocked') {
					if (result.requiresConfirmation) {
						return { text: `Tool ${next.toolName} requires confirmation.` };
					}
					throw new HermesRuntimeError('tool_denied', `Tool ${next.toolName} is denied by policy`);
				}

				if (result.status === 'error') {
					throw new HermesRuntimeError('tool_execution_error', `Failed to execute tool ${next.toolName}`);
				}

				// Signal that this tool requires user input — break the loop
				const resultData = result.data as Record<string, unknown> | undefined;
				if (resultData?._requiresInput) {
					await this.deps.modelTurnRunner.addToolResult?.(next.toolName, next.toolCallId ?? next.toolName, result);
					return { text: '' };
				}

				await this.deps.modelTurnRunner.addToolResult?.(next.toolName, next.toolCallId ?? next.toolName, result);
			}

			if (next.type === 'respond') {
				callbacks?.onRespond?.(next.text!);
				return { text: next.text! };
			}
		}

		throw new HermesRuntimeError('turn_budget_exhausted', 'HermesKernel exceeded the maximum step budget');
	}
}
