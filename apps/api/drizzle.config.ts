import { resolve } from 'node:path';
import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Carrega .env da raiz do monorepo
config({
	path: resolve(__dirname, '../../.env'),
	override: true,
});

export default defineConfig({
	schema: './src/db/schema/index.ts',
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: {
		url: process.env.DATABASE_URL!,
	},
	verbose: true,
});
