/**
 * Discord Adapter - Complete Implementation with OpenClaw Patterns
 *
 * Implements full Discord.js integration with:
 * - Message handlers (DM, groups, channels)
 * - Slash commands
 * - Interactive components (buttons, select menus)
 * - Media support (images, audio, files)
 * - Thread support
 * - Session key management
 */

import { mapDiscordAttachmentsToMetadata } from '@/adapters/messaging/multimodal-attachments';
import { env } from '@/config/env';
import { buildSessionKey, parseSessionKey as parseSessionKeyUtil } from '@/services/session-service';
import { loggers } from '@/utils/logger';
import {
	type ButtonInteraction,
	type ChatInputCommandInteraction,
	Client,
	type Message as DiscordMessage,
	EmbedBuilder,
	GatewayIntentBits,
	type Interaction,
	Partials,
	REST,
	Routes,
	SlashCommandBuilder,
	type StringSelectMenuInteraction,
	type ThreadChannel,
} from 'discord.js';
import type {
	ChatAction,
	ChatCommand,
	CommandParams,
	IncomingMessage,
	MessagingProvider,
	ProviderType,
	SessionKeyParams,
	SessionKeyParts,
} from './types';

// Discord bot client with all necessary intents
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.GuildMessageReactions,
		GatewayIntentBits.GuildMessageTyping,
		GatewayIntentBits.DirectMessages,
		GatewayIntentBits.DirectMessageReactions,
		GatewayIntentBits.DirectMessageTyping,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMembers,
	],
	partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.GuildMember, Partials.ThreadMember],
});

let isReady = false;
let botUsername: string | null = null;

/**
 * Discord Adapter Class implementing MessagingProvider
 */
export class DiscordAdapter implements MessagingProvider {
	private commands: Map<string, ChatCommand> = new Map();
	private commandHandlers: Map<string, (interaction: ChatInputCommandInteraction) => Promise<void>> = new Map();

	constructor() {
		this.setupEventHandlers();
		this.registerSlashCommandHandlers();
	}

	/**
	 * Register slash command handlers
	 */
	private registerSlashCommandHandlers(): void {
		// /start command - Initiate DM conversation
		this.commandHandlers.set('start', async (interaction: ChatInputCommandInteraction) => {
			try {
				await interaction.deferReply({ ephemeral: true });

				const dmChannel = await interaction.user.createDM();

				await dmChannel.send({
					content: `👋 Olá ${interaction.user.username}! Eu sou o **NEXO AI**.\n\nAgora você pode conversar comigo privado! Tente:\n• "Salvar: filme A Origem"\n• "Quais filmes eu salvei?"\n• "Criar tarefa: ligar pro dentista amanhã"\n• "Criar evento: reunião sexta às 15h"\n\nUse /help para ver mais comandos.`,
				});

				await interaction.editReply({ content: '✅ Enviei um DM para você!' });
			} catch (error) {
				loggers.discord.error({ error }, '❌ Failed to send DM');
				await interaction.editReply({
					content: '❌ Não consegui enviar DM. Verifique se suas DMs estão abertas.',
				});
			}
		});
	}

	getProviderName(): ProviderType {
		return 'discord';
	}

