import { type ProviderType, getProvider } from '@/adapters/messaging';
import { db } from '@/db';
import { conversations, messages } from '@/db/schema';
import { getRandomLogMessage, processingLogs } from '@/services/conversation/logMessages';
import {
	getClarificationMessages,
	getClarificationOptions,
	getRandomMessage,
} from '@/services/message-analysis/constants/clarification-messages';
import { messageAnalyzer } from '@/services/message-analysis/message-analyzer.service';
import type { Language } from '@/services/message-analysis/types/analysis-result.types';
import { instrumentService } from '@/services/service-instrumentation';
import type { ConversationContext, ConversationState, MessageRole } from '@/types';
import { loggers } from '@/utils/logger';
import { and, desc, eq, sql } from 'drizzle-orm';

type MessagePersistOptions = {
	provider?: string;
	externalId?: string;
	providerMessageId?: string;
	providerPayload?: Record<string, unknown>;
};

export class ConversationService {
	private normalizeProviderPayload(payload?: Record<string, unknown>) {
		if (!payload) return undefined;
		return JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
	}

	private buildMessagePersistData(
		conversationId: string,
		role: MessageRole,
		content: string,
		options?: MessagePersistOptions,
	) {
		return {
			conversationId,
			role,
			content,
			provider: options?.provider,
			externalId: options?.externalId,
			providerMessageId: options?.providerMessageId,
			providerPayload: this.normalizeProviderPayload(options?.providerPayload),
		};
	}

	private async resolvePersistOptions(conversationId: string, role: MessageRole, options?: MessagePersistOptions) {
		if (role !== 'assistant') {
			return options;
		}

		if (options?.provider && options?.externalId) {
			return options;
		}

		const [lastMessage] = await db
			.select({
				provider: messages.provider,
				externalId: messages.externalId,
			})
			.from(messages)
			.where(eq(messages.conversationId, conversationId))
			.orderBy(desc(messages.createdAt))
			.limit(1);

		return {
			...options,
			provider: options?.provider ?? lastMessage?.provider ?? undefined,
			externalId: options?.externalId ?? lastMessage?.externalId ?? undefined,
		};
	}

	/**
	 * Busca ou cria conversação ativa para o usuário
	 * Conversas 'closed' são consideradas inativas e uma nova é criada
	 */
	async findOrCreateConversation(userId: string) {
		// Busca conversa ativa que NÃO esteja fechada
		const [existing] = await db
			.select()
			.from(conversations)
			.where(and(eq(conversations.userId, userId), eq(conversations.isActive, true)))
			.orderBy(desc(conversations.updatedAt))
			.limit(1);

		// Se encontrou conversa ativa mas está closed, desativa e cria nova
		if (existing && existing.state === 'closed') {
			loggers.db.info({ conversationId: existing.id.substring(0, 8) }, '🔄 Conversa está fechada, criando nova');

			await db.update(conversations).set({ isActive: false }).where(eq(conversations.id, existing.id));

			// Cria nova conversa
			const [newConv] = await db
				.insert(conversations)
				.values({
					userId,
					state: 'idle',
					context: {},
					isActive: true,
				})
				.returning();

			loggers.db.info({ conversationId: newConv.id.substring(0, 8) }, '🆕 Nova conversa criada');
			return newConv;
		}

		// Se tem conversa ativa e não está closed, retorna ela
		if (existing) {
			return existing;
		}

		// Se não tem nenhuma conversa ativa, desativa todas antigas e cria nova
		await db.update(conversations).set({ isActive: false }).where(eq(conversations.userId, userId));

		// Cria nova conversa ativa
		const [newConv] = await db
			.insert(conversations)
			.values({
				userId,
				state: 'idle',
				context: {},
				isActive: true,
			})
			.returning();

		loggers.db.info({ conversationId: newConv.id.substring(0, 8) }, '🆕 Primeira conversa criada');
		return newConv;
	}

