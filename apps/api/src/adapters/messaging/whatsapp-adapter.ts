import { env } from '@/config/env';
import { buildSessionKey as buildSessionKeyUtil, parseSessionKey as parseSessionKeyUtil } from '@/services/session-service';
import { loggers } from '@/utils/logger';
import type { IncomingMessage, MessagingProvider, ProviderType, SessionKeyParams, SessionKeyParts } from './types';

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

		if (!message) {
			return null;
		}

		// Extrai tipo da mensagem (Meta API sempre inclui o campo "type")
		const msgType: string = message.type || 'text';

		// Extrai texto/caption conforme tipo
		let text: string | undefined;
		if (msgType === 'text') {
			text = message.text?.body;
		} else if (msgType === 'image') {
			text = message.image?.caption ? `[Imagem] ${message.image.caption}` : '[Imagem]';
		} else if (msgType === 'video') {
			text = message.video?.caption ? `[Vídeo] ${message.video.caption}` : '[Vídeo]';
		} else if (msgType === 'audio' || msgType === 'voice') {
			text = '[Áudio]';
		} else if (msgType === 'document') {
			text = message.document?.filename ? `[Documento] ${message.document.filename}` : '[Documento]';
		} else if (msgType === 'sticker') {
			text = '[Sticker]';
		} else if (msgType === 'location') {
			text = `[Localização] ${message.location?.name || ''}`.trim();
		}

		// Ignora mensagens sem conteúdo reconhecível
		if (!text) {
			return null;
		}

		// Extrai nome do contato com fallback
		const contact = value?.contacts?.[0];
		const senderName = contact?.profile?.name || message.from || 'Usuário';

		// Phone number é o externalId no WhatsApp (Meta API é sempre 1:1, sem grupos)
		const phoneNumber = message.from as string;

		// Detectar resposta numérica como seleção de botão (1-9 → select_0 ... select_8)
		// Usuário responde "1" ou "2" quando o bot envia lista numerada de candidatos
		const trimmedText = text.trim();
		let callbackData: string | undefined;
		if (/^[1-9]$/.test(trimmedText)) {
			callbackData = `select_${Number.parseInt(trimmedText, 10) - 1}`;
		}

		return {
			messageId: message.id,
			externalId: phoneNumber,
			userId: phoneNumber, // Meta Business API é sempre 1:1, userId === externalId
			senderName,
			text,
			timestamp: new Date(Number.parseInt(message.timestamp) * 1000),
			provider: 'whatsapp',
			phoneNumber,
			callbackData,
			metadata: {
				isGroupMessage: false, // Meta Business Cloud API não suporta grupos
				messageType: callbackData ? 'callback' : 'text',
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
			const signatureHash = receivedSignature.startsWith('sha256=')
				? receivedSignature.substring(7)
				: receivedSignature;

			// Converte app secret para ArrayBuffer
			const encoder = new TextEncoder();
			const keyData = encoder.encode(env.META_WHATSAPP_APP_SECRET);
			const messageData = encoder.encode(payload);

			// Importa key para HMAC
			const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, [
				'sign',
			]);

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

	/**
	 * Indicador de digitando — Meta API não tem suporte nativo, é um no-op.
	 */
	async sendTypingIndicator(_chatId: string): Promise<void> {
		// Meta Business Cloud API não expõe typing indicator para o usuário final
	}

	/**
	 * Ação de chat — delega typing para sendTypingIndicator; demais são no-op.
	 */
	async sendChatAction(chatId: string, action: string): Promise<void> {
		if (action === 'typing') {
			await this.sendTypingIndicator(chatId);
		}
	}

	/**
	 * Envia mensagem com botões de resposta rápida (interactive/button).
	 * Máximo de 3 botões por mensagem conforme limite da Meta API.
	 */
	async sendMessageWithButtons(
		chatId: string,
		text: string,
		buttons: Array<{ text: string; callback_data?: string }>,
		_options?: any,
	): Promise<void> {
		const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;

		// Meta API aceita no máximo 3 botões do tipo "reply"
		const limitedButtons = buttons.slice(0, 3).map((btn, idx) => ({
			type: 'reply',
			reply: {
				id: btn.callback_data || `btn_${idx}`,
				title: btn.text.substring(0, 20), // limite de 20 chars no título
			},
		}));

		const payload = {
			messaging_product: 'whatsapp',
			to: chatId,
			type: 'interactive',
			interactive: {
				type: 'button',
				body: { text },
				action: { buttons: limitedButtons },
			},
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
			throw new Error(`WhatsApp API error (interactive): ${error}`);
		}
	}

	/**
	 * Constrói session key no formato OpenClaw
	 */
	buildSessionKey(params: SessionKeyParams): string {
		return buildSessionKeyUtil(params);
	}

	/**
	 * Parse session key em componentes
	 */
	parseSessionKey(key: string): SessionKeyParts {
		return parseSessionKeyUtil(key);
	}
}

// Só instancia se token estiver configurado
export const whatsappAdapter = env.META_WHATSAPP_TOKEN ? new WhatsAppAdapter() : null;
