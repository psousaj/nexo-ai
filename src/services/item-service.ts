import { db } from "@/db";
import { memoryItems } from "@/db/schema";
import { eq, and, desc, sql, or } from "drizzle-orm";
import type { ItemType, ItemMetadata } from "@/types";

/**
 * Resultado da verificação de duplicata
 */
export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingItem?: {
    id: string;
    title: string;
    type: ItemType;
    createdAt: Date;
  };
}

export class ItemService {
  /**
   * Verifica se memória já existe (KISS: verificação simples por externalId ou título)
   */
  async checkDuplicate(params: {
    userId: string;
    type: ItemType;
    externalId?: string;
    title?: string;
  }): Promise<DuplicateCheckResult> {
    const { userId, type, externalId, title } = params;

    // Prioriza busca por externalId (mais preciso)
    if (externalId) {
      const [existing] = await db
        .select()
        .from(memoryItems)
        .where(
          and(
            eq(memoryItems.userId, userId),
            eq(memoryItems.type, type),
            eq(memoryItems.externalId, externalId)
          )
        )
        .limit(1);

      if (existing) {
        return {
          isDuplicate: true,
          existingItem: {
            id: existing.id,
            title: existing.title,
            type: existing.type as ItemType,
            createdAt: existing.createdAt,
          },
        };
      }
    }

    // Fallback: busca por título similar (normalizado)
    if (title) {
      const normalizedTitle = this.normalizeTitle(title);
      const [existing] = await db
        .select()
        .from(memoryItems)
        .where(
          and(
            eq(memoryItems.userId, userId),
            eq(memoryItems.type, type),
            sql`LOWER(REGEXP_REPLACE(${memoryItems.title}, '[^a-zA-Z0-9]', '', 'g')) = ${normalizedTitle}`
          )
        )
        .limit(1);

      if (existing) {
        return {
          isDuplicate: true,
          existingItem: {
            id: existing.id,
            title: existing.title,
            type: existing.type as ItemType,
            createdAt: existing.createdAt,
          },
        };
      }
    }

    return { isDuplicate: false };
  }

  /**
   * Normaliza título para comparação (remove caracteres especiais, lowercase)
   */
  private normalizeTitle(title: string): string {
    return title.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  /**
   * Extrai externalId do metadata baseado no tipo
   */
  private extractExternalId(type: ItemType, metadata?: ItemMetadata): string | undefined {
    if (!metadata) return undefined;

    switch (type) {
      case 'movie':
      case 'tv_show':
        return (metadata as any).tmdb_id?.toString();
      case 'video':
        return (metadata as any).video_id;
      case 'link':
        // Normaliza URL removendo protocolo e www
        const url = (metadata as any).url;
        return url?.replace(/^https?:\/\/(www\.)?/, '').toLowerCase();
      default:
        return undefined;
    }
  }

  /**
   * Cria nova memória (com validação de duplicata)
   * Retorna { item, isDuplicate, existingItem }
   */
  async createItem(params: {
    userId: string;
    type: ItemType;
    title: string;
    metadata?: ItemMetadata;
    skipDuplicateCheck?: boolean;
  }): Promise<{
    item: any;
    isDuplicate: boolean;
    existingItem?: DuplicateCheckResult['existingItem'];
  }> {
    const { userId, type, title, metadata, skipDuplicateCheck = false } = params;
    
    // Extrai externalId do metadata
    const externalId = this.extractExternalId(type, metadata);

    // Valida duplicata (DRY: reutiliza checkDuplicate)
    if (!skipDuplicateCheck) {
      const duplicateCheck = await this.checkDuplicate({
        userId,
        type,
        externalId,
        title,
      });

      if (duplicateCheck.isDuplicate) {
        return {
          item: null,
          isDuplicate: true,
          existingItem: duplicateCheck.existingItem,
        };
      }
    }

    // Cria nova memória
    const [item] = await db
      .insert(memoryItems)
      .values({
        userId,
        type,
        title,
        externalId,
        metadata,
      })
      .returning();

    return { item, isDuplicate: false };
  }

  /**
   * Lista memórias do usuário
   */
  async listItems(params: { userId: string; type?: ItemType; limit?: number }) {
    const { userId, type, limit = 20 } = params;

    const conditions = [eq(memoryItems.userId, userId)];
    if (type) {
      conditions.push(eq(memoryItems.type, type));
    }

    return await db
      .select()
      .from(memoryItems)
      .where(and(...conditions))
      .orderBy(desc(memoryItems.createdAt))
      .limit(limit);
  }

  /**
   * Busca memória por ID
   */
  async getItemById(itemId: string, userId: string) {
    const [item] = await db
      .select()
      .from(memoryItems)
      .where(and(eq(memoryItems.id, itemId), eq(memoryItems.userId, userId)))
      .limit(1);

    return item;
  }

  /**
   * Busca semântica
   */
  async searchItems(params: { userId: string; query: string; limit?: number }) {
    const { userId, query, limit = 10 } = params;

    return await db
      .select()
      .from(memoryItems)
      .where(
        and(
          eq(memoryItems.userId, userId),
          sql`LOWER(${memoryItems.title}) LIKE LOWER(${"%" + query + "%"})`
        )
      )
      .orderBy(desc(memoryItems.createdAt))
      .limit(limit);
  }

  /**
   * Wrapper para buscar memórias do usuário (compatível com tool calling)
   */
  async getUserItems(userId: string, query?: string, type?: string, limit: number = 10) {
    if (query) {
      return this.searchItems({ userId, query, limit });
    }
    
    return this.listItems({ 
      userId, 
      type: type as ItemType | undefined, 
      limit 
    });
  }

  /**
   * Deleta memória
   */
  async deleteItem(itemId: string, userId: string) {
    await db
      .delete(memoryItems)
      .where(and(eq(memoryItems.id, itemId), eq(memoryItems.userId, userId)));
  }
}

export const itemService = new ItemService();
