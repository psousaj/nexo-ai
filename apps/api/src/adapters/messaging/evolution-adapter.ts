import { env } from '@/config/env';
import { evolutionService } from '@/services/evolution-service';
import {
	buildSessionKey as buildSessionKeyUtil,
	parseSessionKey as parseSessionKeyUtil,
} from '@/services/session-service';
import { loggers } from '@/utils/logger';
import type { IncomingMessage, MessagingProvider, ProviderType, SessionKeyParams, SessionKeyParts } from './types';

function flattenButtons(buttons: any[]): Array<{ text: string; callback_data?: string }> {
	const flattened = buttons.flatMap((item: any) => (Array.isArray(item) ? item : [item]));
	return flattened.filter(Boolean).map((item: any, index: number) => ({
		text: String(item.text || `Opção ${index + 1}`),
		callback_data: item.callback_data || `select_${index}`,
	}));
}

export class EvolutionAdapter implements MessagingProvider {
	getProviderName(): ProviderType {
		return 'whatsapp';
	}

	private buildDeterministicFallbackMessageId(params: {
		remoteJid?: string;
		participantJid?: string;
		messageTimestamp?: number;
		text: string;
	}): string {
		const fingerprint = [
			params.remoteJid || '',
			params.participantJid || '',
			String(params.messageTimestamp || 0),
			params.text.trim().toLowerCase(),
		].join('|');

		let hash = 0;
		for (let i = 0; i < fingerprint.length; i += 1) {
			hash = (hash * 31 + fingerprint.charCodeAt(i)) >>> 0;
		}

		return `evo-${hash.toString(16).padStart(8, '0')}`;
	}

	private parseJid(jid?: string): {
		raw: string;
		identifier: string;
		server: string;
		isGroup: boolean;
		isPn: boolean;
	} {
		const raw = jid || '';
		const [identifier = '', server = ''] = raw.split('@');
		const normalizedServer = server.toLowerCase();

		return {
			raw,
			identifier,
			server: normalizedServer,
			isGroup: normalizedServer === 'g.us',
			isPn: normalizedServer === 's.whatsapp.net',
		};
	}

	verifyWebhook(request: any): boolean {
		if (!env.EVOLUTION_WEBHOOK_SECRET) {
			loggers.webhook.warn('EVOLUTION_WEBHOOK_SECRET não configurado');
			return false;
		}

		let authorization: string | undefined;
		if (request?.headers?.get) {
			authorization = request.headers.get('authorization') || undefined;
		} else if (request?.headers && typeof request.headers === 'object') {
			authorization = request.headers.authorization || request.headers.Authorization;
		}

		if (!authorization) {
			return false;
		}

		const secret = env.EVOLUTION_WEBHOOK_SECRET;
		return authorization === secret || authorization === `Bearer ${secret}`;
	}

