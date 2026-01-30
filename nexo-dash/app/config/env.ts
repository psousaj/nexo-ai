import { z } from 'zod';

const envSchema = z.object({
	// Better Auth - Frontend only needs the base URL
	NUXT_PUBLIC_AUTH_BASE_URL: z.string().url(),

	// API
	NUXT_PUBLIC_API_URL: z.string().url(),
});

export type Env = z.infer<typeof envSchema>;

// We must access process.env.KEY explicitely so the bundler can replace it
// because process.env is usually empty in the browser
const values = {
	NUXT_PUBLIC_AUTH_BASE_URL: process.env.NUXT_PUBLIC_AUTH_BASE_URL,
	NUXT_PUBLIC_API_URL: process.env.NUXT_PUBLIC_API_URL,
};

export const env = envSchema.parse(values);
