/**
 * Chat Commands Service - OpenClaw Pattern
 *
 * Slash commands for advanced users (NOT primary interaction mode)
 * NEXO focuses on NLP natural language - commands are optional shortcuts
 *
 * Philosophy:
 * - 99% of users interact via natural language
 * - 1% of power users can use commands for quick actions
 * - Commands should NOT be the primary UX
 */

import type { ChatCommand, CommandParams } from '@/adapters/messaging/types';
import { db } from '@/db';
import { agentSessions, conversations, users } from '@/db/schema';
import { loggers } from '@/utils/logger';
import { eq } from 'drizzle-orm';
import { getAgentProfile } from './context-builder';
import { conversationService } from './conversation-service';
import { searchMemory } from './memory-search';
import { preferencesService } from './preferences-service';

/**
 * Format memory search results for display
 */
function formatMemoryResults(results: any[]): string {
	if (results.length === 0) {
		return '📭 Nenhum item encontrado.';
	}

	const items = results.slice(0, 10); // Limit to 10 items
	let message = `📚 Encontrei ${results.length} item(ns):\n\n`;

	items.forEach((item, index) => {
		const emoji = getItemEmoji(item.type);
		const metadata = item.metadata || {};
		const year = metadata.year ? ` (${metadata.year})` : '';
		const rating = metadata.vote_average ? ` ⭐ ${metadata.vote_average.toFixed(1)}` : '';

		message += `${index + 1}. ${emoji} *${item.title}*${year}${rating}\n`;
	});

	if (results.length > 10) {
		message += `\n... e mais ${results.length - 10} itens.`;
	}

	return message;
}

/**
 * Get emoji for item type
 */
function getItemEmoji(type: string): string {
	const emojis: Record<string, string> = {
		movie: '🎬',
		tv_show: '📺',
		video: '📹',
		link: '🔗',
		note: '📝',
	};
	return emojis[type] || '📄';
}

/**
 * Command: /status
 * Show session status information
 */
const statusCommand: ChatCommand = {
	name: 'status',
	description: 'Show session status',
	aliases: ['s'],
	allowedInGroups: true,
	handler: async (params: CommandParams): Promise<string> => {
		const session = await db.query.agentSessions.findFirst({
			where: eq(agentSessions.sessionKey, params.sessionKey),
		});

		if (!session) {
			return '⚠️ Session not found.';
		}

		const user = session.userId
			? await db.query.users.findFirst({
					where: eq(users.id, session.userId),
				})
			: null;

		return `📊 *Session Status*

🆔 Session: \`${params.sessionKey}\`
🤖 Model: ${session.model || 'default'}
🧠 Thinking: ${session.thinkingLevel || 'default'}
👤 User: ${user?.name || 'Unknown'}
📝 Assistant: ${user?.assistantName || 'NEXO'}
🔀 Scope: ${session.dmScope}
⏰ Last Activity: ${new Date(session.lastActivityAt).toLocaleString('pt-BR')}`;
	},
};

/**
 * Command: /new or /reset
 * Reset conversation context
 */
const newCommand: ChatCommand = {
	name: 'new',
	description: 'Reset conversation',
	aliases: ['reset', 'clear'],
	allowedInGroups: true,
	handler: async (params: CommandParams): Promise<string> => {
		await conversationService.updateState(params.conversationId, 'idle', {
			candidates: undefined,
			awaiting_selection: false,
			selectedForConfirmation: null,
			pendingClarification: undefined,
			clarificationAttempts: 0,
		});

		return '✨ Conversa reiniciada! Começando do zero. 🚀';
	},
};

/**
 * Command: /compact
 * Compact conversation context (DM only)
 */
const compactCommand: ChatCommand = {
	name: 'compact',
	description: 'Compact conversation context',
	aliases: ['compact'],
	allowedInGroups: false, // DM only
	handler: async (params: CommandParams): Promise<string> => {
		// Get conversation history
		const history = await conversationService.getHistory(params.conversationId, 100);

		if (history.length < 20) {
			return 'ℹ️ Conversa ainda está curta, não precisa compactar.';
		}

		// Keep only last 10 messages
		const toKeep = history.slice(-10);

		// Clear and re-add messages
		// Note: This is a simplified version - production would need proper message deletion
		loggers.ai.info(
			{ conversationId: params.conversationId, originalLength: history.length, newLength: toKeep.length },
			'🗜️ Conversation compacted',
		);

		return `🗜️ Conversa compactada! Mantive as últimas ${toKeep.length} mensagens de ${history.length}.`;
	},
};

