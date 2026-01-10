import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import type {
  ConversationState,
  ConversationContext,
  MessageRole,
} from "@/types";

export class ConversationService {
  /**
   * Busca ou cria conversação ativa para o usuário
   */
  async findOrCreateConversation(userId: string) {
    const [existing] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.updatedAt))
      .limit(1);

    if (existing) {
      return existing;
    }

    const [newConv] = await db
      .insert(conversations)
      .values({
        userId,
        state: "idle",
        context: {},
      })
      .returning();

    return newConv;
  }

  /**
   * Atualiza estado da conversação
   */
  async updateState(
    conversationId: string,
    state: ConversationState,
    context?: ConversationContext
  ) {
    const [updated] = await db
      .update(conversations)
      .set({
        state,
        context: context ?? {},
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId))
      .returning();

    return updated;
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
