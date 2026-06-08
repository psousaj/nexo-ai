import { beforeEach, describe, expect, it } from 'vitest';
import type { HermesRuntime } from '../runtime/hermes-runtime';
import { AgentCache, hashSystemPrompt, hashToolCatalog } from './agent-cache';

function createMockRuntime(signature?: string): HermesRuntime {
	return {
		sessionRegistry: {} as any,
		memoryRegistry: {} as any,
		toolRegistry: {} as any,
		kernel: {} as any,
		contextAssembler: {} as any,
		signature,
	};
}

describe('AgentCache', () => {
	let cache: AgentCache;

	beforeEach(() => {
		cache = new AgentCache();
	});

	it('should return the same runtime instance on cache hit', () => {
		const runtime = createMockRuntime();
		cache.set('session-1', 'sig-a', runtime);
		const result = cache.get('session-1', 'sig-a');
		expect(result).toBe(runtime);
	});

	it('should return null on cache miss', () => {
		const result = cache.get('session-1', 'sig-a');
		expect(result).toBeNull();
	});

	it('should return null and evict on signature mismatch', () => {
		const runtime = createMockRuntime();
		cache.set('session-1', 'sig-a', runtime);
		const result = cache.get('session-1', 'sig-b');
		expect(result).toBeNull();
		expect(cache.get('session-1', 'sig-a')).toBeNull();
	});

	it('should evict oldest entry when maxSize is reached', () => {
		const smallCache = new AgentCache();
		(smallCache as any).maxSize = 2;

		const runtime1 = createMockRuntime();
		const runtime2 = createMockRuntime();
		const runtime3 = createMockRuntime();

		smallCache.set('session-1', 'sig-1', runtime1);
		smallCache.set('session-2', 'sig-2', runtime2);
		// Access session-1 to make it recently used
		smallCache.get('session-1', 'sig-1');
		smallCache.set('session-3', 'sig-3', runtime3);

		// session-2 should have been evicted (oldest and least recently used)
		expect(smallCache.get('session-2', 'sig-2')).toBeNull();
		expect(smallCache.get('session-1', 'sig-1')).toBe(runtime1);
		expect(smallCache.get('session-3', 'sig-3')).toBe(runtime3);
	});

	it('should evict expired entries by idle TTL', async () => {
		const ttlCache = new AgentCache();
		(ttlCache as any).idleTtlMs = 100; // 100ms TTL for testing

		const runtime = createMockRuntime();
		ttlCache.set('session-1', 'sig-a', runtime);

		expect(ttlCache.get('session-1', 'sig-a')).toBe(runtime);

		await new Promise((resolve) => setTimeout(resolve, 150));

		const result = ttlCache.get('session-1', 'sig-a');
		expect(result).toBeNull();
	});

	it('should evict idle entries via evictIdle()', async () => {
		const ttlCache = new AgentCache();
		(ttlCache as any).idleTtlMs = 100; // 100ms TTL for testing

		const runtime1 = createMockRuntime();
		const runtime2 = createMockRuntime();

		ttlCache.set('session-1', 'sig-a', runtime1);
		ttlCache.set('session-2', 'sig-b', runtime2);

		await new Promise((resolve) => setTimeout(resolve, 150));

		ttlCache.evictIdle();
		expect(ttlCache.get('session-1', 'sig-a')).toBeNull();
		expect(ttlCache.get('session-2', 'sig-b')).toBeNull();
	});

	it('should clear all entries', () => {
		const runtime = createMockRuntime();
		cache.set('session-1', 'sig-a', runtime);
		cache.clear();
		expect(cache.get('session-1', 'sig-a')).toBeNull();
	});

	it('should update lastUsed on cache hit', async () => {
		const ttlCache = new AgentCache();
		(ttlCache as any).idleTtlMs = 200;

		const runtime = createMockRuntime();
		ttlCache.set('session-1', 'sig-a', runtime);

		// Access after 100ms to refresh TTL
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(ttlCache.get('session-1', 'sig-a')).toBe(runtime);

		// Access after another 150ms — total 250ms, but TTL was refreshed
		await new Promise((resolve) => setTimeout(resolve, 150));
		expect(ttlCache.get('session-1', 'sig-a')).toBe(runtime);
	});
});

describe('hashToolCatalog', () => {
	it('should return consistent hash for same tools', () => {
		const tools = [
			{ name: 'tool1', description: 'desc1', jsonSchema: { type: 'object', properties: { a: { type: 'number' } } } },
			{ name: 'tool2', description: 'desc2', jsonSchema: { type: 'object' } },
		];
		const hash1 = hashToolCatalog(tools);
		const hash2 = hashToolCatalog(tools);
		expect(hash1).toBe(hash2);
		expect(hash1).toHaveLength(64); // sha256 hex length
	});

	it('should return different hash for different tools', () => {
		const tools1 = [{ name: 'tool1', description: 'desc1', jsonSchema: {} }];
		const tools2 = [{ name: 'tool2', description: 'desc2', jsonSchema: {} }];
		expect(hashToolCatalog(tools1)).not.toBe(hashToolCatalog(tools2));
	});

	it('should return different hash for different jsonSchema', () => {
		const tools1 = [{ name: 'tool1', description: 'desc1', jsonSchema: { a: 1 } }];
		const tools2 = [{ name: 'tool1', description: 'desc1', jsonSchema: { a: 2 } }];
		expect(hashToolCatalog(tools1)).not.toBe(hashToolCatalog(tools2));
	});
});

describe('hashSystemPrompt', () => {
	it('should return consistent hash for same prompt', () => {
		const prompt = 'You are a helpful assistant.';
		expect(hashSystemPrompt(prompt)).toBe(hashSystemPrompt(prompt));
	});

	it('should return different hash for different prompts', () => {
		expect(hashSystemPrompt('prompt a')).not.toBe(hashSystemPrompt('prompt b'));
	});
});

describe('AgentCache.computeSignature', () => {
	it('should compute deterministic signature', () => {
		const sig1 = AgentCache.computeSignature('gpt-4o-mini', 'hash1', 'hash2');
		const sig2 = AgentCache.computeSignature('gpt-4o-mini', 'hash1', 'hash2');
		expect(sig1).toBe(sig2);
		expect(sig1).toHaveLength(64);
	});

	it('should return different signatures for different inputs', () => {
		const sig1 = AgentCache.computeSignature('gpt-4o-mini', 'hash1', 'hash2');
		const sig2 = AgentCache.computeSignature('gpt-4o-mini', 'hash1', 'hash3');
		expect(sig1).not.toBe(sig2);
	});

	it('should return different signatures for different models', () => {
		const sig1 = AgentCache.computeSignature('gpt-4o-mini', 'hash1', 'hash2');
		const sig2 = AgentCache.computeSignature('gpt-4o', 'hash1', 'hash2');
		expect(sig1).not.toBe(sig2);
	});
});
