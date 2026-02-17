import { z } from 'zod';

// Schema apenas para variáveis do Dashboard (não valida tudo)
const dashboardEnvSchema = z.object({
	// Public runtime vars (acessíveis via useRuntimeConfig)
	NUXT_PUBLIC_AUTH_BASE_URL: z.string().url().optional(),
	NUXT_PUBLIC_API_URL: z.string().url().optional(),
	// Better Auth (usado no server-side do Nuxt)
	BETTER_AUTH_SECRET: z.string().min(32).optional(),
	BETTER_AUTH_URL: z.string().url().optional(),
	// Database (opcional, pode não usar em dev)
	DATABASE_URL: z.string().url().optional(),
});

export type DashboardEnv = z.infer<typeof dashboardEnvSchema>;

// Validação relaxada (não falha se vars opcionais faltarem)
export const env = dashboardEnvSchema.parse(process.env) as DashboardEnv;

// Helper para pegar variáveis públicas no client-side do Nuxt
export function getPublicEnv() {
	return {
		authBaseUrl: import.meta.env.NUXT_PUBLIC_AUTH_BASE_URL || 'http://localhost:3001',
		apiUrl: import.meta.env.NUXT_PUBLIC_API_URL || 'http://localhost:3001',
	};
}
