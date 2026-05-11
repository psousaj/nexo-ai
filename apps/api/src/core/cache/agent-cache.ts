import { createHash } from 'node:crypto';
import type { HermesRuntime } from '../runtime/hermes-runtime';

interface CacheEntry {
	runtime: HermesRuntime;
	signature: string;
	lastUsed: number;
}

export class AgentCache {
	private cache = new Map<string, CacheEntry>();
	private maxSize = 128;
	private idleTtlMs = 60 * 60 * 1000; // 1 hour

	get(sessionKey: string, signature: string): HermesRuntime | null {
		const entry = this.cache.get(sessionKey);
		if (!entry) return null;
		if (Date.now() - entry.lastUsed > this.idleTtlMs) {
			this.cache.delete(sessionKey);
			return null;
		}
		if (entry.signature !== signature) {
			this.cache.delete(sessionKey);
			return null;
		}
		entry.lastUsed = Date.now();
		// Re-insert to move to end (most recently used) for LRU eviction
		this.cache.delete(sessionKey);
		this.cache.set(sessionKey, entry);
		return entry.runtime;
	}

	set(sessionKey: string, signature: string, runtime: HermesRuntime): void {
		if (this.cache.size >= this.maxSize) {
			const oldest = this.cache.entries().next().value;
			if (oldest) this.cache.delete(oldest[0]);
		}
		this.cache.set(sessionKey, { runtime, signature, lastUsed: Date.now() });
	}

	evictIdle(): void {
		const now = Date.now();
		for (const [key, entry] of this.cache.entries()) {
			if (now - entry.lastUsed > this.idleTtlMs) {
				this.cache.delete(key);
			}
		}
	}

	clear(): void {
		this.cache.clear();
	}

	static computeSignature(model: string, toolCatalogHash: string, systemPromptHash: string): string {
		return createHash('sha256').update(`${model}:${toolCatalogHash}:${systemPromptHash}`).digest('hex');
	}
}

export function hashToolCatalog(
	tools: Array<{ name: string; description: string; jsonSchema: Record<string, unknown> }>,
): string {
	const serialized = tools.map((t) => `${t.name}:${t.description}:${JSON.stringify(t.jsonSchema)}`).join('|');
	return createHash('sha256').update(serialized).digest('hex');
}

export function hashSystemPrompt(systemPrompt: string): string {
	return createHash('sha256').update(systemPrompt).digest('hex');
}
