import { beforeEach, describe, expect, test, vi } from 'vitest';

const { mockGetHistory, mockGetUserById, mockBuildAgentContext, mockGenerateText, mockBuildAgentPrompt, mockBuildTools } = vi.hoisted(
	() => ({
		mockGetHistory: vi.fn(),
		mockGetUserById: vi.fn(),
		mockBuildAgentContext: vi.fn(),
		mockGenerateText: vi.fn(),
		mockBuildAgentPrompt: vi.fn(),
		mockBuildTools: vi.fn(),
	}),
);

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

vi.mock('ai', () => ({
	generateText: mockGenerateText,
}));

vi.mock('@nexo/api-core/services/ai/ai-sdk-provider', () => ({
	getModel: vi.fn().mockReturnValue('mock-model'),
}));

vi.mock('@nexo/api-core/config/prompt-builder', () => ({
	buildAgentPrompt: mockBuildAgentPrompt,
}));

vi.mock('@nexo/api-core/services/tools/ai-sdk-tools', () => ({
	buildTools: mockBuildTools,
}));

vi.mock('@nexo/api-core/services/context-builder', () => ({
	buildAgentContext: mockBuildAgentContext,
}));

vi.mock('@nexo/api-core/services/tools', () => ({
	executeTool: vi.fn().mockResolvedValue({ success: true, message: 'ok' }),
}));

vi.mock('@nexo/api-core/services/ai', () => ({
	llmService: { callLLM: vi.fn() },
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
		mockBuildTools.mockReturnValue({});
		mockBuildAgentPrompt.mockReturnValue({ system: 'You are Nexo, a personal assistant.' });
		mockGenerateText.mockResolvedValue({
			text: 'ok',
			steps: [],
			toolCalls: [],
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
			assistantName: 'Aurora',
			soulContent: 'alma',
			identityContent: 'identidade',
		});

		mockBuildAgentPrompt.mockReturnValue({ system: 'You are Aurora, a personal assistant.' });

		const { AgentOrchestrator } = await import('@nexo/api-core/services/agent-orchestrator');
		const orchestrator = new AgentOrchestrator();

		const response = await (orchestrator as any).handleWithLLM(
			context,
			{ intent: 'casual_chat', action: 'greet', confidence: 0.95 },
			{ id: 'conv-1' },
		);

		expect(mockBuildAgentContext).toHaveBeenCalledWith(context.userId, context.sessionKey);
		expect(mockBuildAgentPrompt).toHaveBeenCalledWith(expect.objectContaining({ assistantName: 'Aurora' }));
		expect(mockGenerateText).toHaveBeenCalledWith(
			expect.objectContaining({
				system: expect.stringContaining('PERSONALIZED CONTEXT'),
			}),
		);
		expect(response.message).toBe('ok');
	});

	test('without sessionKey uses fallback user assistantName', async () => {
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

		mockBuildAgentPrompt.mockReturnValue({ system: 'You are Aurora, a personal assistant.' });

		const { AgentOrchestrator } = await import('@nexo/api-core/services/agent-orchestrator');
		const orchestrator = new AgentOrchestrator();

		await (orchestrator as any).handleWithLLM(context, { intent: 'casual_chat', action: 'greet', confidence: 0.95 }, { id: 'conv-2' });

		expect(mockBuildAgentContext).not.toHaveBeenCalled();
		expect(mockBuildAgentPrompt).toHaveBeenCalledWith(expect.objectContaining({ assistantName: 'Aurora' }));
		expect(mockGenerateText).toHaveBeenCalledWith(
			expect.objectContaining({
				system: expect.stringContaining('Aurora'),
			}),
		);
	});
});
