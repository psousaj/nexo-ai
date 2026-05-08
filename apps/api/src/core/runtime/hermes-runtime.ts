import { HermesKernel } from '../kernel/hermes-kernel';
import { DefaultModelTurnRunner, CredentialPool } from '../model';
import { PostgresMemoryRegistry } from '../registries/memory-registry';
import { PostgresSessionRegistry } from '../registries/session-registry';
import { PostgresToolRegistry } from '../registries/tool-registry';
import type { ModelTurnRunner } from '../kernel/model-turn-runner';
import type { MemoryRegistry } from '../registries/memory-registry';
import type { SessionRegistry } from '../registries/session-registry';
import type { HermesToolRegistry } from '../registries/tool-registry';
import { ContextAssembler } from '../context/context-assembler';

export interface HermesRuntime {
	sessionRegistry: SessionRegistry;
	memoryRegistry: MemoryRegistry;
	toolRegistry: HermesToolRegistry;
	kernel: HermesKernel;
	contextAssembler: ContextAssembler;
}

export function createHermesRuntime(deps?: {
	modelTurnRunner?: ModelTurnRunner;
	toolRegistry?: HermesToolRegistry;
	memoryRegistry?: MemoryRegistry;
	sessionRegistry?: SessionRegistry;
	credentialPool?: CredentialPool;
}): HermesRuntime {
	const credentialPool = deps?.credentialPool ?? CredentialPool.fromEnv();
	const memoryRegistry = deps?.memoryRegistry ?? new PostgresMemoryRegistry();
	const toolRegistry = deps?.toolRegistry ?? new PostgresToolRegistry();
	const sessionRegistry = deps?.sessionRegistry ?? new PostgresSessionRegistry();
	const contextAssembler = new ContextAssembler({ memoryRegistry });
	const modelTurnRunner = deps?.modelTurnRunner ?? new DefaultModelTurnRunner({ credentialPool });
	const kernel = new HermesKernel({ modelTurnRunner, toolRegistry });
	return { sessionRegistry, memoryRegistry, toolRegistry, kernel, contextAssembler };
}
