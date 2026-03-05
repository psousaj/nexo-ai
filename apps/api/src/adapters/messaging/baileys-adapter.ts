/**
 * Adapter para Baileys (WhatsApp não-oficial, estilo OpenClaw)
 *
 * Implementa a interface MessagingProvider usando Baileys (@whiskeysockets/baileys)
 * para conexão WebSocket direta com WhatsApp, sem passar pela API do Facebook.
 *
 * Diferenças em relação à Meta API:
 * - Não requer Facebook Business Account
 * - Conexão WebSocket persistente
 * - QR Code ou Pairing Code para autenticação
 * - Funcionalidades completas do WhatsApp (reactions, groups, media, etc)
 */

import { getBaileysService } from '@/services/baileys-service';
import {
	buildSessionKey as buildSessionKeyUtil,
	parseSessionKey as parseSessionKeyUtil,
} from '@/services/session-service';
import { loggers } from '@/utils/logger';
import type { WAMessage } from '@whiskeysockets/baileys';
import type { IncomingMessage, MessagingProvider, ProviderType, SessionKeyParams, SessionKeyParts } from './types';

const logger = loggers.baileys;

export class BaileysAdapter implements MessagingProvider {
	private service: Awaited<ReturnType<typeof getBaileysService>> | null = null;

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

	/**
	 * Inicializa o serviço Baileys
	 */
	private async getService() {
		if (!this.service) {
			this.service = await getBaileysService();
		}
		return this.service;
	}

	getProviderName(): ProviderType {
		return 'whatsapp';
	}

	/**
	 * Parse mensagem recebida do Baileys para formato padrão
	 *
	 * Formato do payload do Baileys:
	 * {
	 *   messages: [
	 *     {
	 *       key: {
	 *         remoteJid: "5511999999999@s.whatsapp.net",
	 *         fromMe: false,
	 *         id: "3EB0..."
	 *       },
	 *       message: { conversation: "Olá" },
	 *       messageTimestamp: 1234567890,
	 *       pushName: "Nome do Contato"
	 *     }
	 *   ]
	 * }
	 */
	parseIncomingMessage(payload: any): IncomingMessage | null {
		try {
			// O payload pode vir direto do evento messages.upsert
			const messages = payload.messages || (Array.isArray(payload) ? payload : []);

			if (!messages || messages.length === 0) {
				return null;
			}

			const msg: WAMessage = messages[0];

			// Ignorar mensagens enviadas por nós mesmos
			if (msg.key.fromMe) {
				return null;
			}

			// Extrair texto da mensagem
			let text = '';

			if (msg.message?.conversation) {
				text = msg.message.conversation;
			} else if (msg.message?.extendedTextMessage?.text) {
				text = msg.message.extendedTextMessage.text;
			} else if (msg.message?.imageMessage?.caption) {
				text = `[Imagem] ${msg.message.imageMessage.caption}`;
			} else if (msg.message?.videoMessage?.caption) {
				text = `[Vídeo] ${msg.message.videoMessage.caption}`;
			} else if (msg.message?.audioMessage) {
				text = '[Áudio]';
			} else if (msg.message?.documentMessage) {
				text = `[Documento] ${msg.message.documentMessage.fileName || ''}`;
			}

			// Extrair JID (Jaber ID) do remetente
			const remoteJid = msg.key.remoteJid;

			// Verificar se é mensagem de grupo
			// Formato: 5511999999999-1234567890@g.us (grupo)
			const remote = this.parseJid(remoteJid ?? undefined);
			const participant = this.parseJid(msg.key.participant ?? undefined);

			const isGroup = remote.isGroup;
			const phoneNumber = remote.isPn ? remote.identifier : participant.isPn ? participant.identifier : undefined;

			// Para grupos, o userId é o remetente original
			let userId = remote.identifier;
			if (isGroup && msg.key.participant) {
				userId = participant.identifier;
			}

			// Nome do remetente (pushName)
			const senderName = msg.pushName;

			// Timestamp
			const timestamp = new Date(Number(msg.messageTimestamp || 0) * 1000);

			// Detectar resposta numérica como seleção de botão (1-9 → select_0 ... select_8)
			// Usuário responde "1" ou "2" quando o bot envia lista numerada de candidatos
			const trimmedText = text.trim();
			let callbackData: string | undefined;
			if (/^[1-9]$/.test(trimmedText)) {
				callbackData = `select_${Number.parseInt(trimmedText, 10) - 1}`;
			}

			logger.debug(
				{
					remoteJid,
					isGroup,
					phoneNumber,
					userId,
					senderName,
					textLength: text.length,
					callbackData,
				},
				'📩 Mensagem Baileys parseada',
			);

			return {
				messageId: msg.key.id || '',
				externalId: remoteJid || '',
				userId: userId || '',
				senderName: senderName ?? undefined,
				text,
				timestamp,
				provider: 'whatsapp',
				phoneNumber,
				callbackData,
				metadata: {
					isGroupMessage: isGroup || false,
					groupId: isGroup ? (remoteJid ?? undefined) : undefined,
					messageType: callbackData ? 'callback' : 'text',
					sourceApi: 'baileys',
					remoteJid: remoteJid ?? undefined,
					participantJid: msg.key.participant ?? undefined,
				},
			};
		} catch (error) {
			logger.error({ error, payload }, '❌ Erro ao parsear mensagem Baileys');
			return null;
		}
	}

