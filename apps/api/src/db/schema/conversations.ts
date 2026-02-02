import { pgTable, uuid, text, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { messages } from "./messages";
import type { ConversationState, ConversationContext } from "@/types";

export const conversations = pgTable("conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  state: text("state").$type<ConversationState>().default("idle").notNull(),
  context: jsonb("context").$type<ConversationContext>(),
  closeAt: timestamp("close_at"), // Timestamp para auto-fechamento
  closeJobId: text("close_job_id"), // ID do job no Bull para cancelamento O(1)
  isActive: boolean("is_active").default(true).notNull(), // Apenas 1 conversa ativa por usuário
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const conversationsRelations = relations(
  conversations,
  ({ one, many }) => ({
    user: one(users, {
      fields: [conversations.userId],
      references: [users.id],
    }),
    messages: many(messages),
  })
);
