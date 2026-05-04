import { z } from "zod";

/**
 * @nexo/env - Pacote centralizado de variáveis de ambiente
 *
 * Dev: dotenv carrega .env da raiz do monorepo (via -r dotenv/config no tsx)
 * Prod: process.env já vem preenchido pelo runtime (Railway, Docker, etc)
 */

const boolFromEnv = z
  .enum(["true", "false"])
  .transform((val) => val === "true");

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
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("debug"),

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
          .split(",")
          .map((origin) => origin.trim()) ?? []
      );
    }),
  COOKIE_DOMAIN: z.string().optional(),

  // --------------------------------------------------------------------------
  // Database
  // --------------------------------------------------------------------------
  DATABASE_URL: z.string().url(),

  // --------------------------------------------------------------------------
  // Redis — obrigatório para BullMQ
  // --------------------------------------------------------------------------
  REDIS_HOST: z.string().min(1, "REDIS_HOST é obrigatório"),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_USER: z.string().min(1, "REDIS_USER é obrigatório"),
  REDIS_PASSWORD: z.string().min(1, "REDIS_PASSWORD é obrigatório"),
  REDIS_TLS: boolFromEnv.default("false"),

  // --------------------------------------------------------------------------
  // Telegram Bot
  // --------------------------------------------------------------------------
  TELEGRAM_BOT_TOKEN: z.string().default(""),
  TELEGRAM_BOT_USERNAME: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),

  // --------------------------------------------------------------------------
  // Evolution API (WhatsApp self-hosted)
  // --------------------------------------------------------------------------
  EVOLUTION_API_BASE_URL: z.string().url().default("http://localhost:8080"),
  EVOLUTION_API_KEY: z.string().optional(),
  EVOLUTION_INSTANCE_NAME: z.string().default("nexo-dev"),
  EVOLUTION_WEBHOOK_SECRET: z.string().optional(),
  EVOLUTION_WEBHOOK_PATH: z.string().default("/webhook/whatsapp/evolution"),

  // --------------------------------------------------------------------------
  // Cloudflare AI Gateway
  // --------------------------------------------------------------------------
  CLOUDFLARE_ACCOUNT_ID: z.string().min(1),
  CLOUDFLARE_API_TOKEN: z.string().min(1),
  CLOUDFLARE_GATEWAY_ID: z.string().default("nexo-ai-gateway"),
  CF_GATEWAY_MODEL: z.string().default("dynamic/nexo"),
  CF_INTENT_MODEL: z.string().default("dynamic/nexo"),
  CF_EMBED_MODEL: z.string().default("dynamic/embeddings"),
  WHISPER_MODEL: z.string().default("whisper-1"),
  EMBEDDING_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(10).default(4),
  EMBEDDING_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(120000)
    .default(25000),
  EMBEDDING_MAX_RETRIES: z.coerce.number().int().min(0).max(8).default(4),
  EMBEDDING_RETRY_BASE_DELAY_MS: z.coerce
    .number()
    .int()
    .min(100)
    .max(10000)
    .default(600),
  EMBEDDING_RETRY_MAX_DELAY_MS: z.coerce
    .number()
    .int()
    .min(500)
    .max(60000)
    .default(8000),

  // --------------------------------------------------------------------------
  // Observability — OpenTelemetry + Jaeger
  // --------------------------------------------------------------------------
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default("http://localhost:4317"),
  OTEL_SERVICE_NAME: z.string().optional(),
  JAEGER_UI_URL: z.string().default("http://localhost:16686"),

  // --------------------------------------------------------------------------
  // Observability — Sentry
  // --------------------------------------------------------------------------
  SENTRY_ENABLED: boolFromEnv.default("true"),
  SENTRY_DSN: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().default(0.1),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  SENTRY_ORG: z.string().default("ze-filho"),
  SENTRY_PROJECT: z.string().default("node-hono"),

  // --------------------------------------------------------------------------
  // Enrichment APIs
  // --------------------------------------------------------------------------
  TMDB_API_KEY: z.string(),
  YOUTUBE_API_KEY: z.string(),
  GOOGLE_BOOKS_API_KEY: z.string().optional(),
  SPOTIFY_CLIENT_ID: z
    .string()
    .min(1, "SPOTIFY_CLIENT_ID é obrigatório para save_music"),
  SPOTIFY_CLIENT_SECRET: z
    .string()
    .min(1, "SPOTIFY_CLIENT_SECRET é obrigatório para save_music"),
  BRAVE_SEARCH_API_KEY: z.string().optional(),

  // --------------------------------------------------------------------------
  // Feature flags (pivot)
  // --------------------------------------------------------------------------
  CONVERSATION_FREE: boolFromEnv.default("true"),
  TOOL_SCHEMA_V2: boolFromEnv.default("false"),
  MULTIMODAL_AUDIO: boolFromEnv.default("false"),
  MULTIMODAL_IMAGE: boolFromEnv.default("false"),
  PROVIDER_SPLIT: boolFromEnv.default("false"),

  // --------------------------------------------------------------------------
  // Email (Resend)
  // --------------------------------------------------------------------------
  RESEND_API_KEY: z.string().optional(),

  // --------------------------------------------------------------------------
  // Discord OAuth + Bot
  // --------------------------------------------------------------------------
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),
  DISCORD_BOT_TOKEN: z.string().optional(),
  DISCORD_BOT_USERNAME: z.string().default("NexoAssistente_bot"),

  // --------------------------------------------------------------------------
  // Better Auth
  // --------------------------------------------------------------------------
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  BETTER_AUTH_URL: z.string().url().optional(),

  // --------------------------------------------------------------------------
  // Google OAuth
  // --------------------------------------------------------------------------
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // --------------------------------------------------------------------------
  // Microsoft OAuth
  // --------------------------------------------------------------------------
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),

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
  "NODE_ENV",
  "PORT",
  "CORS_ORIGINS",
  "LOG_LEVEL",
  "PROVIDER_SPLIT",
  "DISCORD_BOT_TOKEN",
] as const;

export type ApiEnv = Pick<Env, (typeof API_ENV_KEYS)[number]>;

export function getApiEnv(source: Env = env): ApiEnv {
  return {
    NODE_ENV: source.NODE_ENV,
    PORT: source.PORT,
    CORS_ORIGINS: source.CORS_ORIGINS,
    LOG_LEVEL: source.LOG_LEVEL,
    PROVIDER_SPLIT: source.PROVIDER_SPLIT,
    DISCORD_BOT_TOKEN: source.DISCORD_BOT_TOKEN,
  };
}

export const DASHBOARD_ENV_KEYS = [
  "NODE_ENV",
  "PORT_DASHBOARD",
  "DASHBOARD_URL",
  "NUXT_PUBLIC_AUTH_BASE_URL",
  "NUXT_PUBLIC_API_URL",
  "BETTER_AUTH_URL",
  "BETTER_AUTH_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "MICROSOFT_CLIENT_ID",
  "MICROSOFT_CLIENT_SECRET",
  "DISCORD_CLIENT_ID",
  "DISCORD_CLIENT_SECRET",
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

export const LANDING_ENV_KEYS = [
  "NODE_ENV",
  "PORT_LANDING",
  "APP_URL",
  "DASHBOARD_URL",
] as const;

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
    console.error("❌ Erro na validação das variáveis de ambiente:");
    console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
    throw new Error("Variáveis de ambiente inválidas");
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