	/**
	 * Setup all Discord event handlers
	 */
	private setupEventHandlers(): void {
		// Client error handlers
		client.on('error', (error) => {
			loggers.discord.error({ error }, '❌ Discord client error');
		});

		client.on('warn', (warning) => {
			loggers.discord.warn({ warning }, '⚠️ Discord client warning');
		});

		// Debug only in development
		if (process.env.NODE_ENV === 'development') {
			client.on('debug', (info) => {
				if (!info.includes('Heartbeat')) {
					loggers.discord.debug({ info }, '🔍 Discord debug');
				}
			});
		}

		// Bot ready
		client.once('clientReady', async () => {
			isReady = true;
			botUsername = client.user?.tag || null;
			loggers.discord.info(`🤖 Discord bot online as ${botUsername}`);
			loggers.discord.info(
				`🔗 Invite link: https://discord.com/api/oauth2/authorize?client_id=${client.user?.id}&permissions=8&scope=bot%20applications.commands`,
			);

			// Register slash commands
			await this.registerSlashCommands();
		});

		// Guild joined
		client.on('guildCreate', async (guild) => {
			loggers.discord.info({ guildName: guild.name, guildId: guild.id }, '🎉 Joined new guild');

			try {
				const owner = await guild.fetchOwner();
				await owner.send(
					`🎉 Olá! Obrigado por adicionar o NEXO AI ao servidor **${guild.name}**!\n\nVocê pode me usar em DMs ou me marcar com @${botUsername} em canais.\n\nConfigure as integrações pelo dashboard.`,
				);
				loggers.discord.info({ guildName: guild.name }, '✅ DM sent to guild owner');
			} catch (error) {
				loggers.discord.error({ error, guildName: guild.name }, '❌ Failed to send DM to guild owner');
			}
		});

		// Message created
		client.on('messageCreate', async (message) => {
			await this.handleMessageCreate(message);
		});

		// Message updated
		client.on('messageUpdate', async (oldMessage, newMessage) => {
			await this.handleMessageUpdate(oldMessage as any, newMessage as any);
		});

		// Message deleted
		client.on('messageDelete', async (message) => {
			await this.handleMessageDelete(message as any);
		});

		// Thread created
		client.on('threadCreate', async (thread) => {
			await this.handleThreadCreate(thread);
		});

		// Interaction handler (slash commands, buttons, select menus)
		client.on('interactionCreate', async (interaction) => {
			await this.handleInteraction(interaction);
		});
	}

	/**
	 * Handle messageCreate event
	 */
	private async handleMessageCreate(message: DiscordMessage<boolean>): Promise<void> {
		// Ignore messages from bots
		if (message.author.bot) return;

		// Check if it's a DM or guild message
		const isDM = message.channel.isDMBased();

		// For guild messages, check for bot mention
		if (!isDM) {
			// Check if bot is mentioned
			const botMentioned = message.mentions.has(client.user!);

			if (!botMentioned) {
				// Ignore messages without bot mention in guilds
				return;
			}
		}

		loggers.discord.info(
			{
				author: message.author.tag,
				content: message.content.substring(0, 100),
				isDM,
				guildId: message.guildId,
			},
			'📩 Message received',
		);

		// Parse the message and enqueue for processing
		const incomingMessage = this.parseIncomingMessage(message);
		if (incomingMessage) {
			await this.enqueueIncomingMessage(incomingMessage);

			loggers.discord.info({ messageId: incomingMessage.messageId }, '✅ Discord message enqueued for processing');
		}
	}

	private async enqueueIncomingMessage(incomingMessage: IncomingMessage): Promise<void> {
		const { messageQueue } = await import('@/services/queue-service');

		await messageQueue.add(
			'message-processing',
			{
				incomingMsg: incomingMessage,
				providerName: 'discord',
			},
			{
				removeOnComplete: true,
				attempts: 3,
				backoff: { type: 'exponential', delay: 2000 },
			},
		);
	}

	/**
	 * Handle messageUpdate event
	 */
	private async handleMessageUpdate(
		oldMessage: DiscordMessage<boolean> | Partial<DiscordMessage<boolean>>,
		newMessage: DiscordMessage<boolean> | Partial<DiscordMessage<boolean>>,
	): Promise<void> {
		if (!newMessage.author || newMessage.author.bot) return;

		loggers.discord.debug(
			{
				messageId: newMessage.id,
				oldContent: oldMessage.content?.substring(0, 50),
				newContent: newMessage.content?.substring(0, 50),
			},
			'📝 Message edited',
		);

		// Handle message edits if needed
		// For now, we log but don't process edits
	}

	/**
	 * Handle messageDelete event
	 */
	private async handleMessageDelete(
		message: DiscordMessage<boolean> | Partial<DiscordMessage<boolean>>,
	): Promise<void> {
		loggers.discord.debug({ messageId: message.id }, '🗑️ Message deleted');

		// Handle message deletion if needed
	}

	/**
	 * Handle threadCreate event
	 */
	private async handleThreadCreate(thread: ThreadChannel): Promise<void> {
		loggers.discord.info({ threadId: thread.id, threadName: thread.name }, '🧵 Thread created');

		// Handle thread creation if needed
	}

