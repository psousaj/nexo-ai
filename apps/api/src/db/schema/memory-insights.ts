import { relations } from 'drizzle-orm';
import { index, integer, pgEnum, pgTable, real, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Insight types — classifies the kind of derived insight
 */
export const insightTypeEnum = pgEnum('insight_type', [
	'pattern', // Recurring behavior detected
	'preference', // User taste/preference inferred
	'fact_inferred', // Fact derived from multiple memories
	'behavior', // Behavioral observation
]);

/**
 * Memory Insights — memória ativa/derivada (interpretada pela IA)
 *
 * Enquanto memory_items é log bruto (passivo), memory_insights é a camada
 * ativa: a IA transforma padrões em insights estruturados com confiança.
 *
 * Referência: proposta ChatGPT sobre "memória ativa (interpretada)"
 */
export const memoryInsights = pgTable(
	'memory_insights',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		// Tipo de insight
		insightType: insightTypeEnum('insight_type').notNull(),
		// Conteúdo estruturado
		content: text('content').notNull(), // "Usuário tem dificuldade com medicação"
		summary: text('summary'), // Versão curta pro system prompt
		// Confiança e relevância
		confidence: real('confidence').notNull(), // 0-1
		importance: real('importance').default(0.5).notNull(), // 0-1
		// Rastreabilidade
		derivedFrom: text('derived_from').array(), // memory_item IDs que geraram este insight
		source: text('source').default('inference').notNull(), // inference|user|system
		// Versionamento
		version: integer('version').default(1).notNull(),
<<<<<<< HEAD
=======
		/** ID do envelope canônico que originou este insight */
		sourceEnvelopeId: uuid('source_envelope_id'),
>>>>>>> development
		supersededBy: uuid('superseded_by'), // se foi atualizado por insight mais novo
		// Timestamps
		createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
		lastAccessedAt: timestamp('last_accessed_at', { mode: 'date' }), // para decay de relevância
	},
	(table) => ({
		userIdIdx: index('memory_insights_user_id_idx').on(table.userId),
		insightTypeIdx: index('memory_insights_type_idx').on(table.insightType),
		confidenceIdx: index('memory_insights_confidence_idx').on(table.confidence),
	}),
);

export const memoryInsightsRelations = relations(memoryInsights, ({ one }) => ({
	user: one(users, {
		fields: [memoryInsights.userId],
		references: [users.id],
	}),
}));