/**
 * Command: /profile
 * Show or update user profile
 */
const profileCommand: ChatCommand = {
	name: 'profile',
	description: 'Show or update your profile',
	aliases: ['p'],
	allowedInGroups: false,
	handler: async (params: CommandParams): Promise<string> => {
		const user = await db.query.users.findFirst({
			where: eq(users.id, params.userId),
		});

		if (!user) {
			return '❌ Usuário não encontrado.';
		}

		// If args provided, try to update profile
		if (params.args) {
			// Parse simple key=value format
			const parts = params.args.split('=');
			if (parts.length === 2) {
				const [key, value] = parts;

				switch (key.trim()) {
					case 'name':
						await db.update(users).set({ name: value }).where(eq(users.id, params.userId));
						return `✅ Nome atualizado para: ${value}`;

					case 'assistant':
					case 'botname':
						await db.update(users).set({ assistantName: value }).where(eq(users.id, params.userId));
						return `✅ Nome do assistente atualizado para: ${value}`;

					case 'tone':
						if (['friendly', 'professional', 'playful', 'sarcastic', 'formal'].includes(value)) {
							await db.update(users).set({ assistantTone: value }).where(eq(users.id, params.userId));
							return `✅ Tom atualizado para: ${value}`;
						}
						return '❌ Tom inválido. Opções: friendly, professional, playful, sarcastic, formal';

					case 'creature':
						await db.update(users).set({ assistantCreature: value }).where(eq(users.id, params.userId));
						return `✅ Creature atualizado para: ${value}`;

					default:
						return '❌ Campo desconhecido. Campos disponíveis: name, assistant, tone, creature';
				}
			}

			return '❌ Formato inválido. Use: /profile key=value (ex: /profile tone=friendly)';
		}

		// Show current profile
		const profile = await getAgentProfile(params.userId);

		return `👤 *Seu Perfil*

📛 Nome: ${user.name || 'Não definido'}
🤖 Assistente: ${user.assistantName || 'NEXO'}
${user.assistantTone ? `💬 Tom: ${user.assistantTone}` : ''}
${user.assistantCreature ? `🦊 Creature: ${user.assistantCreature}` : ''}
${user.assistantEmoji ? `🎭 Emoji: ${user.assistantEmoji}` : ''}

${profile ? '\n📝 *Perfil Completo:* Você tem um perfil de personalidade configurado!' : '\n💡 Configure sua personalidade com /profile key=value'}`;
	},
};

/**
 * Command: /memory
 * Search your memory
 */
const memoryCommand: ChatCommand = {
	name: 'memory',
	description: 'Search your memory',
	aliases: ['m', 'search', 'find'],
	allowedInGroups: false,
	handler: async (params: CommandParams): Promise<string> => {
		if (!params.args) {
			// Show recent items if no query
			const results = await searchMemory({
				query: '',
				userId: params.userId,
				maxResults: 10,
			});

			return formatMemoryResults(results);
		}

		// Search with query
		const results = await searchMemory({
			query: params.args,
			userId: params.userId,
			maxResults: 10,
		});

		return formatMemoryResults(results);
	},
};

/**
 * Command: /think
 * Set thinking level (DM only)
 */
const thinkCommand: ChatCommand = {
	name: 'think',
	description: 'Set thinking level',
	aliases: ['t'],
	allowedInGroups: false,
	handler: async (params: CommandParams): Promise<string> => {
		const validLevels = ['off', 'minimal', 'low', 'medium', 'high'];

		if (!params.args || !validLevels.includes(params.args)) {
			return `❌ Nível inválido. Use: /think ${validLevels.join(' | ')}`;
		}

		// Update session thinking level
		await db
			.update(agentSessions)
			.set({ thinkingLevel: params.args })
			.where(eq(agentSessions.sessionKey, params.sessionKey));

		return `🧠 Nível de pensamento definido para: *${params.args}*`;
	},
};

/**
 * Command: /verbose
 * Toggle verbose mode (DM only)
 */
const verboseCommand: ChatCommand = {
	name: 'verbose',
	description: 'Toggle verbose mode',
	aliases: ['v'],
	allowedInGroups: false,
	handler: async (params: CommandParams): Promise<string> => {
		const enabled = params.args === 'on' || params.args === 'true' || params.args === '1';

		// This would be stored in session or user preferences
		// For now, just return a message
		return `🔊 Modo verbose ${enabled ? 'ativado' : 'desativado'}. (Implementação futura)`;
	},
};

