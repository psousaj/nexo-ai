import { db } from '@/db';
import { agentSessions } from '@/db/schema/agent-sessions';
import { loggers } from '@/utils/logger';
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
	/** Cloudflare Workers AI model for summarization (default: @cf/moonshotai/kimi-k2.6) */
	summarizationModel?: string;
}

interface CFSummarizeResponse {
	result: { response: string };
	success: boolean;
	errors?: Array<{ message: string }>;
}

const log = loggers.cloudflare;
const SUMMARIZATION_MODEL = '@cf/moonshotai/kimi-k2.6';

const ACTION_LOG_SYSTEM_PROMPT = `You are a conversation summarizer. Summarize the conversation segment below into a structured action-log format.

Use this EXACT format:

- Completed Actions:
  N. ACTION target — outcome [tool: name]

- Active State:
  current context, files, or status

- In Progress / Blocked:
  any pending items or blockers

- Key Decisions:
  important choices made

- Pending User Asks:
  what the user still needs to respond to

- Remaining Work:
  what's left to do

Be specific. "Changed some files" is not acceptable. Use Portuguese (Brazilian).`;

/** In-memory cooldown tracking per sessionId */
const lastCompression = new Map<string, number>();
/** Track savings from last 2 compressions per sessionId for anti-thrashing */
const compressionSavings = new Map<string, number[]>();
/** Timestamp of last provider-level failure */
let lastProviderFailureTime = 0;

