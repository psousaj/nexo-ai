import { db } from "@/config/database";
import { conversations, messages } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
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
   * Limpa contexto e volta estado para idle
   */
  async resetConversation(conversationId: string) {
    return this.updateState(conversationId, "idle", {});
  }
}

export const conversationService = new ConversationService();