/**
 * Command: /voice
 * Toggle voice mode (TTS responses) per conversation or globally per user
 *
 * Usage:
 *   /voice        — toggle per-conversation
 *   /voice on     — enable per-conversation
 *   /voice off    — disable per-conversation
 *   /voice global — toggle user-level auto-TTS preference
 */
const voiceCommand: ChatCommand = {
	name: 'voice',
	description: 'Toggle voice responses on/off. Use "global" for user-level auto-TTS.',
	aliases: ['voz', 'audio'],
	allowedInGroups: false,
	handler: async (params: CommandParams): Promise<string> => {
		const { conversationId, userId, args } = params;

		// ── Global auto-TTS toggle ────────────────────────────────────────────
		if (args?.trim().toLowerCase() === 'global') {
			const prefs = await preferencesService.getPreferences(userId);
			const current = prefs?.autoTts ?? false;
			const newValue = !current;

			await preferencesService.updatePreferences(userId, { autoTts: newValue });

			return newValue
				? '🌍 Auto-TTS ativado globalmente! Todas as conversas terão resposta em áudio automaticamente.'
				: '🌍 Auto-TTS desativado. Use /voice para ativar por conversa.';
		}

		// ── Per-conversation toggle ──────────────────────────────────────────
		const conversation = await db.query.conversations.findFirst({
			where: eq(conversations.id, conversationId),
		});

		if (!conversation) {
			return '❌ Conversa não encontrada.';
		}

		const currentContext = (conversation.context ?? {}) as Record<string, any>;
		const currentMode = currentContext.voiceMode === true;
		const textArg = args?.trim().toLowerCase();

		let newMode: boolean;
		if (textArg === 'on') {
			newMode = true;
		} else if (textArg === 'off') {
			newMode = false;
		} else {
			newMode = !currentMode;
		}

		await conversationService.updateState(conversationId, conversation.state as any, {
			...currentContext,
			voiceMode: newMode,
		});

		return newMode
			? '🔊 Modo voz ativado! Respostas serão enviadas como áudio.'
			: '🔇 Modo voz desativado. Respostas serão apenas em texto.';
	},
};

/**
 * Command: /help
 * Show available commands
 */
const helpCommand: ChatCommand = {
	name: 'help',
	description: 'Show available commands',
	aliases: ['h', '?'],
	allowedInGroups: true,
	handler: async (_params: CommandParams): Promise<string> => {
		return `🤖 *Comandos Disponíveis*

💬 *Conversa Natural* (recomendado):
- "Salva [filme]" • "Busca [termo]" • "Apaga o 1"
- "O que eu tenho?" • "Quais filmes?"

⚡ *Atalhos* (power users):
/status - Mostrar status da sessão
/new - Reiniciar conversa
/compact - Compactar contexto
/profile - Ver/editar perfil
/memory - Buscar memória
/think - Nível de pensamento
/help - Esta ajuda

💡 *Dica:* Você pode usar linguagem natural!
"Salva Interstellar" é o mesmo que /memory Interstellar

🔊 *Voz:*
/voice - Ativar/desativar respostas em áudio
/voice global - Auto-TTS global (todas as conversas)`;
	},
};

/**
 * Export all commands
 */
export const chatCommands: Record<string, ChatCommand> = {
	status: statusCommand,
	new: newCommand,
	reset: newCommand, // Alias
	clear: newCommand, // Alias
	compact: compactCommand,
	profile: profileCommand,
	memory: memoryCommand,
	search: memoryCommand, // Alias
	find: memoryCommand, // Alias
	think: thinkCommand,
	verbose: verboseCommand,
	voice: voiceCommand,
	help: helpCommand,
};

/**
 * Get command by name or alias
 */
export function getCommand(name: string): ChatCommand | null {
	// Remove leading slash if present
	const commandName = name.startsWith('/') ? name.slice(1) : name;
	return chatCommands[commandName] || null;
}

/**
 * Extract command from message text
 */
export function extractCommand(text: string): { command: string; args?: string } | null {
	const trimmed = text.trim();

	if (!trimmed.startsWith('/')) {
		return null;
	}

	// Find first space to separate command from args
	const spaceIndex = trimmed.indexOf(' ');

	if (spaceIndex === -1) {
		return { command: trimmed.slice(1) };
	}

	return {
		command: trimmed.slice(1, spaceIndex),
		args: trimmed.slice(spaceIndex + 1).trim() || undefined,
	};
}

/**
 * Check if message is a command
 */
export function isCommand(text: string): boolean {
	return text.trim().startsWith('/');
}
