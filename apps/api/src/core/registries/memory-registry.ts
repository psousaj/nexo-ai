import { db } from '@/db';
import { memoryEnvelopes } from '@/db/schema/memory-envelopes';
import { loggers } from '@/utils/logger';
import { desc, eq } from 'drizzle-orm';

const log = loggers.db;

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
		} catch (err: any) {
			// FK violation: user doesn't exist — return structured error for LLM to handle
			if (err.message?.includes('violates foreign key constraint')) {
				log.warn(
					{ userId: data.userId, sessionKey: data.sessionKey },
					'memoryRegistry.store: user not found (ghost user)',
				);
				return {
					status: 'error',
					error: 'user_not_found',
					message: 'Usuário não cadastrado. É necessário fazer cadastro na plataforma para salvar memórias.',
				};
			}
			log.error(
				{ err, userId: data.userId, sessionKey: data.sessionKey },
				'memoryRegistry.store: erro ao inserir memory_envelope',
			);
			return {
				status: 'error',
				error: 'database_error',
				message: 'Erro interno ao salvar memória. Tente novamente mais tarde.',
			};
		}
	}

	async loadRelevant(input: unknown): Promise<Array<{ summary: string; confidence: number; createdAt: string }>> {
		const { userId, limit } = input as { userId: string; limit?: number };
		try {
			const rows = await db
				.select({
					content: memoryEnvelopes.normalizedContent,
					confidence: memoryEnvelopes.confidence,
					createdAt: memoryEnvelopes.createdAt,
				})
				.from(memoryEnvelopes)
				.where(eq(memoryEnvelopes.userId, userId))
				.orderBy(desc(memoryEnvelopes.createdAt))
				.limit(limit ?? 10);
			return rows.map((r) => ({
				summary: r.content,
				confidence: r.confidence ?? 1,
				createdAt: r.createdAt?.toISOString() ?? '',
			}));
		} catch (err) {
			log.warn({ err, userId }, 'memoryRegistry.loadRelevant: fallback — confidence column pode não existir');
			try {
				const rows = await db
					.select({ content: memoryEnvelopes.normalizedContent, createdAt: memoryEnvelopes.createdAt })
					.from(memoryEnvelopes)
					.where(eq(memoryEnvelopes.userId, userId))
					.orderBy(desc(memoryEnvelopes.createdAt))
					.limit(limit ?? 10);
				return rows.map((r) => ({ summary: r.content, confidence: 1, createdAt: r.createdAt?.toISOString() ?? '' }));
			} catch (err2) {
				log.error({ err: err2, userId }, 'memoryRegistry.loadRelevant: erro fatal ao carregar memórias');
				return [];
			}
		}
	}
}
