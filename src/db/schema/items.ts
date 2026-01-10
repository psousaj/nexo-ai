import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import type { ItemMetadata, ItemType } from "@/types";

/**
 * Memory Items - Memórias únicas do usuário
 * Filmes, séries, vídeos, links, notas, etc.
 */
export const memoryItems = pgTable(
  "memory_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<ItemType>().notNull(),
    title: text("title").notNull(),
    /** Identificador único externo (tmdb_id, video_id, url normalizada) */
    externalId: text("external_id"),
    metadata: jsonb("metadata").$type<ItemMetadata>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("memory_items_user_id_idx").on(table.userId),
    typeIdx: index("memory_items_type_idx").on(table.type),
    metadataIdx: index("memory_items_metadata_idx").using("gin", table.metadata),
    // Índice único: mesmo usuário não pode ter duplicata do mesmo externalId+type
    uniqueExternalIdx: uniqueIndex("memory_items_unique_external_idx").on(
      table.userId,
      table.type,
      table.externalId
    ),
  })
);

// Alias para compatibilidade (deprecado)
export const items = memoryItems;

export const memoryItemsRelations = relations(memoryItems, ({ one }) => ({
  user: one(users, {
    fields: [memoryItems.userId],
    references: [users.id],
  }),
}));

// Alias para compatibilidade
export const itemsRelations = memoryItemsRelations;
