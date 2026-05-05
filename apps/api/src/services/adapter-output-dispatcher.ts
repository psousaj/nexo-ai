import type { AdapterOutputQueueJob, MessagingProvider } from '@/adapters/messaging/types';

async function resolveProvider(
	providerName: AdapterOutputQueueJob['payload']['providerName'],
): Promise<MessagingProvider | null> {
	const { getProvider } = await import('@/adapters/messaging');
	return await getProvider(providerName);
}

export async function dispatchAdapterOutputJob(
	jobData: AdapterOutputQueueJob,
	providerResolver: (
		providerName: AdapterOutputQueueJob['payload']['providerName'],
	) => Promise<MessagingProvider | null> = resolveProvider,
): Promise<void> {
	const payload = jobData.payload;
	const provider = await providerResolver(payload.providerName);

	if (!provider) {
		throw new Error(`Provider ${payload.providerName} não encontrado para saída`);
	}

	switch (payload.deliveryMethod) {
		case 'send_text': {
			await provider.sendMessage(payload.externalId, payload.text ?? '', payload.options);
			return;
		}

		case 'send_buttons': {
			if (provider.sendMessageWithButtons) {
				await provider.sendMessageWithButtons(
					payload.externalId,
					payload.text ?? '',
					payload.buttons ?? [],
					payload.options,
				);
				return;
			}

			await provider.sendMessage(payload.externalId, payload.text ?? '', payload.options);
			return;
		}

		case 'send_photo': {
			if (!payload.photoUrl) {
				throw new Error('photoUrl é obrigatório para send_photo');
			}

			if (provider.sendPhoto) {
				await provider.sendPhoto(
					payload.externalId,
					payload.photoUrl,
					payload.caption,
					payload.buttons,
					payload.options,
				);
				return;
			}

			await provider.sendMessage(
				payload.externalId,
				payload.caption ?? payload.text ?? payload.photoUrl,
				payload.options,
			);
			return;
		}

		case 'send_chat_action': {
			if (provider.sendChatAction && payload.chatAction) {
				await provider.sendChatAction(payload.externalId, payload.chatAction);
			}
			return;
		}

		default: {
			const _exhaustiveCheck: never = payload.deliveryMethod;
			throw new Error(`Método de saída não suportado: ${_exhaustiveCheck}`);
		}
	}
}
