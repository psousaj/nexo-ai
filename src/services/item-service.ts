import { db } from "@/config/database";
import { items } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import type { ItemType, ItemMetadata } from "@/types";

export class ItemService {
  /**
   * Cria novo item
   */
  async createItem(params: {
    userId: string;
    type: ItemType;
    title: string;
    metadata?: ItemMetadata;
  }) {
    const [item] = await db
      .insert(items)
      .values({
        userId: params.userId,
        type: params.type,
        title: params.title,
        metadata: params.metadata,
      })
      .returning();

    return item;
  }

  /**
   * Lista items do usuário
   */
  async listItems(params: { userId: string; type?: ItemType; limit?: number }) {
    const { userId, type, limit = 20 } = params;

    let query = db
      .select()
      .from(items)
      .where(eq(items.userId, userId))
      .orderBy(desc(items.createdAt))
      .limit(limit);

    if (type) {
      query = db
        .select()
        .from(items)
        .where(and(eq(items.userId, userId), eq(items.type, type)))
        .orderBy(desc(items.createdAt))
        .limit(limit);
    }

    return await query;
  }

  /**
   * Busca item por ID
   */
  async getItemById(itemId: string, userId: string) {
    const [item] = await db
      .select()
      .from(items)
      .where(and(eq(items.id, itemId), eq(items.userId, userId)))
      .limit(1);

    return item;
  }

  /**
   * Busca semântica (placeholder - implementar com vector search futuramente)
   */
  async searchItems(params: { userId: string; query: string; limit?: number }) {
    const { userId, query, limit = 10 } = params;

    // Por enquanto, busca simples no título
    const results = await db
      .select()
      .from(items)
      .where(
        and(
          eq(items.userId, userId),
          sql`LOWER(${items.title}) LIKE LOWER(${"%" + query + "%"})`
        )
      )
      .orderBy(desc(items.createdAt))
      .limit(limit);

    return results;
  }

  /**
   * Deleta item
   */
  async deleteItem(itemId: string, userId: string) {
    await db
      .delete(items)
      .where(and(eq(items.id, itemId), eq(items.userId, userId)));
  }
}

export const itemService = new ItemService();
