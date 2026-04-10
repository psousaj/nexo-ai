import type { AdapterOutputQueueJob, MessagingProvider } from '@nexo/api-core/adapters/messaging';
import { describe, expect, test, vi } from 'vitest';
import { dispatchAdapterOutputJob } from '@/outgoing/adapter-output-dispatcher';

function makeOutgoingJob(payload: AdapterOutputQueueJob['payload'], idempotencyKey: string): AdapterOutputQueueJob {
	return {
		version: '1.0',
		eventType: 'outgoing.message.dispatch',
		channel: payload.providerName,
		eventId: `egress:${idempotencyKey}`,
		idempotencyKey,
		occurredAt: new Date('2026-04-10T12:00:00.000Z').toISOString(),
		payload,
	};
}

function makeProvider(overrides?: Partial<MessagingProvider>): MessagingProvider {
	return {
		getProviderName: () => 'telegram',
		parseIncomingMessage: () => null,
		verifyWebhook: () => true,
		sendMessage: vi.fn().mockResolvedValue(undefined),
		sendMessageWithButtons: vi.fn().mockResolvedValue(undefined),
		sendPhoto: vi.fn().mockResolvedValue(undefined),
		sendChatAction: vi.fn().mockResolvedValue(undefined),
		...overrides,
	};
}

describe('dispatchAdapterOutputJob', () => {
	test('dispatches text messages', async () => {
		const provider = makeProvider();
		const job = makeOutgoingJob(
			{
				providerName: 'telegram',
				externalId: 'chat-1',
				deliveryMethod: 'send_text',
				text: 'hello',
			},
			't1',
		);

		await dispatchAdapterOutputJob(job, async () => provider);

		expect(provider.sendMessage).toHaveBeenCalledWith('chat-1', 'hello', undefined);
	});

	test('dispatches button payload when provider supports buttons', async () => {
		const provider = makeProvider();
		const buttons = [[{ text: 'ok', callback_data: 'ok' }]];
		const job = makeOutgoingJob(
			{
				providerName: 'telegram',
				externalId: 'chat-1',
				deliveryMethod: 'send_buttons',
				text: 'choose',
				buttons,
			},
			't2',
		);

		await dispatchAdapterOutputJob(job, async () => provider);

		expect(provider.sendMessageWithButtons).toHaveBeenCalledWith('chat-1', 'choose', buttons, undefined);
	});

	test('falls back to sendMessage when buttons are unsupported', async () => {
		const provider = makeProvider({ sendMessageWithButtons: undefined });
		const job = makeOutgoingJob(
			{
				providerName: 'whatsapp',
				externalId: 'chat-2',
				deliveryMethod: 'send_buttons',
				text: 'fallback',
			},
			't3',
		);

		await dispatchAdapterOutputJob(job, async () => provider);

		expect(provider.sendMessage).toHaveBeenCalledWith('chat-2', 'fallback', undefined);
	});

	test('dispatches photo when provider supports media', async () => {
		const provider = makeProvider();
		const buttons = [[{ text: 'confirm', callback_data: 'confirm' }]];
		const job = makeOutgoingJob(
			{
				providerName: 'telegram',
				externalId: 'chat-3',
				deliveryMethod: 'send_photo',
				photoUrl: 'https://example.com/p.jpg',
				caption: 'poster',
				buttons,
			},
			't4',
		);

		await dispatchAdapterOutputJob(job, async () => provider);

		expect(provider.sendPhoto).toHaveBeenCalledWith(
			'chat-3',
			'https://example.com/p.jpg',
			'poster',
			buttons,
			undefined,
		);
	});
});
