import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import type {
  ConversationState,
  ConversationContext,
  MessageRole,
} from "@/types";
import { classifierService } from "@/services/classifier-service";
import { whatsappService } from "@/services/whatsapp";
import { clarificationMessages, clarificationOptions, getRandomMessage } from "@/services/conversation/messageTemplates";
import { processingLogs, getRandomLogMessage } from "@/services/conversation/logMessages";

export class ConversationService {
  /**
   * Busca ou cria conversação ativa para o usuário
   * Conversas 'closed' são consideradas inativas e uma nova é criada
   */
  async findOrCreateConversation(userId: string) {
    // Busca conversa ativa que NÃO esteja fechada
    const [existing] = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.userId, userId),
          eq(conversations.isActive, true)
        )
      )
      .orderBy(desc(conversations.updatedAt))
      .limit(1);

    // Se encontrou conversa ativa mas está closed, desativa e cria nova
    if (existing && existing.state === 'closed') {
      console.log(`🔄 [Conversation] Conversa ${existing.id.substring(0, 8)} está closed, criando nova`);
      
      await db
        .update(conversations)
        .set({ isActive: false })
        .where(eq(conversations.id, existing.id));
      
      // Cria nova conversa
      const [newConv] = await db
        .insert(conversations)
        .values({
          userId,
          state: "idle",
          context: {},
          isActive: true,
        })
        .returning();

      console.log(`🆕 [Conversation] Nova conversa criada: ${newConv.id.substring(0, 8)}`);
      return newConv;
    }

    // Se tem conversa ativa e não está closed, retorna ela
    if (existing) {
      return existing;
    }

    // Se não tem nenhuma conversa ativa, desativa todas antigas e cria nova
    await db
      .update(conversations)
      .set({ isActive: false })
      .where(eq(conversations.userId, userId));

    // Cria nova conversa ativa
    const [newConv] = await db
      .insert(conversations)
      .values({
        userId,
        state: "idle",
        context: {},
        isActive: true,
      })
      .returning();

    console.log(`🆕 [Conversation] Primeira conversa criada: ${newConv.id.substring(0, 8)}`);
    return newConv;
  }

  /**
   * Atualiza estado da conversação
   */
  async updateState(
    conversationId: string,
    state: ConversationState,
    newContext?: ConversationContext
  ) {
    // Busca contexto atual para fazer merge
    const [current] = await db
      .select({ context: conversations.context, state: conversations.state })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    const oldState = current?.state || 'unknown';

    // Log: transição de estado
    console.log(
      getRandomLogMessage(processingLogs.stateChange, {
        conversationId: conversationId.substring(0, 8),
        from: oldState,
        to: state,
      })
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
   */
  async handleAmbiguousMessage(
    conversationId: string,
    message: string
  ): Promise<boolean> {
    // Detecta mensagens longas (>150 chars) sem verbos de ação claros
    // Verbo deve estar no início E ser um comando direto (ex: "salva inception")
    // "Salvar info tmdb..." é uma descrição técnica, não um comando
    const hasDirectCommand = /^(salva|adiciona|busca|lista|deleta|procura|mostra|remove)\s+\w+/i.test(
      message.trim()
    );
    
    // Mensagens muito longas (>150 chars) provavelmente são notas/descrições
    // mesmo que comecem com palavras como "Salvar"
    const isLongMessage = message.length > 150;

    if (isLongMessage && !hasDirectCommand) {
      console.log("🔍 [Conversation] Mensagem longa detectada, solicitando clarificação");

      // Atualiza estado para awaiting_context
      await this.updateState(conversationId, "awaiting_context", {
        pendingClarification: {
          originalMessage: message,
          detectedType: null,
          clarificationOptions,
        },
      });

      // Envia mensagem de clarificação ao usuário
      const msg = getRandomMessage(clarificationMessages);
      const optionsText = clarificationOptions
        .map((opt: string, i: number) => `${i + 1}. ${opt}`)
        .join("\n");

      // TODO: Adaptar para multi-provider (não só whatsapp)
      await whatsappService.sendMessage(
        conversationId,
        `${msg}\n\n${optionsText}`
      );

      return true; // Clarificação solicitada
    }

    return false; // Não é ambíguo
  }

  /**
   * Adiciona mensagem ao histórico
   */
  async addMessage(conversationId: string, role: MessageRole, content: string) {
    const [message] = await db
      .insert(messages)
      .values({
        conversationId,
        role,
        content,
      })
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
    return recentMessages
      .filter((msg) => new Date(msg.createdAt) >= fiveMinutesAgo)
      .reverse(); // Ordem cronológica
  }

  /**
   * Limpa contexto e volta estado para idle
   */
  async resetConversation(conversationId: string) {
    return this.updateState(conversationId, "idle", {});
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

export const conversationService = new ConversationService();
