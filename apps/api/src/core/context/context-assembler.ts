import type { MemoryRegistry } from '@/core/registries/memory-registry';

export class ContextAssembler {
	constructor(private deps: { memoryRegistry: MemoryRegistry }) {}

	async build(input: { userId: string; sessionKey: string }) {
		const derivedMemory = await this.deps.memoryRegistry.loadRelevant({
			userId: input.userId,
			includeDerived: true,
		});

		const memorySummaries = (derivedMemory as Array<{ summary: string }>)
			.map((item) => item.summary)
			.filter(Boolean);

		const systemPromptParts = [
			'Você é o Nexo, um assistente pessoal.',
		];

		if (memorySummaries.length > 0) {
			systemPromptParts.push(`## Long-term Memory\n${memorySummaries.map((s) => `- ${s}`).join('\n')}`);
		}

		return {
			systemPrompt: systemPromptParts.join('\n\n'),
			sessionKey: input.sessionKey,
		};
	}

	async buildFromSessionKey(sessionKey: string) {
		const parts = sessionKey.split(':');
		const userId = parts[4] ?? 'unknown';
		return this.build({ userId, sessionKey });
	}
}
