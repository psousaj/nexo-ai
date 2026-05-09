import { db } from '@/db';
import { memoryEnvelopes } from '@/db/schema/memory-envelopes';
import { desc, eq } from 'drizzle-orm';

export interface MemoryRegistry {
	store(input: unknown): Promise<unknown>;
	loadRelevant(input: unknown): Promise<unknown[]>;
}

export class PostgresMemoryRegistry implements MemoryRegistry {
	async store(input: unknown) {
		const data = input as {
			userId: string;
			sessionKey: string;
			content: string;
			sourceKind: string;
			confidence?: number;
		};
		try {
			const [inserted] = await db
				.insert(memoryEnvelopes)
				.values({
					userId: data.userId,
					sessionKey: data.sessionKey,
					sourceKind: data.sourceKind ?? 'intake',
					normalizedContent: data.content,
					rawArtifact: {},
					artifactMetadata: {},
					confidence: data.confidence ?? 1,
					relevanceDecay: { decayClass: 'contextual', decayScore: 1, reinforcementCount: 0 },
					audit: { source: 'hermes_kernel' },
				})
				.returning();
			return inserted;
		} catch {
			return null;
		}
	}

	async loadRelevant(input: unknown): Promise<Array<{ summary: string; confidence: number }>> {
		const { userId, limit } = input as { userId: string; limit?: number };
		try {
			const rows = await db
				.select({ content: memoryEnvelopes.normalizedContent, confidence: memoryEnvelopes.confidence })
				.from(memoryEnvelopes)
				.where(eq(memoryEnvelopes.userId, userId))
				.orderBy(desc(memoryEnvelopes.confidence))
				.limit(limit ?? 10);
			return rows.map((r) => ({ summary: r.content, confidence: r.confidence ?? 1 }));
		} catch {
			// Fallback: try without the confidence column (it may not exist in the table yet)
			try {
				const rows = await db
					.select({ content: memoryEnvelopes.normalizedContent })
					.from(memoryEnvelopes)
					.where(eq(memoryEnvelopes.userId, userId))
					.orderBy(desc(memoryEnvelopes.createdAt))
					.limit(limit ?? 10);
				return rows.map((r) => ({ summary: r.content, confidence: 1 }));
			} catch {
				return [];
			}
		}
	}
}
