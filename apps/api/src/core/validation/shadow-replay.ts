export interface ShadowReplayResult {
	input: { sessionKey: string; userMessage: string };
	hermesResult: { text: string; toolCalls: string[]; durationMs: number };
	legacyResult: { text: string; toolCalls: string[]; durationMs: number } | null;
	matchScore: number; // 0-1 similarity
	differences: string[];
	timestamp: Date;
}

export class ShadowReplayService {
	private results: ShadowReplayResult[] = [];
	private maxResults = 1000;

	async runShadowReplay(
		input: { sessionKey: string; userMessage: string; systemPrompt: string },
		hermesRuntime: any,
		legacyHandler: any,
	): Promise<ShadowReplayResult> {
		// Run both systems in parallel
		const [hermesResult, legacyResult] = await Promise.all([
			this.runHermes(input, hermesRuntime),
			this.runLegacy(input, legacyHandler),
		]);

		const matchScore = this.calculateMatchScore(hermesResult, legacyResult);
		const differences = this.findDifferences(hermesResult, legacyResult);

		const result: ShadowReplayResult = {
			input,
			hermesResult,
			legacyResult,
			matchScore,
			differences,
			timestamp: new Date(),
		};

		this.results.push(result);
		if (this.results.length > this.maxResults) {
			this.results.shift();
		}

		return result;
	}

	private async runHermes(input: any, runtime: any): Promise<any> {
		const start = Date.now();
		const result = await runtime.kernel.runTurn({
			sessionKey: input.sessionKey,
			userMessage: input.userMessage,
			systemPrompt: input.systemPrompt,
		});
		return {
			text: result.text,
			toolCalls: [], // Extract from result
			durationMs: Date.now() - start,
		};
	}

	private async runLegacy(input: any, handler: any): Promise<any> {
		// Placeholder: legacy handler might not exist
		// If no legacy handler, return null
		if (!handler) return null;

		const start = Date.now();
		const result = await handler(input);
		return {
			text: result.text,
			toolCalls: [],
			durationMs: Date.now() - start,
		};
	}

	private calculateMatchScore(hermes: any, legacy: any): number {
		if (!legacy) return 1; // No legacy to compare

		// Simple text similarity (can be enhanced with embeddings)
		const textSimilarity = this.textSimilarity(hermes.text, legacy.text);
		const toolMatch = JSON.stringify(hermes.toolCalls) === JSON.stringify(legacy.toolCalls);

		return (textSimilarity + (toolMatch ? 1 : 0)) / 2;
	}

	private textSimilarity(a: string, b: string): number {
		// Simple Jaccard similarity on words
		const wordsA = new Set(a.toLowerCase().split(/\s+/));
		const wordsB = new Set(b.toLowerCase().split(/\s+/));
		const intersection = new Set([...wordsA].filter((x) => wordsB.has(x)));
		const union = new Set([...wordsA, ...wordsB]);
		return intersection.size / union.size;
	}

	private findDifferences(hermes: any, legacy: any): string[] {
		if (!legacy) return [];
		const diffs: string[] = [];
		if (hermes.text !== legacy.text) diffs.push('text_mismatch');
		if (JSON.stringify(hermes.toolCalls) !== JSON.stringify(legacy.toolCalls)) {
			diffs.push('tool_calls_mismatch');
		}
		return diffs;
	}

	getStats(): {
		totalRuns: number;
		avgMatchScore: number;
		matchRateAbove95: number; // percentage
		avgHermesLatency: number;
		avgLegacyLatency: number;
	} {
		if (this.results.length === 0) {
			return { totalRuns: 0, avgMatchScore: 0, matchRateAbove95: 0, avgHermesLatency: 0, avgLegacyLatency: 0 };
		}

		const scores = this.results.map((r) => r.matchScore);
		const hermesLatencies = this.results.map((r) => r.hermesResult.durationMs);
		const legacyLatencies = this.results.filter((r) => r.legacyResult).map((r) => r.legacyResult!.durationMs);

		return {
			totalRuns: this.results.length,
			avgMatchScore: scores.reduce((a, b) => a + b, 0) / scores.length,
			matchRateAbove95: (scores.filter((s) => s >= 0.95).length / scores.length) * 100,
			avgHermesLatency: hermesLatencies.reduce((a, b) => a + b, 0) / hermesLatencies.length,
			avgLegacyLatency:
				legacyLatencies.length > 0 ? legacyLatencies.reduce((a, b) => a + b, 0) / legacyLatencies.length : 0,
		};
	}
}
