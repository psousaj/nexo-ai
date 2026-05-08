export interface ObservationEnvelope {
	observationId: string;
	turnId: string;
	sourceTool: string;
	status: 'success' | 'error' | 'blocked';
	structuredOutput: unknown;
	confidence: number | null;
	observedAt: string;
}
