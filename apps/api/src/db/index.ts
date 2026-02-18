import * as schema from '@/db/schema';
import { loggers } from '@/utils/logger';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../config/env';

const client = postgres(env.DATABASE_URL, {
	prepare: false,
	onnotice: (notice) => loggers.db.warn({ notice }, '⚠️ Postgres notice'),
	onclose: () => loggers.db.warn('⚠️ Postgres connection closed unexpectedly'),
});

export const db = drizzle(client, { schema });

export type Database = typeof db;
