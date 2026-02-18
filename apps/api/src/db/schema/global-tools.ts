import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Tools globalmente habilitadas/desabilitadas
 * 
 * Sistema de feature flags: Admin pode habilitar/desabilitar tools para TODOS os usuários
 * 
 * ADR-019: Pluggable Tools System with CASL Protection
 */
export const globalTools = pgTable(
	'global_tools',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		toolName: text('tool_name').notNull().unique(), // 'save_note', 'save_movie', etc
		enabled: boolean('enabled').default(true).notNull(),
		category: text('category').notNull(), // 'system' | 'user'
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull(),
	},
	(table) => ({
		// Índice único: toolName deve ser único
		toolNameIdx: index('global_tools_tool_name_idx').on(table.toolName),
		// Índice para busca por categoria
		categoryIdx: index('global_tools_category_idx').on(table.category),
	}),
);

export type GlobalTool = typeof globalTools.$inferSelect;
export type NewGlobalTool = typeof globalTools.$inferInsert;
