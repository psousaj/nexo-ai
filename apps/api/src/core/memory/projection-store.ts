import { db } from '@/db';
import { memoryEnvelopes } from '@/db/schema/memory-envelopes';

export class PostgresProjectionStore {
	async writeEnvelope(input: {
		userId: string;
		sessionKey: string;
		sourceKind: string;
		sourceChannel?: string;
		normalizedContent: string;
		rawArtifact: unknown;
		artifactMetadata: Record<string, unknown>;
		confidence: number;
		relevanceDecay: unknown;
		audit: unknown;
	}) {
		const [envelope] = await db
			.insert(memoryEnvelopes)
			.values({
				userId: input.userId,
				sessionKey: input.sessionKey,
				sourceKind: input.sourceKind,
				sourceChannel: input.sourceChannel,
				normalizedContent: input.normalizedContent,
				rawArtifact: input.rawArtifact as any,
				artifactMetadata: input.artifactMetadata as any,
				confidence: input.confidence,
				relevanceDecay: input.relevanceDecay as any,
				audit: input.audit as any,
			})
			.returning();

		return envelope;
	}

	async linkToMemoryItem(_envelopeId: string, _itemId: string): Promise<void> {}

	async linkToMemoryInsight(_envelopeId: string, _insightId: string): Promise<void> {}
}
