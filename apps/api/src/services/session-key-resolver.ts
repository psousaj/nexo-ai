import type { IncomingMessage } from '@/adapters/messaging';
import { buildSessionKey } from '@/services/session-service';

export function resolveSessionKey(incomingMsg: IncomingMessage): string | undefined {
	const providedSessionKey = incomingMsg.metadata?.sessionKey?.trim();
	if (providedSessionKey) {
		return providedSessionKey;
	}

	const isGroupMessage = incomingMsg.metadata?.isGroupMessage === true;
	const peerKind = isGroupMessage ? 'group' : 'direct';
	const peerId = isGroupMessage ? incomingMsg.metadata?.groupId || incomingMsg.externalId : incomingMsg.userId || incomingMsg.externalId;

	if (!peerId) {
		return undefined;
	}

	return buildSessionKey({
		channel: incomingMsg.provider,
		peerKind,
		peerId,
	});
}
