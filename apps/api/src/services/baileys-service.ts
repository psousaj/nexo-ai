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
import {
	DisconnectReason,
	makeWASocket,
	useMultiFileAuthState,
	WAMessage,
	type ConnectionState,
	type WASocket,
} from '@whiskeysockets/baileys';
import { randomBytes } from 'crypto';
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
				// Capturar QR Code
				if (update.qr) {
					this.latestQRCode = update.qr;
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

			logger.info('✅ Baileys conectado com sucesso!');
			this.isConnecting = false;
		} catch (error) {
			logger.error({ error }, '❌ Erro ao conectar Baileys');
			this.isConnecting = false;
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
				logger.info('✅ Baileys conectado!');
				// Salvar número de telefone conectado
				if (this.sock?.user?.id) {
					logger.info({ phoneNumber: this.sock.user.id }, '📱 WhatsApp conectado');
				}
			}

			if (connection === 'close') {
				const shouldReconnect =
					(lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
				logger.info({ shouldReconnect, lastDisconnect }, '🔌 Conexão fechada');

				if (shouldReconnect) {
					// Reconectar após 5 segundos
					setTimeout(() => {
						this.connect().catch((err) => {
							logger.error({ err }, '❌ Erro ao reconectar Baileys');
						});
					}, 5000);
				} else {
					logger.warn('⚠️ Baileys desconectado permanentemente (logout ou ban)');
				}
			}
		}
	}

	/**
	 * Gerenciar mensagem recebida
	 */
	private handleMessage(message: WAMessage): void {
		if (!message.key.fromMe) {
			logger.info(
				{
					from: message.key.remoteJid,
					messageId: message.key.id,
					text: message.message?.conversation || '',
				},
				'📩 Mensagem recebida via Baileys',
			);

			// Notificar handlers registrados
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

export function resetBaileysService(): void {
	baileysInstance = null;
}
