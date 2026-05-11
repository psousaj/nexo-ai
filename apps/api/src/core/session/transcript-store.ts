import { db } from '@/db';
import { sessionTranscripts } from '@/db/schema/session-transcripts';
import { eq, desc } from 'drizzle-orm';

export interface TranscriptEntry {
	role: 'user' | 'assistant' | 'tool' | 'system';
	content: string;
	tool_calls?: Array<{
		id: string;
		type: 'function';
		function: { name: string; arguments: string };
	}>;
	timestamp: Date;
	sequence: number;
}

export class PostgresTranscriptStore {
	async load(sessionId: string): Promise<TranscriptEntry[]> {
		const rows = await db.select().from(sessionTranscripts).where(eq(sessionTranscripts.sessionId, sessionId)).orderBy(sessionTranscripts.sequence);
		return rows.map((row) => ({
			role: (row.content as any).role,
			content: (row.content as any).content,
			tool_calls: (row.content as any).tool_calls,
			timestamp: row.createdAt,
			sequence: row.sequence,
		}));
	}

	async append(sessionId: string, entry: TranscriptEntry): Promise<void> {
		await db.insert(sessionTranscripts).values({
			sessionId,
			content: {
				role: entry.role,
				content: entry.content,
				tool_calls: entry.tool_calls,
			},
			sequence: entry.sequence,
			searchText: entry.content.slice(0, 1000),
			createdAt: entry.timestamp,
		});
	}

	async getLastSequence(sessionId: string): Promise<number> {
		const [row] = await db
			.select({ sequence: sessionTranscripts.sequence })
			.from(sessionTranscripts)
			.where(eq(sessionTranscripts.sessionId, sessionId))
			.orderBy(desc(sessionTranscripts.sequence))
			.limit(1);
		return row?.sequence ?? -1;
	}
}