	/**
	 * Verificação de webhook - Baileys não usa webhook (WebSocket)
	 * Sempre retorna true para compatibilidade
	 */
	async verifyWebhook(_request: any): Promise<boolean> {
		// Baileys usa WebSocket, não webhook HTTP
		// Sempre retorna true para compatibilidade com a interface
		return true;
	}

	/**
	 * Enviar mensagem de texto
	 * @param recipient - JID do destinatário (ex: "5511999999999@s.whatsapp.net", "228513835667612@lid", "grupo@g.us" ou apenas "5511999999999")
	 * @param text - Conteúdo da mensagem
	 */
	async sendMessage(recipient: string, text: string, _options?: any): Promise<void> {
		const service = await this.getService();
		logger.info({ recipient, textLength: text.length }, '📤 Enviando mensagem via Baileys');
		await service.sendMessage(recipient, text);
	}

	/**
	 * Marcar mensagem como lida
	 * Baileys tem suporte a receipts
	 */
	async markAsRead(messageId: string): Promise<void> {
		const _service = await this.getService();

		// Para implementar markAsRead, precisaríamos guardar a referência
		// da mensagem original. Por ora, é um no-op.
		logger.debug({ messageId }, '📭 markAsRead (no-op para Baileys)');
	}

	/**
	 * Enviar indicador de "digitando..."
	 */
	async sendTypingIndicator(chatId: string): Promise<void> {
		const service = await this.getService();
		await service.sendTypingIndicator(chatId);
	}

	/**
	 * Enviar ação de chat
	 */
	async sendChatAction(chatId: string, action: string): Promise<void> {
		if (action === 'typing') {
			await this.sendTypingIndicator(chatId);
		}
		// Outras ações não são suportadas nativamente pelo Baileys
	}

	/**
	 * Enviar mensagem com botões
	 * Baileys suporta buttons nativos do WhatsApp
	 */
	async sendMessageWithButtons(chatId: string, text: string, buttons: any[], _options?: any): Promise<void> {
		const service = await this.getService();
		await service.sendMessageWithButtons(chatId, text, buttons);
	}

	/**
	 * Enviar foto com caption
	 */
	async sendPhoto(chatId: string, photoUrl: string, caption?: string, buttons?: any[], _options?: any): Promise<void> {
		const service = await this.getService();
		await service.sendPhoto(chatId, photoUrl, caption, buttons);
	}

	/**
	 * Responder a callback query (no-op para Baileys)
	 * WhatsApp não tem callback queries como Telegram
	 */
	async answerCallbackQuery(_callbackQueryId: string, _text?: string): Promise<void> {
		// No-op para Baileys
		logger.debug('📭 answerCallbackQuery (no-op para Baileys)');
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

/**
 * Singleton do adapter Baileys
 * Será instanciado apenas quando a API Baileys estiver ativa
 */
export let baileysAdapter: BaileysAdapter | null = null;

export function createBaileysAdapter(): BaileysAdapter {
	if (!baileysAdapter) {
		baileysAdapter = new BaileysAdapter();
		logger.info('✅ Adapter Baileys criado');
	}
	return baileysAdapter;
}

export function destroyBaileysAdapter(): void {
	baileysAdapter = null;
	logger.info('🔌 Adapter Baileys destruído');
}
