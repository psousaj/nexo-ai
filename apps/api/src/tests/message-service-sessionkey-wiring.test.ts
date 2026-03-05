import type { IncomingMessage, MessagingProvider } from '@/adapters/messaging';
import { ERROR_MESSAGES } from '@/config/prompts';
import { processMessage } from '@/services/message-service';
import { agentOrchestrator } from '@/services/agent-orchestrator';
import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('@langfuse/tracing', () => ({
	startObservation: vi.fn(() => ({
		update: vi.fn().mockReturnThis(),
		end: vi.fn(),
	})),
}));

vi.mock('@nexo/otel/tracing', () => ({
	startSpan: vi.fn(async (_name: string, fn: () => Promise<unknown>) => await fn()),
	setAttributes: vi.fn(),
	recordException: vi.fn(),
}));

vi.mock('@sentry/node', () => ({
	startSpan: vi.fn(async (_opts: unknown, fn: () => Promise<unknown>) => await fn()),
	captureException: vi.fn(),
}));

vi.mock('@/services/agent-orchestrator', () => ({
	agentOrchestrator: {
		processMessage: vi.fn().mockResolvedValue({
			message: 'ok',
			state: 'idle',
		}),
	},
}));

vi.mock('@/services/command-handler.service', () => ({
	commandHandlerService: {
		handleCommand: vi.fn().mockResolvedValue(false),
	},
}));

vi.mock('@/services/message-analysis/message-analyzer.service', () => ({
	messageAnalyzer: {
		analyzeSentiment: vi.fn().mockResolvedValue({ score: 0, sentiment: 'neutral' }),
	},
}));

vi.mock('@/services/user-service', () => ({
	userService: {
		getUserById: vi.fn().mockResolvedValue(null),
		findOrCreateUserByAccount: vi.fn().mockResolvedValue({ user: { id: 'user-1', status: 'active', name: 'User' } }),
		updateUserName: vi.fn().mockResolvedValue(undefined),
	},
}));

vi.mock('@/services/conversation-service', () => ({
	conversationService: {
		findOrCreateConversation: vi.fn().mockResolvedValue({ id: 'conv-1', state: 'idle' }),
	},
}));

vi.mock('@/services/onboarding-service', () => ({
	onboardingService: {
		checkOnboardingStatus: vi.fn().mockResolvedValue({ allowed: true }),
		incrementInteractionCount: vi.fn().mockResolvedValue(undefined),
	},
}));

vi.mock('@/services/queue-service', () => ({
	cancelConversationClose: vi.fn().mockResolvedValue(undefined),
}));

function makeIncoming(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
	return {
		messageId: 'msg-1',
		externalId: 'external-1',
		text: 'hello',
		timestamp: new Date(),
		provider: 'telegram',
		metadata: {
			isGroupMessage: false,
			messageType: 'text',
		},
		...overrides,
	};
}

function makeProvider(): MessagingProvider {
	return {
		getProviderName: () => 'telegram',
		parseIncomingMessage: () => null,
		verifyWebhook: () => true,
		sendMessage: vi.fn().mockResolvedValue(undefined),
		sendChatAction: vi.fn().mockResolvedValue(undefined),
		markAsRead: vi.fn().mockResolvedValue(undefined),
		registerCommand: vi.fn(),
		handleCommand: vi.fn().mockResolvedValue(undefined),
	};
}

describe('message-service sessionKey wiring', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(agentOrchestrator.processMessage).mockResolvedValue({
			message: 'ok',
			state: 'idle',
		});
	});

	test('forwards provided metadata.sessionKey to agent context', async () => {
		const provider = makeProvider();
		const incoming = makeIncoming({
			metadata: {
				isGroupMessage: false,
				messageType: 'text',
				sessionKey: 'agent:main:telegram:direct:user-meta',
			},
		});

		await processMessage(incoming, provider);

		expect(agentOrchestrator.processMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				sessionKey: 'agent:main:telegram:direct:user-meta',
			}),
		);
	});

	test('builds and forwards fallback direct sessionKey when metadata is absent', async () => {
		const provider = makeProvider();
		const incoming = makeIncoming({
			userId: 'user-42',
			metadata: {
				isGroupMessage: false,
				messageType: 'text',
			},
		});

		await processMessage(incoming, provider);

		expect(agentOrchestrator.processMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				sessionKey: 'agent:main:telegram:direct:user-42',
			}),
		);
	});

	test('builds and forwards fallback group sessionKey for group messages', async () => {
		const provider = makeProvider();
		const incoming = makeIncoming({
			externalId: '-100fallback',
			metadata: {
				isGroupMessage: true,
				groupId: '-100group',
				messageType: 'text',
			},
		});

		await processMessage(incoming, provider);

		expect(agentOrchestrator.processMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				sessionKey: 'agent:main:telegram:group:-100group',
			}),
		);
	});

	test('uses discord channel externalId for group fallback wiring', async () => {
		const provider = { ...makeProvider(), getProviderName: () => 'discord' as const };
		const incoming = makeIncoming({
			provider: 'discord',
			externalId: 'channel-42',
			metadata: {
				isGroupMessage: true,
				groupId: 'guild-42',
				messageType: 'text',
			},
		});

		await processMessage(incoming, provider);

		expect(agentOrchestrator.processMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				sessionKey: 'agent:main:discord:group:channel-42',
			}),
		);
	});

	test('does not notify user when LLM contract fails in non-final attempt', async () => {
		const provider = makeProvider();
		const incoming = makeIncoming();
		const contractError = new Error('Resposta não é JSON: plain text output');

		vi.mocked(agentOrchestrator.processMessage).mockRejectedValue(contractError);

		await expect(
			processMessage(incoming, provider, {
				shouldNotifyUserOnProcessingError: false,
			}),
		).rejects.toThrow('Resposta não é JSON');

		expect(provider.sendMessage).not.toHaveBeenCalled();
	});

	test('notifies user with generic error when LLM contract fails in final attempt', async () => {
		const provider = makeProvider();
		const incoming = makeIncoming();
		const contractError = new Error('Resposta não é JSON: plain text output');

		vi.mocked(agentOrchestrator.processMessage).mockRejectedValue(contractError);

		await expect(processMessage(incoming, provider)).rejects.toThrow('Resposta não é JSON');

		expect(provider.sendMessage).toHaveBeenCalledTimes(1);
		expect(provider.sendMessage).toHaveBeenCalledWith(
			incoming.externalId,
			expect.stringMatching(new RegExp(ERROR_MESSAGES.map((message) => message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'))),
		);
	});
});
