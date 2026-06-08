export interface ModelTurnOutput {
	type: 'tool' | 'respond';
	toolCalls?: Array<{
		toolName: string;
		toolCallId: string;
		input: Record<string, unknown>;
	}>;
	text?: string;
}

export interface NextOptions {
	stream?: boolean;
	onDelta?: (delta: string) => void | Promise<void>;
}

export interface ModelTurnRunner {
	next(context: unknown, options?: NextOptions): Promise<ModelTurnOutput>;
	addToolResult?(toolName: string, toolCallId: string, result: unknown): Promise<void>;
	needsAutoContinue?(): boolean;
	getMessages?(): Array<Record<string, unknown>>;
	setMessages?(messages: Array<Record<string, unknown>>): void;
	clearMessages?(): void;
}
