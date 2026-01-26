import 'dotenv/config';
import { z } from 'zod';
import { logger } from '@/utils/logger';

const envSchema = z.object({
	// Database
	DATABASE_URL: z.string().url(),

	// Supabase (opcional, se usar Supabase diretamente)
	SUPABASE_URL: z.string().url().optional(),
	SUPABASE_ANON_KEY: z.string().optional(),
	SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

	// Telegram Bot API (PADRÃO)
	TELEGRAM_BOT_TOKEN: z.string(),
	TELEGRAM_BOT_USERNAME: z.string().optional(),
	TELEGRAM_WEBHOOK_SECRET: z.string().optional(),

	// Meta WhatsApp API (OPCIONAL - Feature futura)
	META_WHATSAPP_TOKEN: z.string().optional(),
	META_WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
	META_WHATSAPP_APP_SECRET: z.string().optional(), // Para validação de signature
	META_VERIFY_TOKEN: z.string().optional(),
	META_BUSINESS_ACCOUNT_ID: z.string().optional(),

	// AI (pelo menos um provider deve estar configurado)
	// Cloudflare Workers AI (default)
	CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
	CLOUDFLARE_API_TOKEN: z.string().optional(),
	// Outros providers
	GOOGLE_API_KEY: z.string().optional(),

	// Observability
	UPTRACE_DSN: z.string().optional(),

	// Enrichment APIs
	TMDB_API_KEY: z.string(),
	YOUTUBE_API_KEY: z.string(),

	// Cache - Upstash Redis
	UPSTASH_REDIS_URL: z.string().url().optional(),
	UPSTASH_REDIS_TOKEN: z.string().optional(),

	// Redis (para Bull queue) - OBRIGATÓRIO
	REDIS_HOST: z.string().min(1, 'REDIS_HOST é obrigatório'),
	REDIS_PORT: z.coerce.number().default(6379),
	REDIS_USER: z.string().min(1, 'REDIS_USER é obrigatório'),
	REDIS_PASSWORD: z.string().min(1, 'REDIS_PASSWORD é obrigatório'),
	REDIS_TLS: z
		.enum(['true', 'false'])
		.transform((val) => val === 'true')
		.default('false'),

	// Observability - New Relic (opcional em dev, obrigatório em prod se habilitado)
	NEW_RELIC_LICENSE_KEY: z.string().optional(),
	NEW_RELIC_APP_NAME: z.string().default('nexo-ai'),
	NEW_RELIC_ENABLED: z
		.enum(['true', 'false'])
		.transform((val) => val === 'true')
		.default('false'),

	// Application
	NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
	APP_URL: z.string().url(),
	DASHBOARD_URL: z.string().url(),
	// Railway atribui porta aleatória via PORT env var
	PORT: z.coerce.number().default(3000),
	LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('debug'),

	// Email Reporting (Resend)
	RESEND_API_KEY: z.string().optional(),
	ADMIN_EMAIL: z.string().email().optional(),

	// Discord OAuth2 (gerenciado pelo Better Auth)
	DISCORD_CLIENT_ID: z.string().optional(),
	DISCORD_CLIENT_SECRET: z.string().optional(),

	// Better Auth
	BETTER_AUTH_SECRET: z.string().min(32),
	BETTER_AUTH_URL: z.string().url(),

	// Google OAuth
	GOOGLE_CLIENT_ID: z.string().optional(),
	GOOGLE_CLIENT_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
	const parsed = envSchema.safeParse(process.env);

	if (!parsed.success) {
		logger.error({ errors: parsed.error.flatten().fieldErrors }, 'Erro na validação das variáveis de ambiente');
		throw new Error('Variáveis de ambiente inválidas');
	}

	return parsed.data;
}

export const env = validateEnv();
