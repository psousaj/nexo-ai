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
} from '@whiskeysockets/baileys';
import { promises as fs } from 'fs';

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
		if (this.isConnecting) {
			logger.warn('Baileys já está em processo de conexão');
			return;
		}

		// Se já existe socket conectado, não reconectar
		if (this.sock && this.connectionState.connection === 'open') {
			logger.warn('Baileys já está conectado');
			return;
		}

		// Se existe socket mas não está conectado, limpar primeiro
		if (this.sock) {
			logger.info('♻️ Socket anterior detectado, limpando antes de reconectar...');
			this.sock = null;
		}

		this.isConnecting = true;
		this.connectionStatus = 'connecting';
		this.connectionError = null;

		try {
			logger.info({ authPath: this.config.authPath }, '🔄 Conectando Baileys...');

			// Autenticação com arquivos locais
			const { state, saveCreds } = await useMultiFileAuthState(this.config.authPath);

			// Criar socket com configurações mais robustas
			this.sock = makeWASocket({
				auth: state,
				printQRInTerminal: this.config.printQRInTerminal,
				defaultQueryTimeoutMs: undefined,
				// Configurações para melhorar estabilidade
				syncFullHistory: false, // Não sincronizar todo histórico (evita timeout)
				browser: ['Nexo AI', 'Chrome', '120.0.0'], // Identificação do cliente
				markOnlineOnConnect: true, // Marcar online ao conectar
				generateHighQualityLinkPreview: false, // Desabilitar preview de links pesado
				patchMessageBeforeSending: (message) => {
					// Remover extended text message desnecessário
					const requiresPatch = !!(
						message.buttonsMessage ||
						message.listMessage ||
						message.templateMessage
					);
					if (requiresPatch) {
						message = {
							viewOnceMessage: {
								message: {
									messageContextInfo: {
										deviceListMetadataVersion: 2,
										deviceListMetadata: {},
									},
									...message,
								},
							},
						};
					}
					return message;
				},
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
				// Remover event listeners antes de desconectar
				logger.info('🗑️ Removendo event listeners...');
				this.sock.ev.removeAllListeners('connection.update');
				this.sock.ev.removeAllListeners('creds.update');
				this.sock.ev.removeAllListeners('messages.upsert');
				
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

		// Formatar JID (Jaber ID) - preserva @lid, @g.us, etc
		const jid = this.formatJid(phoneNumber);

		logger.info({ recipient: phoneNumber, jid, textLength: text.length }, '📤 Enviando mensagem via Baileys');

		await this.sock.sendMessage(jid, { text });
		
		logger.info({ jid }, '✅ Mensagem enviada com sucesso via Baileys');
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
		const { connection, lastDisconnect, qr } = update;

		logger.info({ 
			connection, 
			hasQr: !!qr,
			hasLastDisconnect: !!lastDisconnect,
			statusCode: (lastDisconnect?.error as any)?.output?.statusCode 
		}, '📡 Connection update received');

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
				this.isConnecting = false;
				this.connectionStatus = 'disconnected';
				const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
				const errorMessage = (lastDisconnect?.error as any)?.message || 'Unknown';

				logger.info({ 
					statusCode, 
					errorMessage,
					lastDisconnect 
				}, '🔌 Conexão fechada - detalhes');

				// DisconnectReason enum values
				// loggedOut: 401
				// restartRequired: 515
				// timedOut: 408
				// connectionLost: 428
				// badSession: 440

				if (statusCode === DisconnectReason.loggedOut) {
					this.connectionStatus = 'error';
					this.connectionError = 'Desconectado (logout). Escaneie o QR Code novamente.';
					logger.warn('⚠️ Baileys desconectado por logout (401)');
					// Limpar credenciais para permitir novo QR code
					this.latestQRCode = null;
					this.sock = null;
				} else if (statusCode === 515) {
					// Restart required - pode acontecer após pareamento bem-sucedido
					logger.warn('⚠️ Restart necessário (515)');
					this.connectionStatus = 'connecting';
					this.connectionError = 'Reiniciando conexão...';
					this.sock = null;
					const credsPath = `${this.config.authPath}/creds.json`;
					setTimeout(async () => {
						try {
							await fs.access(credsPath);
							logger.info('♻️ Credenciais encontradas, reconectando...');
							this.connect();
						} catch {
							logger.warn('📂 Sem credenciais, limpando...');
							try {
								await this.clearSession();
								this.connect();
							} catch (err) {
								logger.error({ err }, '❌ Erro');
							}
						}
					}, 2000);
				} else if (statusCode === 440) {
					// Bad session - limpar e gerar novo QR
					logger.warn('⚠️ Sessão inválida (440) - limpando...');
					this.connectionStatus = 'error';
					this.connectionError = 'Sessão inválida. Gerando novo QR Code...';
					this.sock = null;
					this.latestQRCode = null;
					// Limpar sessão e gerar novo QR
					setTimeout(() => {
						this.clearSession().then(() => {
							logger.info('♻️ Gerando novo QR Code...');
							this.connect();
						}).catch((err) => {
							logger.error({ err }, '❌ Erro ao limpar sessão');
						});
					}, 2000);
				} else if (!statusCode || statusCode === 408 || statusCode === 428) {
					// Timeout ou connection lost - reconectar
					logger.warn(`⚠️ Conexão perdida (${statusCode}) - tentando reconectar...`);
					this.connectionError = 'Conexão perdida, tentando reconectar...';
					this.sock = null;
					// Reconectar após 3 segundos
					setTimeout(() => {
						logger.info('♻️ Tentando reconectar...');
						this.connect().catch((err) => {
							logger.error({ err }, '❌ Erro ao reconectar Baileys');
						});
					}, 3000);
				} else {
					// Outro erro desconhecido
					logger.error({ statusCode, errorMessage }, '❌ Erro desconhecido ao desconectar');
					this.connectionStatus = 'error';
					this.connectionError = `Erro ${statusCode}: ${errorMessage}`;
					this.sock = null;
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
			const timestampValue = typeof message.messageTimestamp === 'number' 
				? message.messageTimestamp 
				: (message.messageTimestamp as any)?.toNumber?.() || 0;
			const timestamp = new Date(timestampValue * 1000);

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
	 * Preserva JIDs já formatados (@lid, @g.us, @s.whatsapp.net, etc)
	 */
	private formatJid(phoneNumber: string): string {
		// Se já está formatado com @, retorna como está
		if (phoneNumber.includes('@')) {
			return phoneNumber;
		}

		// Remover caracteres não numéricos
		const cleaned = phoneNumber.replace(/\D/g, '');

		// Adicionar sufixo @s.whatsapp.net para números puros
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
