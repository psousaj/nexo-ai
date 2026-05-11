import {
	bookService,
	braveSearchService,
	openGraphService,
	spotifyService,
	tmdbService,
	youtubeService,
} from '@/core/enrichment';
import { db } from '@/db';
import { agentSkills } from '@/db/schema/agent-skills';
import { eq } from 'drizzle-orm';
import { ContextAssembler } from '../context/context-assembler';
import type { SkillInfo } from '../context/context-assembler';
import { HermesKernel } from '../kernel/hermes-kernel';
import type { ModelTurnRunner } from '../kernel/model-turn-runner';
import { CredentialPool, DefaultModelTurnRunner } from '../model';
import { PostgresTranscriptStore } from '../session/transcript-store';
import { PostgresMemoryRegistry } from '../registries/memory-registry';
import type { MemoryRegistry } from '../registries/memory-registry';
import { PostgresSessionRegistry } from '../registries/session-registry';
import type { SessionRegistry } from '../registries/session-registry';
import { PostgresToolRegistry } from '../registries/tool-registry';
import type { HermesToolRegistry } from '../registries/tool-registry';

export interface HermesRuntime {
	sessionRegistry: SessionRegistry;
	memoryRegistry: MemoryRegistry;
	toolRegistry: HermesToolRegistry;
	kernel: HermesKernel;
	contextAssembler: ContextAssembler;
	signature?: string;
	transcriptStore?: PostgresTranscriptStore;
}

async function loadSkillsFromDb(): Promise<SkillInfo[]> {
	try {
		const skills = await db.select().from(agentSkills).where(eq(agentSkills.enabled, true));
		return skills.map((s) => ({
			name: s.name,
			description: s.description ?? '',
			content: s.content,
			triggers: (s.triggers ?? []) as string[],
			enabled: s.enabled,
		}));
	} catch {
		return [];
	}
}

export function createHermesRuntime(deps?: {
	modelTurnRunner?: ModelTurnRunner;
	toolRegistry?: HermesToolRegistry;
	memoryRegistry?: MemoryRegistry;
	sessionRegistry?: SessionRegistry;
	credentialPool?: CredentialPool;
	transcriptStore?: PostgresTranscriptStore;
	sessionId?: string;
}): HermesRuntime {
	const credentialPool = deps?.credentialPool ?? CredentialPool.fromEnv();
	const transcriptStore = deps?.transcriptStore ?? new PostgresTranscriptStore();
	const memoryRegistry = deps?.memoryRegistry ?? new PostgresMemoryRegistry();
	const toolRegistry =
		deps?.toolRegistry ??
		new PostgresToolRegistry({
			tmdbService: process.env.TMDB_API_KEY ? tmdbService : undefined,
			spotifyService: process.env.SPOTIFY_CLIENT_ID ? spotifyService : undefined,
			bookService: process.env.GOOGLE_BOOKS_API_KEY ? bookService : undefined,
			youtubeService,
			braveSearchService,
			openGraphService,
			memoryRegistry,
		});
	const sessionRegistry = deps?.sessionRegistry ?? new PostgresSessionRegistry();
	const contextAssembler = new ContextAssembler({ memoryRegistry, loadSkills: loadSkillsFromDb });
	const modelTurnRunner =
		deps?.modelTurnRunner ??
		new DefaultModelTurnRunner({
			credentialPool,
			transcriptStore,
			sessionId: deps?.sessionId,
		});
	const kernel = new HermesKernel({ modelTurnRunner, toolRegistry });
	return { sessionRegistry, memoryRegistry, toolRegistry, kernel, contextAssembler, transcriptStore };
}
