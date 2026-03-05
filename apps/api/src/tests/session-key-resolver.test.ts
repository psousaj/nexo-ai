import type { IncomingMessage } from '@/adapters/messaging';
import { resolveSessionKey } from '@/services/session-key-resolver';
import { describe, expect, test } from 'vitest';

function makeIncomingMessage(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
	return {
		messageId: 'msg-1',
		externalId: 'external-1',
		text: 'hello',
		timestamp: new Date(),
		provider: 'telegram',
		...overrides,
	};
}

describe('resolveSessionKey', () => {
	test('uses provided metadata.sessionKey when available', () => {
		const incoming = makeIncomingMessage({
			metadata: {
				isGroupMessage: false,
				messageType: 'text',
				sessionKey: 'agent:main:telegram:direct:user-from-metadata',
			},
		});

		expect(resolveSessionKey(incoming)).toBe('agent:main:telegram:direct:user-from-metadata');
	});

	test('builds direct session key fallback without metadata.sessionKey', () => {
		const incoming = makeIncomingMessage({
			userId: 'telegram-user-42',
			metadata: {
				isGroupMessage: false,
				messageType: 'text',
			},
		});

		expect(resolveSessionKey(incoming)).toBe('agent:main:telegram:direct:telegram-user-42');
	});

	test('builds group session key fallback using metadata.groupId', () => {
		const incoming = makeIncomingMessage({
			metadata: {
				isGroupMessage: true,
				groupId: '-100123',
				messageType: 'text',
			},
		});

		expect(resolveSessionKey(incoming)).toBe('agent:main:telegram:group:-100123');
	});

	test('uses discord channel-scoped externalId for group fallback', () => {
		const baseMessage = makeIncomingMessage({
			provider: 'discord',
			metadata: {
				isGroupMessage: true,
				groupId: 'guild-1',
				messageType: 'text',
			},
		});

		const channelA = { ...baseMessage, externalId: 'channel-a' };
		const channelB = { ...baseMessage, externalId: 'channel-b' };

		expect(resolveSessionKey(channelA)).toBe('agent:main:discord:group:channel-a');
		expect(resolveSessionKey(channelB)).toBe('agent:main:discord:group:channel-b');
		expect(resolveSessionKey(channelA)).not.toBe(resolveSessionKey(channelB));
	});

	test('returns undefined when no usable peer id exists', () => {
		const incoming = makeIncomingMessage({
			externalId: '',
			userId: '',
			metadata: {
				isGroupMessage: false,
				messageType: 'text',
			},
		});

		expect(resolveSessionKey(incoming)).toBeUndefined();
	});
});