	/**
	 * Atualiza estado da conversação
	 */
	async updateState(conversationId: string, state: ConversationState, newContext?: ConversationContext) {
		// Busca contexto atual para fazer merge
		const [current] = await db
			.select({ context: conversations.context, state: conversations.state })
			.from(conversations)
			.where(eq(conversations.id, conversationId))
			.limit(1);

		const oldState = current?.state || 'unknown';

		// Log: transição de estado
		loggers.db.info(
			`🔄 ${getRandomLogMessage(processingLogs.stateChange, {
				conversationId: conversationId.substring(0, 8),
				from: oldState,
				to: state,
			})}`,
		);

		const mergedContext = {
			...(current?.context || {}),
			...(newContext || {}),
		};

		const [updated] = await db
			.update(conversations)
			.set({
				state,
				context: mergedContext,
				updatedAt: new Date(),
			})
			.where(eq(conversations.id, conversationId))
			.returning();

		return updated;
	}

	/**
	 * Detecta mensagens longas/ambíguas e solicita clarificação
	 * Retorna true se clarificação foi solicitada
	 * Usa o novo MessageAnalyzerService para análise
	 */
	async handleAmbiguousMessage(
		conversationId: string,
		message: string,
		externalId: string,
		providerType: ProviderType,
		language: Language = 'pt',
	): Promise<boolean> {
		// Usa o novo serviço de análise de mensagens
		const ambiguityResult = messageAnalyzer.checkAmbiguity(message, language);

		if (ambiguityResult.isAmbiguous) {
			const reason = ambiguityResult.reason === 'long_without_command' ? 'Mensagem longa' : 'Mensagem curta sem verbo';
			loggers.db.info(
				{ reason, confidence: ambiguityResult.confidence },
				'🔍 Ambiguidade detectada, solicitando clarificação',
			);

			// Gera opções dinamicamente a partir de tools habilitadas (ADR-019)
			const clarificationOptions = await getClarificationOptions(language);

			// Atualiza estado para awaiting_context
			await this.updateState(conversationId, 'awaiting_context', {
				pendingClarification: {
					originalMessage: message,
					detectedType: null,
					clarificationOptions,
				},
			});

			// Envia mensagem de clarificação ao usuário
			const msg = getRandomMessage(getClarificationMessages(language));
			const optionsText = clarificationOptions.map((opt: string, i: number) => `${i + 1}. ${opt}`).join('\n');

			// Multi-provider: obtém provider correto e envia mensagem
			const provider = await getProvider(providerType);
			if (provider) {
				await provider.sendMessage(externalId, `${msg}\n\n${optionsText}`);
			} else {
				loggers.db.error({ provider: providerType }, '❌ Provider não encontrado');
				throw new Error(`Provider ${providerType} não encontrado`);
			}

			return true; // Clarificação solicitada
		}

		return false; // Não é ambíguo
	}

	/**
	 * Adiciona mensagem ao histórico
	 */
	async addMessage(conversationId: string, role: MessageRole, content: string, options?: MessagePersistOptions) {
		const resolvedOptions = await this.resolvePersistOptions(conversationId, role, options);

		const [message] = await db
			.insert(messages)
			.values(this.buildMessagePersistData(conversationId, role, content, resolvedOptions))
			.returning();

		return message;
	}

	/**
	 * Busca histórico de mensagens
	 */
	async getHistory(conversationId: string, limit = 20) {
		const history = await db
			.select()
			.from(messages)
			.where(eq(messages.conversationId, conversationId))
			.orderBy(desc(messages.createdAt))
			.limit(limit);

		return history.reverse(); // Ordem cronológica
	}

	/**
	 * Busca mensagens recentes (últimos 5 minutos)
	 * Útil para determinar se mensagem é continuação de contexto
	 */
	async getRecentMessages(conversationId: string, minutesAgo = 5) {
		const fiveMinutesAgo = new Date(Date.now() - minutesAgo * 60 * 1000);

		const recentMessages = await db
			.select()
			.from(messages)
			.where(eq(messages.conversationId, conversationId))
			.orderBy(desc(messages.createdAt))
			.limit(10);

		// Filtra apenas as dos últimos X minutos
		return recentMessages.filter((msg) => new Date(msg.createdAt) >= fiveMinutesAgo).reverse(); // Ordem cronológica
	}

	/**
	 * Limpa contexto e volta estado para idle
	 */
	async resetConversation(conversationId: string) {
		return this.updateState(conversationId, 'idle', {});
	}

	/**
	 * Conta total de mensagens na conversação
	 */
	async getMessageCount(conversationId: string): Promise<number> {
		const result = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(messages)
			.where(eq(messages.conversationId, conversationId));

		return result[0]?.count || 0;
	}
}

export const conversationService = instrumentService('conversation', new ConversationService());
