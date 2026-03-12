import { beforeEach, describe, expect, test, vi } from 'vitest';

const { mockGetHistory, mockGetUserById, mockCallLLM, mockBuildAgentContext, mockParseAgentDecisionV2FromLLM } = vi.hoisted(() => ({
	mockGetHistory: vi.fn(),
	mockGetUserById: vi.fn(),
	mockCallLLM: vi.fn(),
	mockBuildAgentContext: vi.fn(),
	mockParseAgentDecisionV2FromLLM: vi.fn(),
}));

vi.mock('@nexo/api-core/services/queue-service', () => ({
	scheduleConversationClose: vi.fn(),
	cancelConversationClose: vi.fn(),
}));

vi.mock('@nexo/api-core/services/tool-availability.service', () => ({
	toolAvailabilityService: {
		getAvailableTools: vi.fn().mockResolvedValue({ tools: ['save_note', 'save_memo', 'search_items'] }),
	},
}));

vi.mock('@nexo/api-core/services/conversation-service', () => ({
	conversationService: {
		getHistory: mockGetHistory,
		updateState: vi.fn(),
	},
}));

vi.mock('@nexo/api-core/services/user-service', () => ({
	userService: {
		getUserById: mockGetUserById,
	},
}));

vi.mock('@nexo/api-core/services/ai', () => ({
	llmService: {
		callLLM: mockCallLLM,
	},
}));

vi.mock('@nexo/api-core/services/context-builder', () => ({
	buildAgentContext: mockBuildAgentContext,
}));

vi.mock('@nexo/api-core/services/tools', () => ({
	executeTool: vi.fn().mockResolvedValue({ success: true, message: 'ok' }),
}));

vi.mock('@nexo/api-core/utils/json-parser', () => ({
	parseAgentDecisionV2FromLLM: mockParseAgentDecisionV2FromLLM,
}));

vi.mock('@nexo/api-core/services/service-instrumentation', () => ({
	instrumentService: (_name: string, instance: unknown) => instance,
}));

vi.mock('@nexo/otel/tracing', () => ({
	startSpan: async (_name: string, fn: (span: unknown) => Promise<unknown>) => fn({}),
	setAttributes: vi.fn(),
}));

vi.mock('@nexo/api-core/config/pivot-feature-flags', () => ({
	getPivotFeatureFlags: vi.fn().mockResolvedValue({ TOOL_SCHEMA_V2: true }),
}));

describe('AgentOrchestrator context wiring', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGetHistory.mockResolvedValue([]);
		mockCallLLM.mockResolvedValue({
			message:
				'{"schema_version":"2.0","action":"RESPOND","reasoning_intent":{"category":"conversation","confidence":0.9,"trigger":"natural_language"},"response":{"text":"ok","tone_profile":"neutral"}}',
			metadata: {},
		});
		mockParseAgentDecisionV2FromLLM.mockReturnValue({
			schema_version: '2.0',
			action: 'RESPOND',
			reasoning_intent: { category: 'conversation', confidence: 0.9, trigger: 'natural_language' },
			response: { text: 'ok', tone_profile: 'neutral' },
		});
	});

	test('with sessionKey uses personalized buildAgentContext path', async () => {
		const context = {
			userId: 'user-1',
			conversationId: 'conv-1',
			externalId: 'ext-1',
			message: 'oi',
			provider: 'telegram',
			sessionKey: 'agent:main:telegram:direct:user-1',
		};

		mockBuildAgentContext.mockResolvedValue({
			systemPrompt: 'PROMPT PERSONALIZADO',
			soulContent: 'alma',
			identityContent: 'identidade',
		});

		const { AgentOrchestrator } = await import('@nexo/api-core/services/agent-orchestrator');
		const orchestrator = new AgentOrchestrator();

		const response = await (orchestrator as any).handleWithLLM(
			context,
			{ intent: 'casual_chat', action: 'greet', confidence: 0.95 },
			{ id: 'conv-1' },
		);

		expect(mockBuildAgentContext).toHaveBeenCalledWith(context.userId, context.sessionKey);
		expect(mockCallLLM).toHaveBeenCalledWith(
			expect.objectContaining({
				systemPrompt: expect.stringContaining('PROMPT PERSONALIZADO'),
			}),
		);
		expect(mockCallLLM).toHaveBeenCalledWith(
			expect.objectContaining({
				systemPrompt: expect.stringContaining('You are Nexo,'),
			}),
		);
		expect(response.message).toBe('ok');
	});

	test('without sessionKey keeps fallback system prompt path', async () => {
		const context = {
			userId: 'user-2',
			conversationId: 'conv-2',
			externalId: 'ext-2',
			message: 'oi',
			provider: 'telegram',
		};

		mockGetUserById.mockResolvedValue({
			id: context.userId,
			assistantName: 'Aurora',
		});

		const { AgentOrchestrator } = await import('@nexo/api-core/services/agent-orchestrator');
		const orchestrator = new AgentOrchestrator();

		await (orchestrator as any).handleWithLLM(context, { intent: 'casual_chat', action: 'greet', confidence: 0.95 }, { id: 'conv-2' });

		expect(mockBuildAgentContext).not.toHaveBeenCalled();
		expect(mockCallLLM).toHaveBeenCalledWith(
			expect.objectContaining({
				systemPrompt: expect.stringContaining('You are Aurora,'),
			}),
		);
	});
});
