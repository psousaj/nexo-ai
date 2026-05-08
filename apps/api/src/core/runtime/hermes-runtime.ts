import { HermesKernel } from '../kernel/hermes-kernel';
import type { ModelTurnRunner } from '../kernel/model-turn-runner';
import type { MemoryRegistry } from '../registries/memory-registry';
import type { SessionRegistry } from '../registries/session-registry';
import type { HermesToolRegistry } from '../registries/tool-registry';

export interface HermesRuntime {
	sessionRegistry: SessionRegistry;
	memoryRegistry: MemoryRegistry;
	toolRegistry: HermesToolRegistry;
	kernel: HermesKernel;
}

export function createHermesRuntime(deps?: {
	modelTurnRunner: ModelTurnRunner;
	toolRegistry: HermesToolRegistry;
}): HermesRuntime {
	const toolRegistry = deps?.toolRegistry ?? ({} as HermesToolRegistry);
	return {
		sessionRegistry: {} as SessionRegistry,
		memoryRegistry: {} as MemoryRegistry,
		toolRegistry,
		kernel: new HermesKernel({
			modelTurnRunner: deps?.modelTurnRunner ?? ({} as ModelTurnRunner),
			toolRegistry,
		}),
	};
}
