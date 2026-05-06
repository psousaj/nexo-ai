import type {
	ChatAction,
	MessagingProvider,
	ProviderType,
} from '@/adapters/messaging/types';

export interface OutgoingDispatchTarget {
	providerName: ProviderType;
	externalId: string;
	provider?: MessagingProvider;
	conversationId?: string;
	userId?: string;
	traceId?: string;
}

async function resolveProvider(target: OutgoingDispatchTarget): Promise<MessagingProvider> {
	if (target.provider) {
		return target.provider;
	}

	const { getProvider } = await import('@/adapters/messaging');
	const provider = await getProvider(target.providerName);
	if (!provider) {
		throw new Error(`Provider ${target.providerName} não encontrado`);
	}

	return provider;
}

export async function dispatchOutgoingText(
	target: OutgoingDispatchTarget,
	text: string,
	options?: Record<string, unknown>,
): Promise<void> {
	const provider = await resolveProvider(target);
	if (typeof options === 'undefined') {
		await provider.sendMessage(target.externalId, text);
		return;
	}

	await provider.sendMessage(target.externalId, text, options);
}

export async function dispatchOutgoingButtons(
	target: OutgoingDispatchTarget,
	text: string,
	buttons: unknown[],
	options?: Record<string, unknown>,
): Promise<void> {
	const provider = await resolveProvider(target);
	if (provider.sendMessageWithButtons) {
		await provider.sendMessageWithButtons(target.externalId, text, buttons, options);
		return;
	}

	if (typeof options === 'undefined') {
		await provider.sendMessage(target.externalId, text);
		return;
	}

	await provider.sendMessage(target.externalId, text, options);
}

export async function dispatchOutgoingPhoto(
	target: OutgoingDispatchTarget,
	photoUrl: string,
	caption?: string,
	buttons?: unknown[],
	options?: Record<string, unknown>,
): Promise<void> {
	const provider = await resolveProvider(target);
	if (provider.sendPhoto) {
		await provider.sendPhoto(target.externalId, photoUrl, caption, buttons, options);
		return;
	}

	const fallbackText = caption ?? photoUrl;
	if (typeof options === 'undefined') {
		await provider.sendMessage(target.externalId, fallbackText);
		return;
	}

	await provider.sendMessage(target.externalId, fallbackText, options);
}

export async function dispatchOutgoingChatAction(target: OutgoingDispatchTarget, action: ChatAction): Promise<void> {
	const provider = await resolveProvider(target);
	if (provider.sendChatAction) {
		await provider.sendChatAction(target.externalId, action);
	}
}

export async function dispatchOutgoingVoice(
	target: OutgoingDispatchTarget,
	audioBuffer: Buffer,
	mimeType?: string,
	filename?: string,
): Promise<void> {
	const resolvedMimeType = mimeType ?? 'audio/ogg';
	const resolvedFilename = filename ?? (resolvedMimeType.includes('mpeg') ? 'voice.mp3' : 'voice.ogg');

	const provider = await resolveProvider(target);
	if (provider.sendVoice) {
		await provider.sendVoice(target.externalId, audioBuffer, resolvedMimeType, resolvedFilename);
		return;
	}

	await provider.sendMessage(target.externalId, '[voice message]');
}
