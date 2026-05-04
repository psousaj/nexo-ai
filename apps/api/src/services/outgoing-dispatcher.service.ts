import {
	type ChatAction,
	type MessagingChannel,
	type MessagingProvider,
	type OutgoingMessageQueuePayload,
	type ProviderType,
} from '@/adapters/messaging/types';
import { env } from '@/config/env';

export interface OutgoingDispatchTarget {
	providerName: ProviderType;
	externalId: string;
	provider?: MessagingProvider;
	conversationId?: string;
	userId?: string;
	traceId?: string;
}

function isMessagingChannelValue(value: string): value is MessagingChannel {
	return value === 'whatsapp' || value === 'telegram' || value === 'discord';
}

function normalizeProviderName(value: string): MessagingChannel {
	if (!isMessagingChannelValue(value)) {
		throw new Error(`Canal inválido para despacho de saída: ${value}`);
	}
	return value;
}

function useSplitDispatch(): boolean {
	return env.PROVIDER_SPLIT;
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

async function enqueueAdapterOutput(
	payload: OutgoingMessageQueuePayload,
	target: OutgoingDispatchTarget,
): Promise<void> {
	const { queueAdapterOutput } = await import('@/services/queue-service');

	await queueAdapterOutput(payload, {
		traceId: target.traceId,
	});
}

export async function dispatchOutgoingText(
	target: OutgoingDispatchTarget,
	text: string,
	options?: Record<string, unknown>,
): Promise<void> {
	if (useSplitDispatch()) {
		await enqueueAdapterOutput(
			{
				providerName: normalizeProviderName(target.providerName),
				externalId: target.externalId,
				deliveryMethod: 'send_text',
				text,
				options,
				metadata: {
					conversationId: target.conversationId,
					userId: target.userId,
					source: 'api-core',
				},
			},
			target,
		);
		return;
	}

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
	if (useSplitDispatch()) {
		await enqueueAdapterOutput(
			{
				providerName: normalizeProviderName(target.providerName),
				externalId: target.externalId,
				deliveryMethod: 'send_buttons',
				text,
				buttons,
				options,
				metadata: {
					conversationId: target.conversationId,
					userId: target.userId,
					source: 'api-core',
				},
			},
			target,
		);
		return;
	}

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
	if (useSplitDispatch()) {
		await enqueueAdapterOutput(
			{
				providerName: normalizeProviderName(target.providerName),
				externalId: target.externalId,
				deliveryMethod: 'send_photo',
				text: caption,
				photoUrl,
				caption,
				buttons,
				options,
				metadata: {
					conversationId: target.conversationId,
					userId: target.userId,
					source: 'api-core',
				},
			},
			target,
		);
		return;
	}

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
	if (useSplitDispatch()) {
		await enqueueAdapterOutput(
			{
				providerName: normalizeProviderName(target.providerName),
				externalId: target.externalId,
				deliveryMethod: 'send_chat_action',
				chatAction: action,
				metadata: {
					conversationId: target.conversationId,
					userId: target.userId,
					source: 'api-core',
				},
			},
			target,
		);
		return;
	}

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

	if (useSplitDispatch()) {
		await enqueueAdapterOutput(
			{
				providerName: normalizeProviderName(target.providerName),
				externalId: target.externalId,
				deliveryMethod: 'send_voice',
				voiceBuffer: audioBuffer,
				voiceMimeType: resolvedMimeType,
				voiceFilename: resolvedFilename,
				metadata: {
					conversationId: target.conversationId,
					userId: target.userId,
					source: 'api-core',
				},
			},
			target,
		);
		return;
	}

	const provider = await resolveProvider(target);
	if (provider.sendVoice) {
		await provider.sendVoice(target.externalId, audioBuffer, resolvedMimeType, resolvedFilename);
		return;
	}

	await provider.sendMessage(target.externalId, '[voice message]');
}
