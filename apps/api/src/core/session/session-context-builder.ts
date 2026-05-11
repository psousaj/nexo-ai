export interface SessionSource {
	platform: string;
	chatId: string;
	chatName?: string;
	chatType: 'dm' | 'group' | 'channel' | 'thread';
	userId?: string;
	userName?: string;
	threadId?: string;
}

function simpleHash(input: string): string {
	let hash = 0;
	for (let i = 0; i < input.length; i++) {
		const char = input.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash;
	}
	return Math.abs(hash).toString(16).slice(0, 8);
}

export class SessionContextBuilder {
	build(source: SessionSource, options?: { redactPii?: boolean }): string {
		const platform = source.platform.charAt(0).toUpperCase() + source.platform.slice(1);

		let sourceDisplay: string;
		if (source.chatType === 'dm') {
			const name = options?.redactPii && source.userName ? `User-${simpleHash(source.userName)}` : source.userName;
			sourceDisplay = `DM with ${name || 'Unknown'}`;
		} else if (source.chatType === 'group') {
			const name = options?.redactPii && source.chatName ? `Group-${simpleHash(source.chatName)}` : source.chatName;
			sourceDisplay = `Group: ${name || 'Unknown'}`;
		} else {
			sourceDisplay = `${platform} (${source.chatType})`;
		}

		const userDisplay = options?.redactPii && source.userName ? `User-${simpleHash(source.userName)}` : (source.userName || 'Unknown');

		return `## Current Session Context
**Source:** ${platform} (${sourceDisplay})
**User:** ${userDisplay}
**Connected Platforms:** local, telegram: ✓
**Delivery options:**
  - "origin" → Back to this chat
  - "local" → Save to local files only`;
	}
}
