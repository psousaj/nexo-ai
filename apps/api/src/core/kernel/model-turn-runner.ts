export interface ModelTurnOutput {
	type: 'tool' | 'respond';
	toolName?: string;
	toolCallId?: string;
	input?: Record<string, unknown>;
	text?: string;
}

export interface ModelTurnRunner {
	next(context: unknown): Promise<ModelTurnOutput>;
	addToolResult?(toolName: string, toolCallId: string, result: unknown): Promise<void>;
	needsAutoContinue?(): boolean;
}
