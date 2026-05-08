import { z } from 'zod';

/**
 * @nexo/env - Pacote centralizado de variáveis de ambiente
 *
 * Dev: dotenv carrega .env da raiz do monorepo (via -r dotenv/config no tsx)
 * Prod: process.env já vem preenchido pelo runtime (Railway, Docker, etc)
 */

const boolFromEnv = z.enum(['true', 'false']).transform((val) => val === 'true');

// ============================================================================
// SCHEMA MONOLÍTICO — valida todas as variáveis de uma vez
// ============================================================================
// Nota: em vez de validar por-app, o schema é único para garantir que
// qualquer processo que precise de uma var tenha ela disponível via proxy.
// Apps consomem subsets via getApiEnv(), getDashboardEnv(), getLandingEnv().

const envSchema = z.object({
	// --------------------------------------------------------------------------
	// Core — runtime básico
	// --------------------------------------------------------------------------
	NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
	LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('debug'),

	// --------------------------------------------------------------------------
	// HTTP — ports por app
	// --------------------------------------------------------------------------
	PORT: z.coerce.number().default(3001),
	PORT_DASHBOARD: z.coerce.number().default(5173),
	PORT_LANDING: z.coerce.number().default(3005),
	APP_URL: z.string().url().optional(),
	DASHBOARD_URL: z.string().url().optional(),
	CORS_ORIGINS: z
		.string()
		.optional()
		.transform((val) => {
			return (
				val
					?.trim()
					.split(',')
					.map((origin) => origin.trim()) ?? []
			);
		}),
	COOKIE_DOMAIN: z.string().optional(),

	// --------------------------------------------------------------------------
	// Database
	// --------------------------------------------------------------------------
	DATABASE_URL: z.string().url(),

	// --------------------------------------------------------------------------
	// Redis — opcional (BullMQ queues desativadas)
	// --------------------------------------------------------------------------
	REDIS_HOST: z.string().optional(),
	REDIS_PORT: z.coerce.number().optional(),
	REDIS_USER: z.string().optional(),
	REDIS_PASSWORD: z.string().optional(),
	REDIS_TLS: boolFromEnv.optional(),

	// --------------------------------------------------------------------------
	// Feature flags (pivot — defaults only, overridden via DB)
	// --------------------------------------------------------------------------
	CONVERSATION_FREE: boolFromEnv.default('true'),
	TOOL_SCHEMA_V2: boolFromEnv.default('false'),
	MULTIMODAL_AUDIO: boolFromEnv.default('false'),
	MULTIMODAL_IMAGE: boolFromEnv.default('false'),

	// --------------------------------------------------------------------------
	// Nuxt Dashboard (frontend - public vars)
	// --------------------------------------------------------------------------
	NUXT_PUBLIC_AUTH_BASE_URL: z.string().url().optional(),
	NUXT_PUBLIC_API_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

// ============================================================================
// SUBSETS POR APP
// ============================================================================

export const API_ENV_KEYS = [
	'NODE_ENV',
	'PORT',
	'CORS_ORIGINS',
	'LOG_LEVEL',
] as const;

export type ApiEnv = Pick<Env, (typeof API_ENV_KEYS)[number]>;

export function getApiEnv(source: Env = env): ApiEnv {
	return {
		NODE_ENV: source.NODE_ENV,
		PORT: source.PORT,
		CORS_ORIGINS: source.CORS_ORIGINS,
		LOG_LEVEL: source.LOG_LEVEL,
	};
}

export const DASHBOARD_ENV_KEYS = [
	'NODE_ENV',
	'PORT_DASHBOARD',
	'DASHBOARD_URL',
	'NUXT_PUBLIC_AUTH_BASE_URL',
	'NUXT_PUBLIC_API_URL',
	'BETTER_AUTH_URL',
	'BETTER_AUTH_SECRET',
	'GOOGLE_CLIENT_ID',
	'GOOGLE_CLIENT_SECRET',
	'MICROSOFT_CLIENT_ID',
	'MICROSOFT_CLIENT_SECRET',
	'DISCORD_CLIENT_ID',
	'DISCORD_CLIENT_SECRET',
] as const;

export type DashboardEnv = Pick<Env, (typeof DASHBOARD_ENV_KEYS)[number]>;

export function getDashboardEnv(source: Env = env): DashboardEnv {
	return {
		NODE_ENV: source.NODE_ENV,
		PORT_DASHBOARD: source.PORT_DASHBOARD,
		DASHBOARD_URL: source.DASHBOARD_URL,
		NUXT_PUBLIC_AUTH_BASE_URL: source.NUXT_PUBLIC_AUTH_BASE_URL,
		NUXT_PUBLIC_API_URL: source.NUXT_PUBLIC_API_URL,
		BETTER_AUTH_URL: source.BETTER_AUTH_URL,
		BETTER_AUTH_SECRET: source.BETTER_AUTH_SECRET,
		GOOGLE_CLIENT_ID: source.GOOGLE_CLIENT_ID,
		GOOGLE_CLIENT_SECRET: source.GOOGLE_CLIENT_SECRET,
		MICROSOFT_CLIENT_ID: source.MICROSOFT_CLIENT_ID,
		MICROSOFT_CLIENT_SECRET: source.MICROSOFT_CLIENT_SECRET,
		DISCORD_CLIENT_ID: source.DISCORD_CLIENT_ID,
		DISCORD_CLIENT_SECRET: source.DISCORD_CLIENT_SECRET,
	};
}

export const LANDING_ENV_KEYS = ['NODE_ENV', 'PORT_LANDING', 'APP_URL', 'DASHBOARD_URL'] as const;

export type LandingEnv = Pick<Env, (typeof LANDING_ENV_KEYS)[number]>;

export function getLandingEnv(source: Env = env): LandingEnv {
	return {
		NODE_ENV: source.NODE_ENV,
		PORT_LANDING: source.PORT_LANDING,
		APP_URL: source.APP_URL,
		DASHBOARD_URL: source.DASHBOARD_URL,
	};
}

// ============================================================================
// VALIDAÇÃO
// ============================================================================

let cachedEnv: Env | null = null;

export function validateEnv(): Env {
	if (cachedEnv) {
		return cachedEnv;
	}

	const parsed = envSchema.safeParse(process.env);

	if (!parsed.success) {
		console.error('❌ Erro na validação das variáveis de ambiente:');
		console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
		throw new Error('Variáveis de ambiente inválidas');
	}

	cachedEnv = parsed.data;
	return parsed.data;
}

// Não valida automaticamente no import - espera que app chame validateEnv()
// ou acesse env (que usa lazy getter)
let _lazyEnv: Env | null = null;
export const env: Env = new Proxy({} as Env, {
	get(_target, prop: string) {
		if (!_lazyEnv) {
			_lazyEnv = validateEnv();
		}
		return (_lazyEnv as any)[prop];
	},
});
