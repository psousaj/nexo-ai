import { jsonb, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';

export const providerKeys = pgTable('provider_keys', {
	provider: varchar('provider', { length: 50 }).primaryKey(),
	encryptedKey: text('encrypted_key').notNull(),
	keyFingerprint: text('key_fingerprint'),
	config: jsonb('config').$type<Record<string, string>>().default({}),
	createdAt: timestamp('created_at').defaultNow(),
	updatedAt: timestamp('updated_at').defaultNow(),
});
