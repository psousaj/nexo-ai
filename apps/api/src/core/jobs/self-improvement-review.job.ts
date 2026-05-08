export async function runSelfImprovementReview(input: {
	turnId: string;
	sourceEnvelopeIds: string[];
	transcript: string;
}) {
	return {
		insightType: 'preference',
		content: input.transcript,
		derivedFrom: input.sourceEnvelopeIds,
	};
}