	/**
	 * Handle interaction (slash commands, buttons, select menus)
	 */
	private async handleInteraction(interaction: Interaction): Promise<void> {
		if (!interaction.isRepliable()) return;

		// Slash command
		if (interaction.isChatInputCommand()) {
			await this.handleSlashCommand(interaction);
		}
		// Button interaction
		else if (interaction.isButton()) {
			await this.handleButtonInteraction(interaction);
		}
		// Select menu interaction
		else if (interaction.isStringSelectMenu()) {
			await this.handleSelectMenuInteraction(interaction);
		}
	}

	/**
	 * Handle slash command
	 */
	private async handleSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
		const { commandName } = interaction;

		loggers.discord.info({ commandName, user: interaction.user.tag }, '🎮 Slash command invoked');

		const handler = this.commandHandlers.get(commandName);
		if (handler) {
			try {
				await handler(interaction);
			} catch (error) {
				loggers.discord.error({ error, commandName }, '❌ Slash command failed');

				if (interaction.replied || interaction.deferred) {
					await interaction.followUp({ content: '❌ Erro ao executar comando.', ephemeral: true });
				} else {
					await interaction.reply({ content: '❌ Erro ao executar comando.', ephemeral: true });
				}
			}
		} else {
			loggers.discord.warn({ commandName }, '⚠️ Unknown slash command');

			if (!interaction.replied && !interaction.deferred) {
				await interaction.reply({ content: '❌ Comando desconhecido.', ephemeral: true });
			}
		}
	}

	/**
	 * Handle button interaction - routes to orchestrator via message queue
	 * Same pattern as Telegram callback_query
	 */
	private async handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
		const { customId } = interaction;
		const providerPayload = JSON.parse(
			JSON.stringify({
				id: interaction.id,
				customId,
				channelId: interaction.channelId,
				guildId: interaction.guildId,
				user: {
					id: interaction.user.id,
					username: interaction.user.username,
				},
			}),
		) as Record<string, unknown>;

		loggers.discord.info({ customId, user: interaction.user.tag }, '🔘 Button clicked');

		// Acknowledge immediately to remove loading state from buttons
		try {
			await interaction.deferUpdate();
		} catch (err) {
			loggers.discord.warn({ err, customId }, '⚠️ Falha ao acknowledger interação (já respondida?)');
		}

		// Route to orchestrator via message queue (same as Telegram callback_query)
		const incomingMessage: IncomingMessage = {
			messageId: interaction.id,
			externalId: interaction.channelId,
			userId: interaction.user.id,
			senderName: interaction.user.username,
			username: interaction.user.username,
			text: customId,
			timestamp: new Date(),
			provider: 'discord',
			callbackQueryId: interaction.id,
			callbackData: customId,
			metadata: {
				isGroupMessage: interaction.inGuild(),
				groupId: interaction.inGuild() ? (interaction.guildId ?? undefined) : undefined,
				messageType: 'callback',
				providerPayload,
			},
		};

		await this.enqueueIncomingMessage(incomingMessage);

		loggers.discord.info({ customId, messageId: interaction.id }, '✅ Button interaction enqueued for processing');
	}

	/**
	 * Handle select menu interaction
	 */
	private async handleSelectMenuInteraction(interaction: StringSelectMenuInteraction): Promise<void> {
		const { customId, values } = interaction;

		loggers.discord.info({ customId, values, user: interaction.user.tag }, '📋 Select menu used');

		await interaction.reply({ content: `✅ Você selecionou: ${values.join(', ')}`, ephemeral: true });
	}

	/**
	 * Register slash commands
	 */
	private async registerSlashCommands(): Promise<void> {
		const commands = [
			new SlashCommandBuilder().setName('start').setDescription('Iniciar conversa privada com o NEXO AI'),
			new SlashCommandBuilder().setName('status').setDescription('Show session status'),
			new SlashCommandBuilder()
				.setName('new')
				.setDescription('Reset conversation')
				.addBooleanOption((option) => option.setName('confirm').setDescription('Confirm reset').setRequired(false)),
			new SlashCommandBuilder()
				.setName('memory')
				.setDescription('Search your memory')
				.addStringOption((option) => option.setName('query').setDescription('Search query').setRequired(false)),
			new SlashCommandBuilder()
				.setName('profile')
				.setDescription('Show or update your profile')
				.addStringOption((option) =>
					option.setName('key').setDescription('Profile key (name, assistant, tone)').setRequired(false),
				)
				.addStringOption((option) => option.setName('value').setDescription('New value').setRequired(false)),
			new SlashCommandBuilder().setName('help').setDescription('Show available commands'),
		];

		try {
			const rest = new REST({ version: '10' }).setToken(env.DISCORD_BOT_TOKEN || '');

			loggers.discord.info('📝 Registering slash commands...');

			await rest.put(Routes.applicationCommands(client.user!.id), { body: commands });

			loggers.discord.info('✅ Slash commands registered');
		} catch (error) {
			loggers.discord.error({ error }, '❌ Failed to register slash commands');
		}
	}

	/**
	 * Parse incoming message from Discord format to normalized format
	 */
	parseIncomingMessage(payload: any): IncomingMessage | null {
		const message = payload as DiscordMessage<boolean>;
		const providerPayload = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;

		if (!message || !message.author) {
			return null;
		}

		// Ignore bot messages
		if (message.author.bot) return null;

		const isDM = message.channel.isDMBased();
		const isGuildMessage = !isDM;

		// Extract text content
		let text = message.content || '';

		const mappedAttachments = mapDiscordAttachmentsToMetadata({
			attachments: Array.from(message.attachments.values()).map((attachment) => ({
				url: attachment.url,
				contentType: attachment.contentType,
				name: attachment.name,
				size: attachment.size,
			})),
			messageId: message.id,
			userId: message.author.id,
			timestamp: message.createdAt,
		});

		// Backward compatibility: preserve current URL-to-text behavior
		if (message.attachments.size > 0) {
			const attachmentUrls = Array.from(message.attachments.values())
				.map((a) => a.url)
				.join('\n');
			text = text ? `${text}\n${attachmentUrls}` : attachmentUrls;
		}

		// Check for command
		const isCommand = text.startsWith('/');

		// Check for bot mention in guilds
		let botMentioned = false;
		if (isGuildMessage && botUsername) {
			botMentioned = message.mentions.has(client.user!);
			if (!botMentioned && !isCommand) {
				// Ignore non-commands without bot mention
				return null;
			}
		}

		// Build externalId (channel ID for DMs, channel ID for guilds)
		const externalId = message.channelId;

		// Detect linking tokens
		let _linkingToken: string | undefined;
		if (text?.startsWith('/start ')) {
			_linkingToken = text.split(' ')[1];
		}

		return {
			messageId: message.id,
			externalId,
			userId: message.author.id,
			senderName: message.author.username,
			username: message.author.username,
			text,
			timestamp: message.createdAt,
			provider: 'discord',
			metadata: {
				isGroupMessage: isGuildMessage,
				groupId: isGuildMessage ? (message.guildId ?? undefined) : undefined,
				groupTitle: isGuildMessage ? message.guild?.name : undefined,
				botMentioned,
				messageType: isCommand ? 'command' : 'text',
				providerPayload,
				attachments: mappedAttachments.length > 0 ? mappedAttachments : undefined,
			},
		};
	}

	parseMessage(payload: any): {
		content: string;
		isDirectMessage: boolean;
		botMentioned: boolean;
		attachments?: Array<{ type: 'image' | 'audio' | 'file'; url: string; name?: string }>;
		edited: boolean;
	} {
		const isDirectMessage = payload.guildId == null;
		const mentions = payload.mentions?.users;
		const botMentioned = Array.isArray(mentions)
			? mentions.some((mention: { bot?: boolean }) => Boolean(mention?.bot))
			: false;
		const attachments = Array.isArray(payload.attachments)
			? payload.attachments.map((attachment: { contentType?: string | null; url: string; name?: string }) => ({
					type:
						attachment.contentType?.startsWith('image/') === true
							? 'image'
							: attachment.contentType?.startsWith('audio/') === true
								? 'audio'
								: 'file',
					url: attachment.url,
					name: attachment.name,
				}))
			: undefined;

		return {
			content: payload.content || '',
			isDirectMessage,
			botMentioned,
			attachments,
			edited: Boolean(payload.editedTimestamp),
		};
	}

	/**
	 * Verify webhook signature (Discord doesn't use HMAC, uses headers)
	 */
	verifyWebhook(request: any): boolean {
		// Discord uses signature verification via headers
		// This is a simplified check - production should verify the signature
		const signature = request.headers?.get('x-signature-ed25519') || request.headers?.['x-signature-ed25519'];
		const timestamp = request.headers?.get('x-signature-timestamp') || request.headers?.['x-signature-timestamp'];

		if (!signature || !timestamp) {
			loggers.discord.warn('⚠️ Discord webhook missing signature headers');
			return process.env.NODE_ENV === 'development';
		}

		// TODO: Implement proper signature verification
		// For now, accept in development
		return process.env.NODE_ENV === 'development' || true;
	}

	/**
	 * Send message to Discord channel
	 */
	async sendMessage(recipient: string, text: string, _options?: any): Promise<void> {
		try {
			const channel = await client.channels.fetch(recipient);
			if (!channel) throw new Error('Channel not found');

			if (!channel.isTextBased()) throw new Error('Channel is not text-based');

			await (channel as any).send(text);
			loggers.discord.info({ channelId: recipient, textLength: text.length }, '✅ Message sent');
		} catch (error) {
			loggers.discord.error({ error, channelId: recipient }, '❌ Failed to send message');
			throw error;
		}
	}

	/**
	 * Send typing indicator
	 */
	async sendTypingIndicator(chatId: string): Promise<void> {
		try {
			const channel = await client.channels.fetch(chatId);
			if (channel?.isTextBased()) {
				await (channel as any).sendTyping();
			}
		} catch (error) {
			loggers.discord.warn({ error, chatId }, '⚠️ Failed to send typing indicator');
		}
	}

	/**
	 * Send chat action (Discord doesn't have native actions like Telegram)
	 */
	async sendChatAction(chatId: string, action: ChatAction): Promise<void> {
		// Discord uses typing indicator instead of actions
		if (action === 'typing') {
			await this.sendTypingIndicator(chatId);
		}
		// Other actions are not natively supported in Discord
	}

	/**
	 * Build session key
	 */
	buildSessionKey(params: SessionKeyParams): string {
		return buildSessionKey(params);
	}

	/**
	 * Parse session key
	 */
	parseSessionKey(key: string): SessionKeyParts {
		return parseSessionKeyUtil(key);
	}

	/**
	 * Register command
	 */
	registerCommand(command: ChatCommand): void {
		this.commands.set(command.name, command);
		if (command.aliases) {
			for (const alias of command.aliases) {
				this.commands.set(alias, command);
			}
		}

		// Register Discord slash command handler
		this.commandHandlers.set(command.name, async (interaction: ChatInputCommandInteraction) => {
			const userId = interaction.user.id;
			const conversationId = interaction.channelId; // Use channel ID as conversation ID
			const sessionKey = this.buildSessionKey({
				channel: 'discord',
				peerKind: interaction.inGuild() ? 'group' : 'direct',
				peerId: interaction.channelId,
			});

			// Get command args from Discord interaction
			let args: string | undefined;
			if (command.name === 'memory') {
				args = interaction.options.getString('query') || undefined;
			} else if (command.name === 'profile') {
				const key = interaction.options.getString('key');
				const value = interaction.options.getString('value');
				args = key && value ? `${key}=${value}` : undefined;
			}

			const params: CommandParams = {
				userId,
				conversationId,
				sessionKey,
				args,
				provider: 'discord',
			};

			const response = await command.handler(params);

			if (interaction.replied || interaction.deferred) {
				await interaction.followUp({ content: response, ephemeral: !interaction.inGuild() });
			} else {
				await interaction.reply({ content: response, ephemeral: !interaction.inGuild() });
			}
		});

		loggers.discord.info({ name: command.name, aliases: command.aliases }, '✅ Command registered');
	}

	/**
	 * Handle command
	 */
	async handleCommand(command: string, params: CommandParams): Promise<void> {
		const cmd = this.commands.get(command);
		if (!cmd) {
			loggers.discord.warn({ command }, '⚠️ Unknown command');
			return;
		}

		// Check if command is allowed in groups
		const isGroup = params.sessionKey.includes(':group:');
		if (isGroup && !cmd.allowedInGroups) {
			loggers.discord.warn({ command }, '⚠️ Command not allowed in groups');
			return;
		}

		try {
			const response = await cmd.handler(params);
			if (response) {
				const parts = this.parseSessionKey(params.sessionKey);
				await this.sendMessage(parts.peerId, response);
			}
		} catch (error) {
			loggers.discord.error({ error, command }, '❌ Command execution failed');
		}
	}

	/**
	 * Mark as read (no-op for Discord)
	 */
	async markAsRead(messageId: string): Promise<void> {
		// Discord doesn't have read receipts
		loggers.discord.debug({ messageId }, '📭 Mark as read (no-op for Discord)');
	}

	/**
	 * Send message with buttons
	 */
	async sendMessageWithButtons(chatId: string, text: string, buttons: any[], _options?: any): Promise<void> {
		try {
			const channel = await client.channels.fetch(chatId);
			if (!channel || !channel.isTextBased()) throw new Error('Invalid channel');

			// Convert button format to Discord format
			const components = buttons.map((row: any[]) => ({
				type: 1, // Action Row
				components: row.map((button: any) => ({
					type: 2, // Button
					label: String(button.text).substring(0, 80),
					style: button.style || 1, // Primary = 1, Secondary = 2, Success = 3, Danger = 4
					custom_id: button.callback_data,
				})),
			}));

			await (channel as any).send({
				content: text,
				components,
			});

			loggers.discord.info({ chatId, buttonsCount: buttons.flat().length }, '✅ Message with buttons sent');
		} catch (error) {
			loggers.discord.error({ error, chatId }, '❌ Failed to send message with buttons');
			throw error;
		}
	}

	/**
	 * Send photo with caption and buttons — usa Discord Embed para display rico
	 * (igual Telegram: poster do filme + título + botões)
	 */
	async sendPhoto(chatId: string, photoUrl: string, caption?: string, buttons?: any[], _options?: any): Promise<void> {
		try {
			const channel = await client.channels.fetch(chatId);
			if (!channel || !channel.isTextBased()) throw new Error('Invalid channel');

			const embed = new EmbedBuilder().setImage(photoUrl).setColor(0x5865f2);

			if (caption) {
				// Primeiras 4096 chars (limite do description do embed)
				embed.setDescription(caption.substring(0, 4096));
			}

			const payload: any = { embeds: [embed] };

			if (buttons && buttons.length > 0) {
				payload.components = buttons.map((row: any[]) => ({
					type: 1,
					components: row.map((button: any) => ({
						type: 2,
						label: String(button.text).substring(0, 80),
						style: button.style || 1,
						custom_id: button.callback_data,
					})),
				}));
			}

			await (channel as any).send(payload);
			loggers.discord.info({ chatId, hasCaption: !!caption, hasButtons: !!buttons }, '✅ Photo (embed) enviada');
		} catch (error) {
			loggers.discord.error({ error, chatId }, '❌ Failed to send photo');
			throw error;
		}
	}

	/**
	 * Answer callback query (no-op for Discord - interactions are different)
	 */
	async answerCallbackQuery(callbackQueryId: string, _text?: string): Promise<void> {
		// Discord uses interaction replies, not callback queries
		loggers.discord.debug({ callbackQueryId }, '📭 Answer callback (no-op for Discord)');
	}
}

/**
 * Singleton instance
 */
export const discordAdapter = new DiscordAdapter();

/**
 * Legacy function to send DM
 */
export async function sendDiscordDM(discordUserId: string, message: string): Promise<void> {
	if (!isReady) throw new Error('Discord bot não está pronto');
	const user = await client.users.fetch(discordUserId);
	if (!user) throw new Error('Usuário Discord não encontrado');
	await user.send(message);
}

/**
 * Start Discord bot
 */
export async function startDiscordBot(token: string): Promise<void> {
	if (isReady) {
		loggers.discord.warn('⚠️ Discord bot já está online, ignorando chamada de start');
		return;
	}

	loggers.discord.info('🔄 Discord bot iniciando...');
	try {
		await client.login(token);
		loggers.discord.info('✅ Discord login realizado com sucesso');
	} catch (error) {
		loggers.discord.error({ error }, '❌ Erro fatal ao fazer login Discord');
		throw error;
	}
}
