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

import { promises as fs } from 'node:fs';
import type { IncomingMessage } from '@/adapters/messaging';
import { env } from '@/config/env';
import { db } from '@/db';
import { messages } from '@/db/schema';
import { captureException } from '@/sentry';
import { messageQueue } from '@/services/queue-service';
import { loggers } from '@/utils/logger';
import {
	type ConnectionState,
	DisconnectReason,
	type WAMessage,
	type WAMessageKey,
	type WASocket,
	fetchLatestBaileysVersion,
	makeWASocket,
	useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import { and, desc, eq, inArray } from 'drizzle-orm';

const logger = loggers.baileys;

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
	private cachedVersion: [number, number, number] | undefined;
	private lastVersionFetch = 0;
	private socketGeneration = 0;
	private connectionState: ConnectionState = { connection: 'close' };
	private config: Required<BaileysConfig>;
	private messageHandlers: Array<(message: WAMessage) => void> = [];
	private isConnecting = false;
	private latestQRCode: string | null = null; // Armazena o QR Code mais recente
	private qrCodeTimestamp = 0; // Timestamp de quando o QR foi gerado
	private connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error' = 'disconnected';
	private connectionError: string | null = null;
	private recoveryInProgress = false;
	private recoveryAttempts = 0;
	private readonly MAX_RECOVERY_ATTEMPTS = 3;
	private readonly VERSION_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

	private parseJid(jid?: string): {
		raw: string;
		identifier: string;
		server: string;
		isGroup: boolean;
		isBroadcast: boolean;
		isLid: boolean;
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
			isBroadcast: normalizedServer === 'broadcast',
			isLid: normalizedServer === 'lid',
			isPn: normalizedServer === 's.whatsapp.net',
		};
	}

	private normalizeRecipientJid(recipient: string): string {
		if (recipient.includes('@')) {
			return recipient;
		}

		const cleaned = recipient.replace(/\D/g, '');
		if (cleaned.length > 0) {
			return `${cleaned}@s.whatsapp.net`;
		}

		return recipient;
	}

	private async getMessageFromDatabase(key: WAMessageKey) {
		if (!key?.id) return undefined;

		const candidateJids = [key.remoteJid, key.remoteJidAlt].filter((value): value is string => !!value);

		const baseWhere = and(eq(messages.provider, 'whatsapp'), eq(messages.providerMessageId, key.id));

		const query = db
			.select({ providerPayload: messages.providerPayload })
			.from(messages)
			.orderBy(desc(messages.createdAt))
			.limit(1);

		const [row] =
			candidateJids.length > 0
				? await query.where(and(baseWhere, inArray(messages.externalId, candidateJids)))
				: await query.where(baseWhere);

		const payload = row?.providerPayload as { message?: unknown } | undefined;
		if (payload?.message) {
			return payload.message as any;
		}

		return undefined;
	}

	constructor(config: BaileysConfig = {}) {
		this.config = {
			authPath: config.authPath || env.BAILEYS_AUTH_PATH,
			printQRInTerminal: config.printQRInTerminal !== false,
			usePairingCode: config.usePairingCode || false,
			phoneNumber: config.phoneNumber || '',
		};
	}

	private parseVersionFromEnv(value?: string): [number, number, number] | undefined {
		if (!value) return undefined;
		const parts = value
			.split(/[.,]/)
			.map((v) => Number.parseInt(v.trim(), 10))
			.filter((v) => Number.isFinite(v));

		if (parts.length !== 3) return undefined;
		return [parts[0], parts[1], parts[2]];
	}

	private async getSocketVersion(): Promise<[number, number, number]> {
		const envVersion = this.parseVersionFromEnv(process.env.BAILEYS_SOCKET_VERSION);
		if (envVersion) {
			logger.info({ version: envVersion.join('.') }, '📌 Usando BAILEYS_SOCKET_VERSION do ambiente');
			return envVersion;
		}

		const now = Date.now();
		if (this.cachedVersion && now - this.lastVersionFetch < this.VERSION_CACHE_TTL_MS) {
			return this.cachedVersion;
		}

		try {
			const { version, isLatest } = await fetchLatestBaileysVersion();
			if (isLatest && version?.length === 3) {
				this.cachedVersion = [version[0], version[1], version[2]];
				this.lastVersionFetch = now;
				logger.info({ version: this.cachedVersion.join('.') }, '✅ Versão Baileys atualizada dinamicamente');
				return this.cachedVersion;
			}
		} catch (error) {
			logger.warn({ err: error }, '⚠️ Falha ao buscar versão dinâmica do Baileys');
		}

		// Fallback seguro (pode ser atualizado sem release via env BAILEYS_SOCKET_VERSION)
		const fallback: [number, number, number] = this.cachedVersion || [2, 3000, 1034074495];
		this.cachedVersion = fallback;
		this.lastVersionFetch = now;
		logger.warn({ version: fallback.join('.') }, '⚠️ Usando versão fallback do Baileys');
		return fallback;
	}

	/**
	 * Conectar ao WhatsApp
	 */
	async connect(): Promise<void> {
		if (this.isConnecting) {
			logger.warn('Baileys já está em processo de conexão, aguardando...');
			await this.waitForOpenConnection(30000);
			if (this.connectionState.connection !== 'open') {
				throw new Error(this.connectionError || 'BaileysConnectTimeout: conexão não abriu em 30s');
			}
			return;
		}

		// Se já existe socket conectado, não reconectar
		if (this.sock && this.connectionState.connection === 'open') {
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
			const generation = ++this.socketGeneration;
			const socketVersion = await this.getSocketVersion();

			// Autenticação com arquivos locais
			const { state, saveCreds } = await useMultiFileAuthState(this.config.authPath);

			// Criar socket com configurações mais robustas
			const socket = makeWASocket({
				auth: state,
				printQRInTerminal: false,
				defaultQueryTimeoutMs: undefined,
				version: socketVersion,
				getMessage: async (key) => {
					try {
						return await this.getMessageFromDatabase(key);
					} catch (error) {
						logger.warn({ err: error, key }, '⚠️ Falha ao resolver getMessage no banco');
						return undefined;
					}
				},
				// Configurações para melhorar estabilidade
				syncFullHistory: false, // Não sincronizar todo histórico (evita timeout)
				browser: ['Nexo AI', 'Chrome', '120.0.0'], // Identificação do cliente
				markOnlineOnConnect: false, // Mantém notificações no app WhatsApp
				generateHighQualityLinkPreview: false, // Desabilitar preview de links pesado
				patchMessageBeforeSending: (message) => {
					// Remover extended text message desnecessário
					const requiresPatch = !!(message.buttonsMessage || message.listMessage || message.templateMessage);
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
			this.sock = socket;

			// Salvar credenciais quando atualizadas
			socket.ev.on('creds.update', saveCreds);

			// Gerenciar eventos de conexão
			socket.ev.on('connection.update', (update) => {
				if (generation !== this.socketGeneration || this.sock !== socket) {
					return;
				}
				// Capturar QR Code e atualizar timestamp
				if (update.qr) {
					this.latestQRCode = update.qr;
					this.qrCodeTimestamp = Date.now();
					logger.info('📱 QR Code recebido do Baileys');
				}
				this.handleConnectionUpdate(update, socket, generation);
			});

			// Receber mensagens
			socket.ev.on('messages.upsert', ({ messages, type }) => {
				if (type === 'notify') {
					for (const msg of messages) {
						this.handleMessage(msg);
					}
				}
			});

			logger.info('✅ Socket Baileys criado, aguardando conexão...');

			// Aguarda a conexão abrir — erro real sobe ao invés de throw customizado
			await this.waitForOpenConnection(30000);
			if (this.connectionState.connection !== 'open') {
				throw new Error(this.connectionError || 'BaileysConnectTimeout: conexão não abriu em 30s');
			}
		} catch (error) {
			const connectErr = error instanceof Error ? error : new Error(String(error));
			captureException(connectErr, {
				tags: { service: 'baileys', operation: 'connect', critical: 'true' },
				extra: { connectionStatus: this.connectionStatus },
			});
			logger.error({ err: connectErr }, '❌ BaileysConnectError: falha ao iniciar socket');
			this.isConnecting = false;
			this.connectionStatus = 'error';
			this.connectionError = connectErr.message;
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
		// connect() agora aguarda 'open' ou lança erro real
		await this.connect();

		const jid = this.formatJid(phoneNumber);
		logger.info({ recipient: phoneNumber, jid, textLength: text.length }, '📤 Enviando mensagem via Baileys');
		const sent = await this.sock!.sendMessage(jid, { text });

		logger.debug(
			{
				messageId: sent?.key?.id,
				remoteJid: sent?.key?.remoteJid,
			},
			'🧾 Mensagem enviada registrada no socket Baileys',
		);
		logger.info({ jid }, '✅ Mensagem enviada com sucesso via Baileys');
	}

	/**
	 * Enviar mensagem com botões
	 * WhatsApp não suporta inline buttons como Telegram —
	 * formata como lista numerada para seleção por resposta de texto
	 */
	async sendMessageWithButtons(
		phoneNumber: string,
		text: string,
		buttons: Array<Array<{ text: string; callback_data?: string }>>,
	): Promise<void> {
		await this.connect();
		const jid = this.formatJid(phoneNumber);
		const flatButtons = buttons.flat().filter((b) => b.text?.trim());

		if (flatButtons.length === 0) {
			await this.sock!.sendMessage(jid, { text });
			return;
		}

		const numbered = flatButtons.map((btn, i) => `${i + 1}️⃣ ${btn.text}`).join('\n');
		await this.sock!.sendMessage(jid, { text: `${text}\n\n${numbered}\n\n_Responda com o número da opção_` });
		logger.info({ jid, optionsCount: flatButtons.length }, '📝 Lista de opções enviada via Baileys');
	}

	/**
	 * Enviar foto com caption (e opções numeradas se houver botões)
	 */
	async sendPhoto(
		phoneNumber: string,
		photoUrl: string,
		caption?: string,
		buttons?: Array<Array<{ text: string; callback_data?: string }>>,
	): Promise<void> {
		await this.connect();
		const jid = this.formatJid(phoneNumber);

		let captionText = caption || '';
		const flatButtons = buttons?.flat().filter((b) => b.text?.trim()) || [];
		if (flatButtons.length > 0) {
			const numbered = flatButtons.map((btn, i) => `${i + 1}️⃣ ${btn.text}`).join('\n');
			captionText += `\n\n${numbered}\n\n_Responda com o número da opção_`;
		}

		await this.sock!.sendMessage(jid, { image: { url: photoUrl }, caption: captionText });
		logger.info({ jid, photoUrl, hasButtons: flatButtons.length > 0 }, '📸 Foto enviada via Baileys');
	}

	async sendTypingIndicator(phoneNumber: string): Promise<void> {
		if (this.connectionState.connection !== 'open' || !this.sock) return;
		const jid = this.formatJid(phoneNumber);
		try {
			await this.sock.sendPresenceUpdate('composing', jid);
			logger.debug({ jid }, '⌨️ Typing indicator enviado');
		} catch (err) {
			logger.warn({ err, jid }, 'Falha ao enviar typing indicator (não crítico)');
		}
	}

	private async waitForOpenConnection(timeoutMs: number): Promise<void> {
		const startedAt = Date.now();

		while (Date.now() - startedAt < timeoutMs) {
			if (this.connectionState.connection === 'open' && this.sock) {
				return;
			}

			await new Promise((resolve) => setTimeout(resolve, 300));
		}
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
	private handleConnectionUpdate(update: Partial<ConnectionState>, socket: WASocket, generation: number): void {
		const { connection, lastDisconnect, qr } = update;

		if (generation !== this.socketGeneration || this.sock !== socket) {
			return;
		}

		logger.info(
			{
				connection,
				hasQr: !!qr,
				hasLastDisconnect: !!lastDisconnect,
				statusCode: (lastDisconnect?.error as any)?.output?.statusCode,
			},
			'📡 Connection update received',
		);

		if (connection) {
			this.connectionState.connection = connection;
			logger.info({ connection }, '🔄 Status da conexão Baileys');

			if (connection === 'open') {
				this.connectionStatus = 'connected';
				this.connectionError = null;
				this.isConnecting = false;
				this.recoveryInProgress = false;
				this.recoveryAttempts = 0;
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

				if (generation !== this.socketGeneration || this.sock !== socket) {
					return;
				}

				logger.info(
					{
						statusCode,
						errorMessage,
						lastDisconnect,
					},
					'🔌 Conexão fechada - detalhes',
				);

				// DisconnectReason enum values
				// loggedOut: 401
				// restartRequired: 515
				// timedOut: 408
				// connectionLost: 428
				// badSession: 440

				if (statusCode === DisconnectReason.loggedOut || statusCode === 405) {
					if (this.recoveryInProgress) {
						logger.warn({ statusCode }, '⚠️ Recovery já em andamento, ignorando close duplicado');
						return;
					}

					this.recoveryAttempts++;
					if (this.recoveryAttempts > this.MAX_RECOVERY_ATTEMPTS) {
						const maxRecoveryErr = new Error(
							`BaileysMaxRecoveryError: WA rejeitando cliente após ${this.recoveryAttempts} tentativas (statusCode=${statusCode})`,
						);
						captureException(maxRecoveryErr, {
							tags: { service: 'baileys', operation: 'recovery', critical: 'true' },
							extra: { statusCode, attempts: this.recoveryAttempts, maxAttempts: this.MAX_RECOVERY_ATTEMPTS },
						});
						logger.error(
							{ err: maxRecoveryErr, statusCode, attempts: this.recoveryAttempts },
							'❌ BaileysMaxRecoveryError: máximo de tentativas atingido - reinicie o serviço',
						);
						this.connectionStatus = 'error';
						this.connectionError =
							'Falha persistente na conexão WhatsApp (servidor rejeita cliente). Reinicie o serviço.';
						this.recoveryAttempts = 0;
						return;
					}

					this.recoveryInProgress = true;
					this.connectionStatus = 'error';
					this.connectionError =
						statusCode === 405
							? 'Sessão inválida/expirada. Gerando novo QR Code...'
							: 'Desconectado (logout). Escaneie o QR Code novamente.';
					logger.warn(
						{ statusCode, attempt: this.recoveryAttempts, maxAttempts: this.MAX_RECOVERY_ATTEMPTS },
						'⚠️ Sessão inválida ou logout - limpando para novo pareamento',
					);
					// Limpar credenciais para permitir novo QR code
					this.latestQRCode = null;
					this.sock = null;
					setTimeout(() => {
						if (generation !== this.socketGeneration) {
							return;
						}

						this.clearSession()
							.then(() => {
								if (generation !== this.socketGeneration) {
									return;
								}
								logger.info('♻️ Gerando novo QR Code...');
								// recoveryInProgress permanece true até connection === 'open'
								// para bloquear novos recovery no mesmo ciclo de falha
								return this.connect();
							})
							.catch((err) => {
								this.recoveryInProgress = false;
								logger.error({ err }, '❌ Erro ao limpar sessão');
							});
					}, 2000);
				} else if (statusCode === 515) {
					// Restart required - pode acontecer após pareamento bem-sucedido
					logger.warn('⚠️ Restart necessário (515)');
					this.connectionStatus = 'connecting';
					this.connectionError = 'Reiniciando conexão...';
					this.sock = null;
					const credsPath = `${this.config.authPath}/creds.json`;
					setTimeout(async () => {
						if (generation !== this.socketGeneration) {
							return;
						}
						try {
							await fs.access(credsPath);
							logger.info('♻️ Credenciais encontradas, reconectando...');
							await this.connect();
						} catch {
							logger.warn('📂 Sem credenciais, limpando...');
							try {
								await this.clearSession();
								if (generation === this.socketGeneration) {
									await this.connect();
								}
							} catch (err) {
								logger.error(
									{ err },
									'❌ BaileysReconnectError: falha ao limpar sessão e reconectar após restart (515)',
								);
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
						if (generation !== this.socketGeneration) {
							return;
						}
						this.clearSession()
							.then(() => {
								if (generation !== this.socketGeneration) {
									return;
								}
								logger.info('♻️ Gerando novo QR Code...');
								this.connect();
							})
							.catch((err) => {
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
						if (generation !== this.socketGeneration) {
							return;
						}
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

			const remote = this.parseJid(remoteJid);
			const participant = this.parseJid(message.key.participant ?? undefined);

			// Para grupos, o userId é o remetente original
			let userId = remote.identifier;
			if (remote.isGroup && participant.raw) {
				userId = participant.identifier;
			}

			const phoneNumber = remote.isPn ? remote.identifier : participant.isPn ? participant.identifier : undefined;

			// Nome do remetente
			const senderName = message.pushName || '';

			// Timestamp
			const timestampValue =
				typeof message.messageTimestamp === 'number'
					? message.messageTimestamp
					: (message.messageTimestamp as any)?.toNumber?.() || 0;
			const timestamp = new Date(timestampValue * 1000);

			const trimmedText = text.trim();
			let callbackData: string | undefined;
			if (/^[1-9]$/.test(trimmedText)) {
				callbackData = `select_${Number.parseInt(trimmedText, 10) - 1}`;
			}

			const providerPayload = JSON.parse(
				JSON.stringify({
					key: message.key,
					message: message.message,
					messageTimestamp: message.messageTimestamp,
					pushName: message.pushName,
				}),
			) as Record<string, unknown>;

			return {
				messageId: message.key.id || '',
				externalId: remoteJid,
				userId,
				senderName,
				text,
				timestamp,
				provider: 'whatsapp',
				phoneNumber,
				callbackData,
				metadata: {
					isGroupMessage: remote.isGroup || false,
					groupId: remote.isGroup ? remoteJid : undefined,
					messageType: callbackData ? 'callback' : 'text',
					sourceApi: 'baileys',
					remoteJid,
					participantJid: message.key.participant ?? undefined,
					providerPayload,
				},
			};
		} catch (error) {
			const parseErr = error instanceof Error ? error : new Error(String(error));
			captureException(parseErr, {
				tags: { service: 'baileys', operation: 'parseMessage' },
				extra: { messageId: message.key.id },
			});
			logger.error(
				{ err: parseErr, messageId: message.key.id },
				'❌ BaileysParseError: falha ao parsear mensagem recebida',
			);
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
							providerApi: 'baileys',
						},
						{
							removeOnComplete: true,
							attempts: 3,
							backoff: { type: 'exponential', delay: 2000 },
						},
					);

					logger.info({ externalId: incomingMessage.externalId }, '📥 Mensagem Baileys enfileirada para processamento');
				}
			} catch (error) {
				const handleErr = error instanceof Error ? error : new Error(String(error));
				captureException(handleErr, {
					tags: { service: 'baileys', operation: 'handleMessage' },
					extra: { messageId: message.key.id },
				});
				logger.error(
					{ err: handleErr, messageId: message.key.id },
					'❌ BaileysHandleError: falha ao enfileirar mensagem para processamento',
				);
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
		return this.normalizeRecipientJid(phoneNumber);
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
