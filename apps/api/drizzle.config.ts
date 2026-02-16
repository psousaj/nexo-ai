import { env } from '@nexo/env';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: './src/db/schema/index.ts',
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: {
		url: env.DATABASE_URL,
	},
	verbose: true,
});
