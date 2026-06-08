export async function runProactiveRefresh(input: {
	envelopes: Array<{
		id: string;
		normalizedContent: string;
		relevanceDecay: { decayClass: string; decayScore: number };
	}>;
}) {
	return {
		generated: input.envelopes
			.filter((env) => env.relevanceDecay.decayClass !== 'ephemeral')
			.map((env) => ({ sourceEnvelopeId: env.id, summary: env.normalizedContent })),
	};
}
