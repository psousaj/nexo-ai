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

export function validateEnv() {
	if (process.env.SKIP_ENV_VALIDATION) return;

	const parsed = envSchema.safeParse(process.env);

	if (!parsed.success) {
		console.error('❌ Environment Validation Failed:', parsed.error.flatten().fieldErrors);
		throw new Error('Invalid environment variables');
	}

	return parsed.data;
}

// Side-effect: validate on import if strictly required,
// but often better to call explicitly in nuxt.config.ts
// export const env = validateEnv()
