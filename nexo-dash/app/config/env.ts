import { z } from 'zod';

const envSchema = z.object({
	// Better Auth
	BETTER_AUTH_SECRET: z.string().min(1, 'BETTER_AUTH_SECRET required'),
	BETTER_AUTH_URL: z.string().url(),
	NUXT_PUBLIC_AUTH_BASE_URL: z.string().url(),

	// API
	NUXT_PUBLIC_API_URL: z.string().url(),

	// Google OAuth
	GOOGLE_CLIENT_ID: z.string().optional(),
	GOOGLE_CLIENT_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
