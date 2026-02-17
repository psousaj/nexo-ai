/**
 * Baileys Service
 *
 * Gerencia a conexão WebSocket do WhatsApp usando Baileys (@whiskeysockets/baileys).
 * Baseado na implementação do OpenClaw em src/channels/whatsapp/baileys.ts
 *
 * Funcionalidades:
 * - Conexão WebSocket com WhatsApp
 * - Autenticação via QR Code ou pairing code
 * - Reconexão automática
 * - Envio e recebimento de mensagens
 */

import { loggers } from '@/utils/logger';
import { messageQueue } from '@/services/queue-service';
import type { IncomingMessage } from '@/adapters/messaging';
import {
	DisconnectReason,
	makeWASocket,
	useMultiFileAuthState,
	WAMessage,
	type ConnectionState,
	type WASocket,
	botomy,
} from '@whiskeysockets/baileys';
import { randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';
import type { ClientToDeviceMessage, proto } from '@whiskeysockets/baileys';

const logger = loggers.ai;

/**
 * Configurações do Baileys
 */
export interface BaileysConfig {
	/** Caminho para armazenar credenciais (padrão: ./baileys-auth) */
	authPath?: string;
	/** Imprimir QR Code no terminal (padrão: true) */
	printQRInTerminal?: boolean;
	/** Usar pairing code em vez de QR (número de 8 caracteres) */
	usePairingCode?: boolean;
	/** Número de telefone para pairing code (formato: 5511999999999) */
	phoneNumber?: string;
}

/**
 * Eventos de conexão do Baileys
 */
export interface BaileysConnectionEvent {
	type: 'qr' | 'connection.update' | 'creds.update' | 'messages.upsert' | 'message.update';
	data: any;
}

/**
 * Classe principal do serviço Baileys
 */
export class BaileysService {
	private sock: WASocket | null = null;
	private connectionState: ConnectionState = { connection: 'close' };
	private config: Required<BaileysConfig>;
	private messageHandlers: Array<(message: WAMessage) => void> = [];
	private isConnecting: boolean = false;
	private latestQRCode: string | null = null; // Armazena o QR Code mais recente
	private qrCodeTimestamp: number = 0; // Timestamp de quando o QR foi gerado
	private connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error' = 'disconnected';
	private connectionError: string | null = null;

	constructor(config: BaileysConfig = {}) {
		this.config = {
			authPath: config.authPath || './baileys-auth',
			printQRInTerminal: config.printQRInTerminal !== false,
			usePairingCode: config.usePairingCode || false,
			phoneNumber: config.phoneNumber || '',
		};
	}

	/**
	 * Conectar ao WhatsApp
	 */
	async connect(): Promise<void> {
		if (this.isConnecting || this.sock) {
			logger.warn('Baileys já está conectando ou conectado');
			return;
		}

		this.isConnecting = true;
		this.connectionStatus = 'connecting';
		this.connectionError = null;

		try {
			logger.info({ authPath: this.config.authPath }, '🔄 Conectando Baileys...');

			// Autenticação com arquivos locais
			const { state, saveCreds } = await useMultiFileAuthState(this.config.authPath);

			// Criar socket
			this.sock = makeWASocket({
				auth: state,
				printQRInTerminal: this.config.printQRInTerminal,
				defaultQueryTimeoutMs: undefined,
			});

			// Salvar credenciais quando atualizadas
			this.sock.ev.on('creds.update', saveCreds);

			// Gerenciar eventos de conexão
			this.sock.ev.on('connection.update', (update) => {
				// Capturar QR Code e atualizar timestamp
				if (update.qr) {
					this.latestQRCode = update.qr;
					this.qrCodeTimestamp = Date.now();
					logger.info('📱 QR Code recebido do Baileys');
				}
				this.handleConnectionUpdate(update);
			});

			// Receber mensagens
			this.sock.ev.on('messages.upsert', ({ messages, type }) => {
				if (type === 'notify') {
					for (const msg of messages) {
						this.handleMessage(msg);
					}
				}
			});

			logger.info('✅ Socket Baileys criado, aguardando conexão...');
		} catch (error) {
			logger.error({ error }, '❌ Erro ao conectar Baileys');
			this.isConnecting = false;
			this.connectionStatus = 'error';
			this.connectionError = error instanceof Error ? error.message : 'Erro desconhecido';
			throw error;
		}
	}

	/**
	 * Desconectar do WhatsApp
	 */
	async disconnect(): Promise<void> {
		if (this.sock) {
			await this.sock.logout();
			this.sock = null;
			this.connectionState = { connection: 'close' };
			logger.info('🔌 Baileys desconectado');
		}
	}

	/**
	 * Limpar sessão e arquivos de autenticação
	 * Útil quando a conexão falha ou precisa reconectar
	 */
	async clearSession(): Promise<void> {
		logger.info('🧹 Limpando sessão Baileys...');

		// Desconectar se estiver conectado
		if (this.sock) {
			try {
				await this.sock.logout();
			} catch (error) {
				logger.warn({ error }, '⚠️ Erro ao fazer logout');
			}
			this.sock = null;
		}

		// Limpar estado
		this.connectionState = { connection: 'close' };
		this.connectionStatus = 'disconnected';
		this.latestQRCode = null;
		this.qrCodeTimestamp = 0;
		this.connectionError = null;
		this.isConnecting = false;

		// Deletar arquivos de autenticação recursivamente
		try {
			const authPath = this.config.authPath;

			// Verificar se o diretório existe
			try {
				await fs.access(authPath);
			} catch {
				// Diretório não existe, nada a limpar
				logger.info('📁 Diretório de auth não existe, pulando limpeza');
				return;
			}

			// Deletar todos os arquivos recursivamente
			await fs.rm(authPath, { recursive: true, force: true });

			// Recriar diretório vazio
			await fs.mkdir(authPath, { recursive: true });

			logger.info('✅ Sessão Baileys limpa com sucesso (todos os arquivos deletados)');
		} catch (error) {
			logger.error({ error }, '❌ Erro ao limpar sessão Baileys');
			throw error;
		}
	}

	/**
	 * Reiniciar conexão com novo QR Code
	 */
	async restart(): Promise<void> {
		logger.info('🔄 Reiniciando conexão Baileys...');

		// Limpar sessão
		await this.clearSession();

		// Reset singleton para forçar nova conexão
		this.sock = null;
		this.isConnecting = false;

		// Conectar novamente
		await this.connect();

		logger.info('✅ Conexão Baileys reiniciada');
	}

	/**
	 * Enviar mensagem de texto
	 */
	async sendMessage(phoneNumber: string, text: string): Promise<void> {
		if (!this.sock || this.connectionState.connection !== 'open') {
			throw new Error('Baileys não está conectado');
		}

		// Formatar JID (Jaber ID)
		const jid = this.formatJid(phoneNumber);

		logger.info({ jid, textLength: text.length }, '📤 Enviando mensagem via Baileys');

		await this.sock.sendMessage(jid, { text });
	}

	/**
	 * Obter status da conexão
	 */
	getConnectionState(): ConnectionState {
		return this.connectionState;
	}

	/**
	 * Verificar se está conectado
	 */
	isConnected(): boolean {
		return this.connectionState.connection === 'open';
	}

	/**
	 * Obter status detalhado da conexão para o dashboard
	 */
	getConnectionStatus() {
		return {
			status: this.connectionStatus,
			phoneNumber: this.sock?.user?.id || null,
			qrCodeAge: this.latestQRCode ? Date.now() - this.qrCodeTimestamp : null,
			error: this.connectionError,
		};
	}

	/**
	 * Registrar handler para mensagens recebidas
	 */
	onMessage(handler: (message: WAMessage) => void): void {
		this.messageHandlers.push(handler);
	}

	/**
	 * Gerenciar eventos de conexão
	 */
	private handleConnectionUpdate(update: Partial<ConnectionState>): void {
		const { connection, lastDisconnect } = update;

		if (connection) {
			this.connectionState.connection = connection;
			logger.info({ connection }, '🔄 Status da conexão Baileys');

			if (connection === 'open') {
				this.connectionStatus = 'connected';
				this.connectionError = null;
				this.isConnecting = false;
				logger.info('✅ Baileys conectado!');
				// Salvar número de telefone conectado
				if (this.sock?.user?.id) {
					logger.info({ phoneNumber: this.sock.user.id }, '📱 WhatsApp conectado');
				}
			}

			if (connection === 'close') {
				this.connectionStatus = 'disconnected';
				const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
				const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

				logger.info({ shouldReconnect, statusCode, lastDisconnect }, '🔌 Conexão fechada');

				if (statusCode === DisconnectReason.loggedOut) {
					this.connectionStatus = 'error';
					this.connectionError = 'Desconectado (logout). Escaneie o QR Code novamente.';
					logger.warn('⚠️ Baileys desconectado por logout');
					// Limpar credenciais para permitir novo QR code
					this.latestQRCode = null;
				} else if (!shouldReconnect) {
					this.connectionStatus = 'error';
					this.connectionError = 'Desconectado permanentemente';
					logger.warn('⚠️ Baileys desconectado permanentemente');
				} else {
					this.connectionError = 'Conexão perdida, tentando reconectar...';
					// Reconectar após 5 segundos
					setTimeout(() => {
						this.connect().catch((err) => {
							logger.error({ err }, '❌ Erro ao reconectar Baileys');
						});
					}, 5000);
				}
			}

			if (connection === 'connecting') {
				this.connectionStatus = 'connecting';
				logger.info('🔄 Baileys está conectando...');
			}
		}
	}

	/**
	 * Parse mensagem WAMessage para formato padrão IncomingMessage
	 */
	private parseIncomingMessage(message: WAMessage): IncomingMessage | null {
		try {
			// Ignorar mensagens enviadas por nós mesmos
			if (message.key.fromMe) {
				return null;
			}

			// Extrair texto da mensagem
			let text = '';

			if (message.message?.conversation) {
				text = message.message.conversation;
			} else if (message.message?.extendedTextMessage?.text) {
				text = message.message.extendedTextMessage.text;
			} else if (message.message?.imageMessage?.caption) {
				text = `[Imagem] ${message.message.imageMessage.caption}`;
			} else if (message.message?.videoMessage?.caption) {
				text = `[Vídeo] ${message.message.videoMessage.caption}`;
			} else if (message.message?.audioMessage) {
				text = '[Áudio]';
			} else if (message.message?.documentMessage) {
				text = `[Documento] ${message.message.documentMessage.fileName || ''}`;
			}

			// Extrair JID do remetente
			const remoteJid = message.key.remoteJid;
			if (!remoteJid) {
				return null;
			}

			// Verificar se é mensagem de grupo
			const isGroup = remoteJid.includes('@g.us');
			const isBroadcast = remoteJid.includes('@broadcast');

			// Extrair número de telefone
			let phoneNumber = remoteJid.split('@')[0] || '';

			// Para grupos, o userId é o remetente original
			let userId = phoneNumber;
			if (isGroup && message.key.participant) {
				userId = message.key.participant.split('@')[0];
			}

			// Nome do remetente
			const senderName = message.pushName || '';

			// Timestamp
			const timestamp = new Date((message.messageTimestamp || 0) * 1000);

			return {
				messageId: message.key.id || '',
				externalId: remoteJid,
				userId,
				senderName,
				text,
				timestamp,
				provider: 'whatsapp',
				phoneNumber,
				metadata: {
					isGroupMessage: isGroup || false,
					groupId: isGroup ? remoteJid : undefined,
					messageType: 'text',
				},
			};
		} catch (error) {
			logger.error({ error, messageId: message.key.id }, '❌ Erro ao parsear mensagem Baileys');
			return null;
		}
	}

	/**
	 * Gerenciar mensagem recebida
	 */
	private async handleMessage(message: WAMessage): Promise<void> {
		if (!message.key.fromMe) {
			logger.info(
				{
					from: message.key.remoteJid,
					messageId: message.key.id,
					text: message.message?.conversation || '',
				},
				'📩 Mensagem recebida via Baileys',
			);

			try {
				// Parse message
				const incomingMessage = this.parseIncomingMessage(message);

				if (incomingMessage) {
					// Enfileirar para processamento assíncrono
					await messageQueue.add(
						'message-processing',
						{
							incomingMsg: incomingMessage,
							providerName: 'whatsapp',
						},
						{
							removeOnComplete: true,
							attempts: 1,
						},
					);

					logger.info({ externalId: incomingMessage.externalId }, '📥 Mensagem Baileys enfileirada para processamento');
				}
			} catch (error) {
				logger.error({ error, messageId: message.key.id }, '❌ Erro ao processar mensagem Baileys');
			}

			// Notificar handlers registrados (para backward compatibility)
			for (const handler of this.messageHandlers) {
				handler(message);
			}
		}
	}

	/**
	 * Formatar número de telefone para JID
	 */
	private formatJid(phoneNumber: string): string {
		// Remover caracteres não numéricos
		const cleaned = phoneNumber.replace(/\D/g, '');

		// Adicionar sufixo @s.whatsapp.net
		return `${cleaned}@s.whatsapp.net`;
	}

	/**
	 * Obter QR Code (string para exibir)
	 */
	async getQRCode(): Promise<string | null> {
		return this.latestQRCode;
	}

	/**
	 * Obter código de pairing (8 caracteres)
	 */
	async getPairingCode(phoneNumber: string): Promise<string> {
		if (!this.sock) {
			throw new Error('Socket não inicializado');
		}

		// Formatar número para código do país
		const formatted = this.formatJid(phoneNumber).replace('@s.whatsapp.net', '');

		// Solicitar código de pairing
		const code = await this.sock.requestPairingCode(formatted);

		logger.info({ phoneNumber, code }, '📱 Código de pairing gerado');

		return code;
	}
}

/**
 * Singleton do serviço Baileys
 */
let baileysInstance: BaileysService | null = null;

export async function getBaileysService(config?: BaileysConfig): Promise<BaileysService> {
	if (!baileysInstance) {
		baileysInstance = new BaileysService(config);
		await baileysInstance.connect();
	}
	return baileysInstance;
}

export async function resetBaileysService(): Promise<void> {
	// Desconectar e limpar a instância atual antes de resetar
	if (baileysInstance) {
		try {
			await baileysInstance.clearSession();
		} catch (error) {
			logger.warn({ error }, '⚠️ Erro ao limpar sessão durante reset');
		}
	}
	baileysInstance = null;
	logger.info('✅ Serviço Baileys resetado');
}