	parseIncomingMessage(payload: any): IncomingMessage | null {
		const event = String(payload?.event || '').toUpperCase();
		if (event && event !== 'MESSAGES_UPSERT') {
			return null;
		}

		const data = payload?.data || payload;
		const message = Array.isArray(data?.messages) ? data.messages[0] : data;
		const key = message?.key || message?.data?.key;

		if (!key || key.fromMe) {
			return null;
		}

		let text = '';
		const content = message?.message || message?.data?.message || {};

		if (content?.conversation) {
			text = content.conversation;
		} else if (content?.extendedTextMessage?.text) {
			text = content.extendedTextMessage.text;
		} else if (content?.imageMessage?.caption) {
			text = `[Imagem] ${content.imageMessage.caption}`;
		} else if (content?.videoMessage?.caption) {
			text = `[Vídeo] ${content.videoMessage.caption}`;
		} else if (content?.audioMessage) {
			text = '[Áudio]';
		} else if (content?.documentMessage?.fileName) {
			text = `[Documento] ${content.documentMessage.fileName}`;
		} else if (content?.listResponseMessage?.singleSelectReply?.selectedRowId) {
			text = content.listResponseMessage.singleSelectReply.selectedRowId;
		} else if (content?.buttonsResponseMessage?.selectedButtonId) {
			text = content.buttonsResponseMessage.selectedButtonId;
		}

		if (!text) {
			return null;
		}

		const remote = this.parseJid(key.remoteJid);
		const participant = this.parseJid(key.participant);
		const isGroup = remote.isGroup;
		const phoneNumber = remote.isPn ? remote.identifier : participant.isPn ? participant.identifier : undefined;
		const userId = isGroup && participant.identifier ? participant.identifier : remote.identifier;

		const messageTimestampRaw = Number(message?.messageTimestamp);
		const messageTimestampSeed = Number.isNaN(messageTimestampRaw) ? 0 : messageTimestampRaw;
		const timestampRaw = messageTimestampSeed > 0 ? messageTimestampSeed : Math.floor(Date.now() / 1000);
		const timestamp = Number.isNaN(timestampRaw) ? new Date() : new Date(timestampRaw * 1000);

		const trimmedText = text.trim();
		let callbackData: string | undefined;

		const fallbackMessageId = this.buildDeterministicFallbackMessageId({
			remoteJid: key.remoteJid,
			participantJid: key.participant,
			messageTimestamp: messageTimestampSeed,
			text: trimmedText,
		});
		const messageId = typeof key.id === 'string' && key.id.trim().length > 0 ? key.id : fallbackMessageId;

		if (/^[1-9]$/.test(trimmedText)) {
			callbackData = `select_${Number.parseInt(trimmedText, 10) - 1}`;
		} else if (
			trimmedText.startsWith('select_') ||
			trimmedText.startsWith('confirm_') ||
			trimmedText.startsWith('choose_')
		) {
			callbackData = trimmedText;
		}

		return {
			messageId,
			externalId: remote.raw || '',
			userId,
			senderName: message?.pushName,
			text,
			timestamp,
			provider: 'whatsapp',
			phoneNumber,
			callbackData,
			metadata: {
				isGroupMessage: isGroup,
				groupId: isGroup ? remote.raw : undefined,
				messageType: callbackData ? 'callback' : 'text',
				sourceApi: 'evolution',
				remoteJid: remote.raw,
				participantJid: key.participant,
				providerPayload: JSON.parse(JSON.stringify(payload)) as Record<string, unknown>,
			},
		};
	}

	async sendMessage(recipient: string, text: string): Promise<void> {
		await evolutionService.sendText(recipient, text);
	}

	async sendTypingIndicator(_chatId: string): Promise<void> {
		// No-op para Evolution no momento
	}

	async sendMessageWithButtons(chatId: string, text: string, buttons: any[]): Promise<void> {
		const flatButtons = flattenButtons(buttons);

		if (flatButtons.length === 0) {
			await evolutionService.sendText(chatId, text);
			return;
		}

		const values = [
			{
				title: 'Opções',
				rows: flatButtons.slice(0, 10).map((button) => ({
					title: button.text.slice(0, 24),
					description: '',
					rowId: button.callback_data || button.text,
				})),
			},
		];

		try {
			await evolutionService.sendList(chatId, {
				title: 'Escolha uma opção',
				description: text,
				buttonText: 'Ver opções',
				footerText: 'Nexo AI',
				values,
			});
		} catch (error) {
			loggers.webhook.warn(
				{ err: error },
				'Falha ao enviar lista interativa via Evolution; aplicando fallback em texto',
			);

			const fallback = `${text}\n\n${flatButtons.map((button, index) => `${index + 1}. ${button.text}`).join('\n')}`;
			await evolutionService.sendText(chatId, fallback);
		}
	}

	async sendVoice(chatId: string, audioBuffer: Buffer, mimeType?: string, filename?: string): Promise<void> {
		const base64Audio = audioBuffer.toString('base64');
		await evolutionService.sendMediaAudio(
			chatId,
			base64Audio,
			mimeType || 'audio/ogg; codecs=opus',
			filename || 'voice.ogg',
		);
	}

	async sendPhoto(chatId: string, photoUrl: string, caption?: string, buttons?: any[]): Promise<void> {
		await evolutionService.sendMediaImage(chatId, photoUrl, caption);
		if (buttons && buttons.length > 0) {
			await this.sendMessageWithButtons(chatId, caption || 'Escolha uma opção', buttons);
		}
	}

	buildSessionKey(params: SessionKeyParams): string {
		return buildSessionKeyUtil(params);
	}

	parseSessionKey(key: string): SessionKeyParts {
		return parseSessionKeyUtil(key);
	}
}

export const evolutionAdapter = new EvolutionAdapter();
