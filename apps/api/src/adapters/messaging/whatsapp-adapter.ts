import { env } from '@/config/env';
import { loggers } from '@/utils/logger';
import type { IncomingMessage, MessagingProvider, ProviderType } from './types';

/**
 * Adapter para Meta WhatsApp Business API
 */
export class WhatsAppAdapter implements MessagingProvider {
	private baseUrl = 'https://graph.facebook.com/v24.0';
	private token = env.META_WHATSAPP_TOKEN;
	private phoneNumberId = env.META_WHATSAPP_PHONE_NUMBER_ID;

	getProviderName(): ProviderType {
		return 'whatsapp';
	}

	parseIncomingMessage(payload: any): IncomingMessage | null {
		const providerPayload = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;

		const entry = payload.entry?.[0];
		const changes = entry?.changes?.[0];
		const value = changes?.value;
		const message = value?.messages?.[0];

		if (!message?.text?.body) {
			return null;
		}

		// Extrai nome do contato
		const contact = value?.contacts?.[0];
		const senderName = contact?.profile?.name;

		// Phone number é o externalId no WhatsApp
		const phoneNumber = message.from;

		return {
			messageId: message.id,
			externalId: phoneNumber,
			senderName,
			text: message.text.body,
			timestamp: new Date(Number.parseInt(message.timestamp) * 1000),
			provider: 'whatsapp',
			phoneNumber, // WhatsApp sempre tem telefone
			metadata: {
				isGroupMessage: false,
				messageType: 'text',
				sourceApi: 'meta',
				providerPayload,
			},
		};
	}

	async verifyWebhook(request: any): Promise<boolean> {
		try {
			// Extrai signature do header (compatível com Fetch API, Express, e objeto simples)
			let signature: string | undefined;

			if (request.signature) {
				// Objeto simples com signature direta
				signature = request.signature;
			} else if (request.headers?.get) {
				// Fetch API / Hono
				signature = request.headers.get('X-Hub-Signature-256');
			} else if (request.headers) {
				// Express / objeto com headers
				signature = request.headers['x-hub-signature-256'];
			}

			if (!signature) {
				loggers.webhook.warn('Webhook sem signature X-Hub-Signature-256');
				return false;
			}

			// Extrai body como texto (compatível com rawBody, body string, ou body objeto)
			let bodyText: string;

			if (typeof request.rawBody === 'string') {
				bodyText = request.rawBody;
			} else if (typeof request.body === 'string') {
				bodyText = request.body;
			} else if (request.body && typeof request.body === 'object') {
				bodyText = JSON.stringify(request.body);
			} else {
				loggers.webhook.error('Body inválido para validação');
				return false;
			}

			// Valida signature usando crypto.subtle (Cloudflare Workers compatible)
			const isValid = await this.validateSignature(signature, bodyText);

			if (!isValid) {
				loggers.webhook.warn('Signature inválida no webhook WhatsApp');
			}

			return isValid;
		} catch (error) {
			loggers.webhook.error({ err: error }, 'Erro ao verificar webhook');
			return false;
		}
	}

	/**
	 * Valida HMAC SHA-256 signature do WhatsApp
	 * Usa crypto.subtle (Cloudflare Workers compatible)
	 */
	private async validateSignature(receivedSignature: string, payload: string): Promise<boolean> {
		try {
			// Remove prefixo "sha256=" se presente
			const signatureHash = receivedSignature.startsWith('sha256=') ? receivedSignature.substring(7) : receivedSignature;

			// Converte app secret para ArrayBuffer
			const encoder = new TextEncoder();
			const keyData = encoder.encode(env.META_WHATSAPP_APP_SECRET);
			const messageData = encoder.encode(payload);

			// Importa key para HMAC
			const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);

			// Calcula HMAC SHA-256
			const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);

			// Converte para hex string
			const hashArray = Array.from(new Uint8Array(signature));
			const expectedHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

			// Compara signatures (timing-safe comparison)
			return signatureHash.toLowerCase() === expectedHash.toLowerCase();
		} catch (error) {
			loggers.webhook.error({ err: error }, 'Erro ao validar signature');
			return false;
		}
	}

	async sendMessage(to: string, text: string, _options?: any): Promise<void> {
		const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;

		const payload = {
			messaging_product: 'whatsapp',
			to,
			type: 'text',
			text: { body: text },
		};

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${this.token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(payload),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`WhatsApp API error: ${error}`);
		}
	}

	/**
	 * Marca mensagem como lida (método específico WhatsApp)
	 */
	async markAsRead(messageId: string): Promise<void> {
		const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;

		const payload = {
			messaging_product: 'whatsapp',
			status: 'read',
			message_id: messageId,
		};

		await fetch(url, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${this.token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(payload),
		});
	}
}

// Só instancia se token estiver configurado
export const whatsappAdapter = env.META_WHATSAPP_TOKEN ? new WhatsAppAdapter() : null;
