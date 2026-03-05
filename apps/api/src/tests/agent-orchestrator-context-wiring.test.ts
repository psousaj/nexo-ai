import { AGENT_SYSTEM_PROMPT } from '@/config/prompts';
import { AgentOrchestrator } from '@/services/agent-orchestrator';
import { llmService } from '@/services/ai';
import * as contextBuilder from '@/services/context-builder';
import { conversationService } from '@/services/conversation-service';
import { userService } from '@/services/user-service';
import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('@/services/queue-service', () => ({
	scheduleConversationClose: vi.fn(),
	cancelConversationClose: vi.fn(),
}));

describe('AgentOrchestrator context wiring', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	test('with sessionKey uses personalized buildAgentContext path', async () => {
		const orchestrator = new AgentOrchestrator();
		const context = {
			userId: 'user-1',
			conversationId: 'conv-1',
			externalId: 'ext-1',
			message: 'oi',
			provider: 'telegram',
			sessionKey: 'agent:main:telegram:direct:user-1',
		};

		vi.spyOn(conversationService, 'getHistory').mockResolvedValue([]);
		const buildAgentContextSpy = vi.spyOn(contextBuilder, 'buildAgentContext').mockResolvedValue({
			systemPrompt: 'PROMPT PERSONALIZADO',
			soulContent: 'alma',
			identityContent: 'identidade',
		});
		const llmCallSpy = vi.spyOn(llmService, 'callLLM').mockResolvedValue({
			message: '{"schema_version":"1.0","action":"RESPOND","message":"ok"}',
			metadata: {},
		});

		const response = await (orchestrator as any).handleWithLLM(
			context,
			{ intent: 'casual_chat', action: 'greet', confidence: 0.95 },
			{ id: 'conv-1' },
		);

		expect(buildAgentContextSpy).toHaveBeenCalledWith(context.userId, context.sessionKey);
		expect(llmCallSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				systemPrompt: expect.stringContaining('PROMPT PERSONALIZADO'),
			}),
		);
		expect(llmCallSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				systemPrompt: expect.stringContaining('You are Nexo,'),
			}),
		);
		expect(response.message).toBe('ok');
	});

	test('without sessionKey keeps fallback system prompt path', async () => {
		const orchestrator = new AgentOrchestrator();
		const context = {
			userId: 'user-2',
			conversationId: 'conv-2',
			externalId: 'ext-2',
			message: 'oi',
			provider: 'telegram',
		};
		const expectedFallbackPrompt = AGENT_SYSTEM_PROMPT.replace('You are Nexo,', 'You are Aurora,');

		vi.spyOn(conversationService, 'getHistory').mockResolvedValue([]);
		const buildAgentContextSpy = vi.spyOn(contextBuilder, 'buildAgentContext');
		vi.spyOn(userService, 'getUserById').mockResolvedValue({
			id: context.userId,
			assistantName: 'Aurora',
		} as any);
		const llmCallSpy = vi.spyOn(llmService, 'callLLM').mockResolvedValue({
			message: '{"schema_version":"1.0","action":"RESPOND","message":"ok"}',
			metadata: {},
		});

		await (orchestrator as any).handleWithLLM(
			context,
			{ intent: 'casual_chat', action: 'greet', confidence: 0.95 },
			{ id: 'conv-2' },
		);

		expect(buildAgentContextSpy).not.toHaveBeenCalled();
		expect(llmCallSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				systemPrompt: expectedFallbackPrompt,
			}),
		);
	});
});
