import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import type { ItemMetadata, ItemType } from "@/types";

export const items = pgTable(
  "items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<ItemType>().notNull(),
    title: text("title").notNull(),
    metadata: jsonb("metadata").$type<ItemMetadata>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("items_user_id_idx").on(table.userId),
    typeIdx: index("items_type_idx").on(table.type),
    metadataIdx: index("items_metadata_idx").using("gin", table.metadata),
  })
);

export const itemsRelations = relations(items, ({ one }) => ({
  user: one(users, {
    fields: [items.userId],
    references: [users.id],
  }),
}));
