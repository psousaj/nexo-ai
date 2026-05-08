export interface ModelTurnOutput {
	type: 'tool' | 'respond';
	toolName?: string;
	input?: Record<string, unknown>;
	text?: string;
}

export interface ModelTurnRunner {
	next(context: unknown): Promise<ModelTurnOutput>;
}