/** Reset compression cooldown state (for testing) */
export function resetCompressionCooldown(): void {
	lastCompression.clear();
	compressionSavings.clear();
	lastProviderFailureTime = 0;
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

		// 2. Cooldown / anti-thrashing checks
		const last = lastCompression.get(sessionId);
		if (last && Date.now() - last < this.cooldownMs) {
			return { compressed: false };
		}

		// 2b. Provider failure cooldown: if LLM summarization failed <10min ago, skip
		if (lastProviderFailureTime > 0 && Date.now() - lastProviderFailureTime < 10 * 60 * 1000) {
			return { compressed: false, newSessionKey: 'provider_cooldown' };
		}

		// 3. Preprocessing: filter + dedup + smart collapse + truncate
		let clean = this.preprocess(messages);
		if (clean.length < this.threshold) {
			return { compressed: false };
		}

		// 3b. Phase 4: sanitize tool_call/tool_result pairs
		// Prevents orphan tool results or missing tool responses from
		// corrupting the compressed conversation.
		clean = this.sanitizeToolPairs(clean);
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

		// 5. Summarize middle via Cloudflare Workers AI
		const summary = await this.summarize(middle);

		// 5b. Anti-thrashing: if two consecutive compressions saved <10%, stop
		const middleTokenCount = middle.reduce((sum, m) => sum + m.content.length, 0);
		const savings = middleTokenCount > 0 ? (middleTokenCount - summary.length) / middleTokenCount : 0;

		const history = compressionSavings.get(sessionId) ?? [];
		history.push(savings);
		if (history.length > 2) history.shift();
		compressionSavings.set(sessionId, history);

		if (history.length === 2 && history.every((s) => s < 0.1)) {
			return { compressed: false, newSessionKey: 'anti_thrashing' };
		}

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
		// Phase 1a: filter system messages and truly empty messages
		// IMPORTANT: preserve assistant messages with tool_calls even if content is empty,
		// otherwise we orphan the corresponding tool results below them.
		const filtered = messages.filter((m) => {
			if (m.role === 'system') return false;
			// Assistant with tool_calls: keep even if content is empty
			if (m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0) return true;
			// Tool messages: keep
			if (m.role === 'tool') return true;
			// User messages: keep only if they have content
			if (!m.content || m.content.trim().length === 0) return false;
			return true;
		});

		// Phase 1b: MD5 dedup — same tool result repeated → keep only most recent
		const seenToolResults = new Map<string, number>();
		for (let i = filtered.length - 1; i >= 0; i--) {
			const m = filtered[i];
			if (m.role === 'tool' && m.content) {
				const hash = this.simpleHash(m.content);
				if (seenToolResults.has(hash)) {
					filtered.splice(i, 1);
				} else {
					seenToolResults.set(hash, i);
				}
			}
		}

		// Phase 1c: Smart Collapse — long tool outputs → 1-line summary
		for (let i = 0; i < filtered.length; i++) {
			const m = filtered[i];
			if (m.role === 'tool' && m.content.length > 200) {
				const lines = m.content.split('\n');
				const firstLine = lines[0].slice(0, 100);
				filtered[i] = { ...m, content: `[tool result] ${firstLine}... (${lines.length} lines)` };
			}
		}

		// Phase 1d: Truncate tool_call params > 500 chars
		for (let i = 0; i < filtered.length; i++) {
			const m = filtered[i];
			if (m.tool_calls) {
				filtered[i] = {
					...m,
					tool_calls: m.tool_calls.map((tc) => ({
						...tc,
						function: {
							...tc.function,
							arguments:
								tc.function.arguments.length > 500
									? `${tc.function.arguments.slice(0, 200)}...[truncated]`
									: tc.function.arguments,
						},
					})),
				};
			}
		}

		return filtered;
	}

	/**
	 * Phase 4: Sanitize tool_call/tool_result pairs after preprocessing.
	 *
	 * Fault Mode 1: Tool result references a call_id whose assistant tool_call
	 * was removed (e.g. by empty-content filter). → Delete the orphan result.
	 *
	 * Fault Mode 2: Assistant has tool_calls but some results were dropped
	 * (e.g. by MD5 dedup or boundary cutting).
	 * → Insert stub "[Result from earlier conversation]".
	 *
	 * Mirrors Hermes' _sanitize_tool_pairs in context-compressor-architecture.
	 */
	private sanitizeToolPairs(messages: TranscriptEntry[]): TranscriptEntry[] {
		// Collect all tool_call IDs from assistant messages
		const assistantCallIds = new Set<string>();
		for (const m of messages) {
			if (m.role === 'assistant' && m.tool_calls) {
				for (const tc of m.tool_calls) {
					assistantCallIds.add(tc.id);
				}
			}
		}

		// Collect tool response call_ids
		const resultCallIds = new Set<string>();
		for (const m of messages) {
			if (m.role === 'tool' && m.tool_call_id) {
				if (assistantCallIds.has(m.tool_call_id)) {
					resultCallIds.add(m.tool_call_id);
				}
			}
		}

		// Filter out orphan tool results (no matching assistant tool_call)
		const filtered = messages.filter((m) => {
			if (m.role === 'tool' && m.tool_call_id) {
				return assistantCallIds.has(m.tool_call_id);
			}
			return true;
		});

		// Insert stubs for tool_calls with no matching result
		const alreadyStubbed = new Set<string>();
		const result: TranscriptEntry[] = [];
		for (const m of filtered) {
			result.push(m);
			if (m.role === 'assistant' && m.tool_calls) {
				for (const tc of m.tool_calls) {
					if (!resultCallIds.has(tc.id) && !alreadyStubbed.has(tc.id)) {
						alreadyStubbed.add(tc.id);
						result.push({
							role: 'tool',
							content: '[Result from earlier conversation]',
							tool_call_id: tc.id,
							timestamp: m.timestamp ?? new Date(),
							sequence: 0,
						});
					}
				}
			}
		}

		return result;
	}

	private simpleHash(input: string): string {
		let hash = 0;
		for (let i = 0; i < input.length; i++) {
			const char = input.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash;
		}
		return Math.abs(hash).toString(16).slice(0, 8);
	}

	private async summarize(messages: TranscriptEntry[]): Promise<string> {
		const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
		const apiToken = process.env.CLOUDFLARE_API_TOKEN;
		const model = this.opts.summarizationModel ?? SUMMARIZATION_MODEL;

		if (!accountId || !apiToken) {
			log.warn(
				'CF Workers AI not configured (CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN) — using fallback summarization',
			);
			return this.fallbackSummarize(messages);
		}

		const conversationText = messages
			.map((m) => {
				if (m.role === 'user') return `User: ${m.content}`;
				if (m.role === 'assistant') {
					if (m.tool_calls?.length) {
						const tools = m.tool_calls
							.map((tc) => `  → tool_call: ${tc.function.name}(${tc.function.arguments})`)
							.join('\n');
						return `Assistant:\n${tools}`;
					}
					return `Assistant: ${m.content}`;
				}
				if (m.role === 'tool') return `Tool result: ${m.content.slice(0, 300)}`;
				return `${m.role}: ${m.content}`;
			})
			.join('\n\n');

		try {
			const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${apiToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					messages: [
						{ role: 'system', content: ACTION_LOG_SYSTEM_PROMPT },
						{ role: 'user', content: conversationText },
					],
					stream: false,
				}),
				signal: AbortSignal.timeout(30000),
			});

			if (!response.ok) {
				log.error({ status: response.status }, 'CF Workers AI summarization failed');
				lastProviderFailureTime = Date.now();
				return this.fallbackSummarize(messages);
			}

			const data = (await response.json()) as CFSummarizeResponse;
			if (!data.success || !data.result?.response) {
				log.error({ errors: data.errors }, 'CF Workers AI summarization returned no response');
				lastProviderFailureTime = Date.now();
				return this.fallbackSummarize(messages);
			}

			return data.result.response;
		} catch (error) {
			log.error({ err: error }, 'CF Workers AI summarization error — using fallback');
			lastProviderFailureTime = Date.now();
			return this.fallbackSummarize(messages);
		}
	}

	private fallbackSummarize(messages: TranscriptEntry[]): string {
		const combined = messages.map((m) => `[${m.role}] ${m.content.slice(0, 200)}`).join('\n');
		if (combined.length > 4000) {
			return `${combined.slice(0, 4000)}\n...[truncated]`;
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
