import { z } from 'zod';

const envSchema = z.object({
	// Better Auth - Frontend only needs the base URL
	NUXT_PUBLIC_AUTH_BASE_URL: z.string().url(),

	// API
	NUXT_PUBLIC_API_URL: z.string().url(),

	// Config
	PORT: z.coerce.number().default(3004),
});

export type Env = z.infer<typeof envSchema>;

// Only parse on server side to avoid client-side validation errors
export const env = (import.meta.server ? envSchema.parse(process.env) : {}) as Env;
