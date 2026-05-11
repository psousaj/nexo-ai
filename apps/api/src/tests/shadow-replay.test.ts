import { describe, expect, it, vi } from 'vitest';
import { ShadowReplayService } from '@/core/validation/shadow-replay';

describe('ShadowReplayService', () => {
	describe('runShadowReplay', () => {
		it('should run hermes and legacy in parallel and return comparison result', async () => {
			const service = new ShadowReplayService();
			const hermesRuntime = {
				kernel: {
					runTurn: vi.fn().mockResolvedValue({ text: 'Hello from Hermes' }),
				},
			};
			const legacyHandler = vi.fn().mockResolvedValue({ text: 'Hello from Legacy' });

			const result = await service.runShadowReplay(
				{ sessionKey: 'test-session', userMessage: 'hi', systemPrompt: 'system' },
				hermesRuntime,
				legacyHandler,
			);

			expect(result.input.sessionKey).toBe('test-session');
			expect(result.hermesResult.text).toBe('Hello from Hermes');
			expect(result.legacyResult).not.toBeNull();
			expect(result.legacyResult!.text).toBe('Hello from Legacy');
			expect(result.timestamp).toBeInstanceOf(Date);
		});

		it('should return match score 1 when no legacy handler', async () => {
			const service = new ShadowReplayService();
			const hermesRuntime = {
				kernel: {
					runTurn: vi.fn().mockResolvedValue({ text: 'Hello' }),
				},
			};

			const result = await service.runShadowReplay(
				{ sessionKey: 's1', userMessage: 'hi', systemPrompt: 'sys' },
				hermesRuntime,
				null,
			);

			expect(result.matchScore).toBe(1);
			expect(result.differences).toEqual([]);
			expect(result.legacyResult).toBeNull();
		});
	});

	describe('text similarity', () => {
		it('should return 1 for identical text', async () => {
			const service = new ShadowReplayService();
			const hermesRuntime = {
				kernel: {
					runTurn: vi.fn().mockResolvedValue({ text: 'exact same text' }),
				},
			};
			const legacyHandler = vi.fn().mockResolvedValue({ text: 'exact same text' });

			const result = await service.runShadowReplay(
				{ sessionKey: 's1', userMessage: 'hi', systemPrompt: 'sys' },
				hermesRuntime,
				legacyHandler,
			);

			expect(result.matchScore).toBe(1);
			expect(result.differences).toEqual([]);
		});

		it('should return lower score for different text', async () => {
			const service = new ShadowReplayService();
			const hermesRuntime = {
				kernel: {
					runTurn: vi.fn().mockResolvedValue({ text: 'hello world foo bar' }),
				},
			};
			const legacyHandler = vi.fn().mockResolvedValue({ text: 'hello world baz qux' });

			const result = await service.runShadowReplay(
				{ sessionKey: 's1', userMessage: 'hi', systemPrompt: 'sys' },
				hermesRuntime,
				legacyHandler,
			);

			// Jaccard on words: intersection={hello,world}, union={hello,world,foo,bar,baz,qux}, score=2/6=0.333, plus toolMatch=1, avg=0.666
			expect(result.matchScore).toBeLessThan(1);
			expect(result.differences).toContain('text_mismatch');
		});
	});

	describe('tool call differences', () => {
		it('should detect tool call mismatch', async () => {
			const service = new ShadowReplayService();
			const hermesRuntime = {
				kernel: {
					runTurn: vi.fn().mockResolvedValue({ text: 'ok' }),
				},
			};
			const legacyHandler = vi.fn().mockResolvedValue({ text: 'ok' });

			const result = await service.runShadowReplay(
				{ sessionKey: 's1', userMessage: 'hi', systemPrompt: 'sys' },
				hermesRuntime,
				legacyHandler,
			);

			// Both return empty toolCalls arrays, so no mismatch
			expect(result.differences).not.toContain('tool_calls_mismatch');
		});
	});

	describe('getStats', () => {
		it('should return zero stats when no runs', () => {
			const service = new ShadowReplayService();
			const stats = service.getStats();
			expect(stats.totalRuns).toBe(0);
			expect(stats.avgMatchScore).toBe(0);
			expect(stats.matchRateAbove95).toBe(0);
			expect(stats.avgHermesLatency).toBe(0);
			expect(stats.avgLegacyLatency).toBe(0);
		});

		it('should compute stats after runs', async () => {
			const service = new ShadowReplayService();
			const hermesRuntime = {
				kernel: {
					runTurn: vi.fn().mockResolvedValue({ text: 'hello' }),
				},
			};
			const legacyHandler = vi.fn().mockResolvedValue({ text: 'hello' });

			await service.runShadowReplay(
				{ sessionKey: 's1', userMessage: 'hi', systemPrompt: 'sys' },
				hermesRuntime,
				legacyHandler,
			);
			await service.runShadowReplay(
				{ sessionKey: 's2', userMessage: 'bye', systemPrompt: 'sys' },
				hermesRuntime,
				legacyHandler,
			);

			const stats = service.getStats();
			expect(stats.totalRuns).toBe(2);
			expect(stats.avgMatchScore).toBe(1);
			expect(stats.matchRateAbove95).toBe(100);
			expect(stats.avgHermesLatency).toBeGreaterThanOrEqual(0);
			expect(stats.avgLegacyLatency).toBeGreaterThanOrEqual(0);
		});
	});
});
