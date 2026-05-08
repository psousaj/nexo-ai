export class SemanticWrapperPipeline {
	async wrap(input: {
		userId: string;
		content: string;
		sourceKind: 'intake' | 'observation' | 'derived' | 'job';
	}) {
		return {
			userId: input.userId,
			schemaVersion: 1,
			normalizedContent: input.content.trim(),
			relevanceDecay: { decayClass: 'contextual', decayScore: 1, reinforcementCount: 0 },
		};
	}
}
