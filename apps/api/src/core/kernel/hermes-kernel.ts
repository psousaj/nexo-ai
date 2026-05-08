import { HermesRuntimeError } from '../contracts/runtime-error';
import type { HermesToolRegistry } from '../registries/tool-registry';
import type { ModelTurnRunner } from './model-turn-runner';
import { executeToolWithPolicy } from './tool-executor';

export class HermesKernel {
	constructor(
		private deps: {
			modelTurnRunner: ModelTurnRunner;
			toolRegistry: HermesToolRegistry;
		},
	) {}

	async runTurn(input: { sessionKey: string }): Promise<{ text: string }> {
		for (let step = 0; step < 6; step++) {
			const next = await this.deps.modelTurnRunner.next(input);

			if (next.type === 'tool' && next.toolName) {
				const catalog = await this.deps.toolRegistry.buildHermesToolCatalog();
				const descriptor = catalog.find((t) => t.name === next.toolName);
				if (!descriptor) {
					throw new HermesRuntimeError('tool_not_found', `Tool ${next.toolName} not found in catalog`);
				}

				const result = await executeToolWithPolicy({
					descriptor,
					execute: () => descriptor.execute(input, next.input ?? {}),
				});

				if (result.status === 'blocked') {
					if (result.requiresConfirmation) {
						return { text: `Tool ${next.toolName} requires confirmation.` };
					}
					throw new HermesRuntimeError('tool_denied', `Tool ${next.toolName} is denied by policy`);
				}

				if (result.status === 'error') {
					throw new HermesRuntimeError('tool_execution_error', `Failed to execute tool ${next.toolName}`);
				}
			}

			if (next.type === 'respond') return { text: next.text! };
		}

		throw new HermesRuntimeError('turn_budget_exhausted', 'HermesKernel exceeded the maximum step budget');
	}
}
