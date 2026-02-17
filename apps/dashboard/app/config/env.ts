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
	// Port (opcional)
	PORT_DASHBOARD: z.coerce.number().optional(),
});

export type DashboardEnv = z.infer<typeof dashboardEnvSchema>;

// Não valida no import (lazy), apenas retorna valores com fallbacks seguros
export const env = {
	NUXT_PUBLIC_AUTH_BASE_URL: process.env.NUXT_PUBLIC_AUTH_BASE_URL || 'http://localhost:3001',
	NUXT_PUBLIC_API_URL: process.env.NUXT_PUBLIC_API_URL || 'http://localhost:3001/api',
	BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || 'dev-secret-min-32-chars-long-12345',
	BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || 'http://localhost:3001',
	DATABASE_URL: process.env.DATABASE_URL,
	PORT_DASHBOARD: Number.parseInt(process.env.PORT_DASHBOARD || '5173', 10),
} satisfies DashboardEnv;

// Helper para pegar variáveis públicas no client-side do Nuxt
export function getPublicEnv() {
	return {
		authBaseUrl: import.meta.env.NUXT_PUBLIC_AUTH_BASE_URL || 'http://localhost:3001',
		apiUrl: import.meta.env.NUXT_PUBLIC_API_URL || 'http://localhost:3001/api',
	};
}
