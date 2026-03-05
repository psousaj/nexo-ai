import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
	mockGetPivotFeatureFlags,
	mockGetHistory,
	mockGetUserById,
	mockCallLLM,
	mockExecuteTool,
} = vi.hoisted(() => ({
	mockGetPivotFeatureFlags: vi.fn(),
	mockGetHistory: vi.fn(),
	mockGetUserById: vi.fn(),
	mockCallLLM: vi.fn(),
	mockExecuteTool: vi.fn(),
}));

vi.mock('@/config/pivot-feature-flags', () => ({
	getPivotFeatureFlags: mockGetPivotFeatureFlags,
}));

vi.mock('@/services/conversation-service', () => ({
	conversationService: {
		getHistory: mockGetHistory,
	},
}));

vi.mock('@/services/user-service', () => ({
	userService: {
		getUserById: mockGetUserById,
	},
}));

vi.mock('@/services/ai', () => ({
	llmService: {
		callLLM: mockCallLLM,
	},
}));

vi.mock('@/services/tools', () => ({
	executeTool: mockExecuteTool,
}));

vi.mock('@/services/queue-service', () => ({
	scheduleConversationClose: vi.fn(),
}));

vi.mock('@/services/service-instrumentation', () => ({
	instrumentService: (_name: string, instance: unknown) => instance,
}));

vi.mock('@nexo/otel/tracing', () => ({
	startSpan: async (_name: string, fn: (span: unknown) => Promise<unknown>) => fn({}),
	setAttributes: vi.fn(),
}));

describe('AgentOrchestrator tool schema switch', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGetHistory.mockResolvedValue([]);
		mockGetUserById.mockResolvedValue({ assistantName: 'Nexo' });
		mockExecuteTool.mockResolvedValue({ success: true, message: 'ok' });
	});

	test('uses v1 parser path when TOOL_SCHEMA_V2 is disabled', async () => {
		mockGetPivotFeatureFlags.mockReturnValue({ TOOL_SCHEMA_V2: false });
		mockCallLLM.mockResolvedValue({
			message: JSON.stringify({
				schema_version: '1.0',
				action: 'CALL_TOOL',
				tool: 'save_note',
				args: { content: 'hello' },
			}),
		});

		const { AgentOrchestrator } = await import('@/services/agent-orchestrator');
		const orchestrator = new AgentOrchestrator();

		const response = await (orchestrator as any).handleWithLLM(
			{
				userId: 'u1',
				conversationId: 'c1',
				externalId: 'e1',
				message: 'save this',
				provider: 'telegram',
			},
			{},
			{ id: 'c1' },
		);

		expect(mockExecuteTool).toHaveBeenCalledWith(
			'save_note',
			expect.objectContaining({ userId: 'u1', conversationId: 'c1' }),
			{ content: 'hello' },
		);
		expect(response).toEqual(
			expect.objectContaining({
				message: 'ok',
				state: 'idle',
				toolsUsed: ['save_note'],
			}),
		);
	});

	test('uses AgentDecisionV2 path when TOOL_SCHEMA_V2 is enabled', async () => {
		mockGetPivotFeatureFlags.mockReturnValue({ TOOL_SCHEMA_V2: true });
		mockCallLLM.mockResolvedValue({
			message: JSON.stringify({
				schema_version: '2.0',
				action: 'CALL_TOOL',
				reasoning_intent: {
					category: 'memory_write',
					confidence: 0.91,
					trigger: 'natural_language',
				},
				tool_call: {
					name: 'save_movie',
					arguments: { title: 'Inception' },
				},
			}),
		});

		const { AgentOrchestrator } = await import('@/services/agent-orchestrator');
		const orchestrator = new AgentOrchestrator();

		const response = await (orchestrator as any).handleWithLLM(
			{
				userId: 'u1',
				conversationId: 'c1',
				externalId: 'e1',
				message: 'salva inception',
				provider: 'telegram',
			},
			{},
			{ id: 'c1' },
		);

		expect(mockExecuteTool).toHaveBeenCalledWith(
			'save_movie',
			expect.objectContaining({ userId: 'u1', conversationId: 'c1' }),
			{ title: 'Inception' },
		);
		expect(response).toEqual(
			expect.objectContaining({
				message: 'ok',
				state: 'idle',
				toolsUsed: ['save_movie'],
			}),
		);
	});

	test('does not execute tool when TOOL_SCHEMA_V2 is enabled but LLM returns v1 payload', async () => {
		mockGetPivotFeatureFlags.mockReturnValue({ TOOL_SCHEMA_V2: true });
		mockCallLLM.mockResolvedValue({
			message: JSON.stringify({
				schema_version: '1.0',
				action: 'CALL_TOOL',
				tool: 'save_note',
				args: { content: 'legacy payload' },
			}),
		});

		const { AgentOrchestrator } = await import('@/services/agent-orchestrator');
		const orchestrator = new AgentOrchestrator();

		const response = await (orchestrator as any).handleWithLLM(
			{
				userId: 'u1',
				conversationId: 'c1',
				externalId: 'e1',
				message: 'save this',
				provider: 'telegram',
			},
			{},
			{ id: 'c1' },
		);

		expect(mockExecuteTool).not.toHaveBeenCalled();
		expect(response).toEqual(
			expect.objectContaining({
				state: 'idle',
				toolsUsed: [],
			}),
		);
		expect(response.message).toContain('Desculpe');
	});
});
