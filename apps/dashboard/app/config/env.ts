// Re-export do pacote centralizado @nexo/env
export { env, validateEnv, type Env } from '@nexo/env';

// Helper para pegar variáveis públicas no client-side do Nuxt
export function getPublicEnv() {
	return {
		authBaseUrl: import.meta.env.NUXT_PUBLIC_AUTH_BASE_URL,
		apiUrl: import.meta.env.NUXT_PUBLIC_API_URL,
	};
}
