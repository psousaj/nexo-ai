import { db } from '@/db';
import { agentSessions } from '@/db/schema/agent-sessions';
import { eq } from 'drizzle-orm';
import type { SessionRegistry } from '../registries/session-registry';
import type { TranscriptEntry, TranscriptStore } from './transcript-store';

export interface CompressionResult {
	compressed: boolean;
	newSessionKey?: string;
	newSessionId?: string;
}

export interface ContextCompressorOptions {
	transcriptStore: TranscriptStore;
	sessionRegistry: SessionRegistry;
	/** Max messages before compression triggers (default: 40) */
	threshold?: number;
	/** Messages to keep at start (default: 2) */
	headKeep?: number;
	/** Messages to keep at end (default: 6) */
	tailKeep?: number;
	/** Min minutes between compressions (default: 5) */
	cooldownMinutes?: number;
}

/** In-memory cooldown tracking per sessionId */
const lastCompression = new Map<string, number>();

/** Reset compression cooldown state (for testing) */
export function resetCompressionCooldown(): void {
	lastCompression.clear();
}

/**
 * Context Compressor for NEX-73.
 * When message count exceeds threshold, compresses the middle range
 * by summarizing it and creating a new session (session split).
 */
export class ContextCompressor {
	private threshold: number;
	private headKeep: number;
	private tailKeep: number;
	private cooldownMs: number;

	constructor(private opts: ContextCompressorOptions) {
		this.threshold = opts.threshold ?? 40;
		this.headKeep = opts.headKeep ?? 2;
		this.tailKeep = opts.tailKeep ?? 6;
		this.cooldownMs = (opts.cooldownMinutes ?? 5) * 60_000;
	}

	async checkAndCompress(sessionId: string, messages: TranscriptEntry[]): Promise<CompressionResult> {
		// 1. Threshold check
		if (messages.length < this.threshold) {
			return { compressed: false };
		}

		// 2. Anti-thrashing / cooldown
		const last = lastCompression.get(sessionId);
		if (last && Date.now() - last < this.cooldownMs) {
			return { compressed: false };
		}

		// 3. Preprocessing: filter out empty system/tool noise
		const clean = this.preprocess(messages);
		if (clean.length < this.threshold) {
			return { compressed: false };
		}

		// 4. Protected ranges
		const head = clean.slice(0, this.headKeep);
		const tail = clean.slice(-this.tailKeep);
		const middle = clean.slice(this.headKeep, clean.length - this.tailKeep);

		if (middle.length === 0) {
			return { compressed: false };
		}

		// 5. Summarize middle (MVP: placeholder)
		const summary = await this.summarize(middle);

		// 6. Session split
		const newSessionKey = await this.splitSession(sessionId, head, summary, tail);
		if (!newSessionKey) {
			return { compressed: false };
		}

		// 7. Mark cooldown
		lastCompression.set(sessionId, Date.now());

		// Load new session record to return id
		const record = (await this.opts.sessionRegistry.load(newSessionKey)) as any;

		return {
			compressed: true,
			newSessionKey,
			newSessionId: record?.id,
		};
	}

	private preprocess(messages: TranscriptEntry[]): TranscriptEntry[] {
		return messages.filter((m) => {
			if (m.role === 'system') return false;
			if (!m.content || m.content.trim().length === 0) return false;
			return true;
		});
	}

	private async summarize(messages: TranscriptEntry[]): Promise<string> {
		// MVP placeholder: concatenate with truncation
		const combined = messages.map((m) => `[${m.role}] ${m.content}`).join('\n');
		if (combined.length > 4000) {
			return combined.slice(0, 4000) + '\n...[truncated]';
		}
		return combined;
	}

	private async splitSession(
		oldSessionId: string,
		head: TranscriptEntry[],
		summary: string,
		tail: TranscriptEntry[],
	): Promise<string | null> {
		// Load old session to get its key and metadata
		const oldRows = await db.select().from(agentSessions).where(eq(agentSessions.id, oldSessionId)).limit(1);
		const oldSession = oldRows[0];
		if (!oldSession) return null;

		const oldSessionKey = oldSession.sessionKey;
		const newSessionKey = `${oldSessionKey}:compressed:${Date.now()}`;

		// Mark old session as ended
		await db
			.update(agentSessions)
			.set({ endedAt: new Date(), resetReason: 'context_compression' })
			.where(eq(agentSessions.id, oldSessionId));

		// Create new session record
		const newSessionRows = await db
			.insert(agentSessions)
			.values({
				sessionKey: newSessionKey,
				channel: oldSession.channel,
				peerKind: oldSession.peerKind,
				peerId: oldSession.peerId,
				agentId: oldSession.agentId,
				accountId: oldSession.accountId,
				userId: oldSession.userId,
				conversationId: oldSession.conversationId,
				model: oldSession.model,
				thinkingLevel: oldSession.thinkingLevel,
				dmScope: oldSession.dmScope,
				parentSessionId: oldSessionId,
			})
			.returning();

		const newSession = newSessionRows[0];
		if (!newSession) return null;

		// Build compressed context for new session
		const compressedEntries: TranscriptEntry[] = [
			...head,
			{
				role: 'assistant',
				content: `**Contexto anterior resumido:**\n${summary}`,
				timestamp: new Date(),
			},
			...tail,
		];

		await this.opts.transcriptStore.save(newSession.id, compressedEntries);
		return newSessionKey;
	}
}
