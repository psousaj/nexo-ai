import { z } from "zod";

/**
 * @nexo/env - Pacote centralizado de variáveis de ambiente
 *
 * Dev: dotenv carrega .env da raiz do monorepo (via -r dotenv/config no tsx)
 * Prod: process.env já vem preenchido pelo runtime (Railway, Docker, etc)
 *
 * Não faz hack de path relativo — quem carrega o .env é o runner (tsx, node, etc)
 */

const boolFromEnv = z
  .enum(["true", "false"])
  .transform((val) => val === "true");

const botsEnvShape = {
  BOTS_PORT: z.coerce.number().int().min(1).max(65535).default(3030),
  BOTS_CONFIG_PULL_URL: z.string().url().optional(),
  BOTS_CONFIG_PULL_TOKEN: z.string().optional(),
  BOTS_CONFIG_REFRESH_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(300000)
    .default(30000),
  BOTS_CONFIG_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(500)
    .max(60000)
    .default(3000),
} as const;

const botsRuntimeEnvSchema = z.object({
  PROVIDER_SPLIT: boolFromEnv.default("false"),
  DISCORD_BOT_TOKEN: z.string().optional(),
  ...botsEnvShape,
});

export type BotsRuntimeEnv = z.infer<typeof botsRuntimeEnvSchema>;

export function parseBotsRuntimeEnv(
  source: Record<string, unknown> = process.env,
): BotsRuntimeEnv {
  const parsed = botsRuntimeEnvSchema.safeParse(source);

  if (!parsed.success) {
    console.error("❌ Erro na validação das variáveis de ambiente dos Bots:");
    console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
    throw new Error("Variáveis de ambiente dos Bots inválidas");
  }

  return parsed.data;
}

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // Supabase (opcional, se usar Supabase diretamente)
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  // Telegram Bot API (PADRÃO)
  // Opcional no schema global para permitir runtimes sem adapter Telegram ativo.
  TELEGRAM_BOT_TOKEN: z.string().default(""),
  TELEGRAM_BOT_USERNAME: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),

  // Evolution API (WhatsApp self-hosted)
  EVOLUTION_API_BASE_URL: z.string().url().default("http://localhost:8080"),
  EVOLUTION_API_KEY: z.string().optional(),
  EVOLUTION_INSTANCE_NAME: z.string().default("nexo-dev"),
  EVOLUTION_WEBHOOK_SECRET: z.string().optional(),
  EVOLUTION_WEBHOOK_PATH: z.string().default("/webhook/whatsapp/evolution"),

  // Cloudflare AI Gateway (obrigatório)
  CLOUDFLARE_ACCOUNT_ID: z.string().min(1),
  CLOUDFLARE_API_TOKEN: z.string().min(1),
  CLOUDFLARE_GATEWAY_ID: z.string().default("nexo-ai-gateway"),
  CF_GATEWAY_MODEL: z.string().default("dynamic/nexo"),
  CF_INTENT_MODEL: z.string().default("dynamic/nexo"),
  CF_EMBED_MODEL: z.string().default("dynamic/embeddings"),
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

  // Observability
  UPTRACE_DSN: z.string().optional(),
  // OTLP collector endpoint (traces). Default aponta pro Jaeger local.
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default("http://localhost:4317"),
  OTEL_SERVICE_NAME: z.string().optional(),
  // Jaeger UI URL para acesso em dev/local (apenas informativo no log de init)
  JAEGER_UI_URL: z.string().default("http://localhost:16686"),
  // Langfuse - AI Observability
  LANGFUSE_PUBLIC_KEY: z.string().optional(),
  LANGFUSE_SECRET_KEY: z.string().optional(),
  LANGFUSE_HOST: z.string().optional(),
  LANGFUSE_BASE_URL: z.string().optional(),
  LANGFUSE_PROMPT_NAME: z.string().optional(),
  LANGFUSE_PROMPT_LABEL: z.string().optional(),
  // Sentry - Error tracking & Sourcemaps
  SENTRY_ENABLED: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .default("true"),
  SENTRY_DSN: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().default(0.1),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  SENTRY_ORG: z.string().default("ze-filho"),
  SENTRY_PROJECT: z.string().default("node-hono"),

  // Enrichment APIs
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

  // Cache - Upstash Redis
  UPSTASH_REDIS_URL: z.string().url().optional(),
  UPSTASH_REDIS_TOKEN: z.string().optional(),

  // Redis (para Bull queue) - OBRIGATÓRIO
  REDIS_HOST: z.string().min(1, "REDIS_HOST é obrigatório"),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_USER: z.string().min(1, "REDIS_USER é obrigatório"),
  REDIS_PASSWORD: z.string().min(1, "REDIS_PASSWORD é obrigatório"),
  REDIS_TLS: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .default("false"),

  // Observability - New Relic (opcional em dev, obrigatório em prod se habilitado)
  NEW_RELIC_LICENSE_KEY: z.string().optional(),
  NEW_RELIC_APP_NAME: z.string().default("nexo-ai"),
  NEW_RELIC_ENABLED: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .default("false"),

  // Application
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  APP_URL: z.string().url().optional(),
  COOKIE_DOMAIN: z.string().optional(),
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
  DASHBOARD_URL: z.string().url().optional(),
  PORT: z.coerce.number().default(3001), // API na 3001
  ...botsEnvShape,
  PORT_DASHBOARD: z.coerce.number().default(5173), // Dashboard na 5173
  PORT_LANDING: z.coerce.number().default(3005), // Landing na 3005
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("debug"),

  // Pivot feature flags
  CONVERSATION_FREE: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .default("true"),
  TOOL_SCHEMA_V2: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .default("false"),
  MULTIMODAL_AUDIO: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .default("false"),
  MULTIMODAL_IMAGE: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .default("false"),
  PROVIDER_SPLIT: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .default("false"),
  ELYSIA_RUNTIME: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .default("false"),

  // Intake Worker
  INTAKE_WORKER_URL: z.string().url().default("http://localhost:3002"),
  INTAKE_WORKER_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(100)
    .max(60000)
    .default(4000),
  INTAKE_WORKER_TOKEN: z.string().optional(),

  // Email (Resend)
  RESEND_API_KEY: z.string().optional(),

  // Discord OAuth2 (gerenciado pelo Better Auth)
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),
  DISCORD_BOT_TOKEN: z.string().optional(),
  DISCORD_BOT_USERNAME: z.string().default("NexoAssistente_bot"),

  // Better Auth
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  BETTER_AUTH_URL: z.string().url().optional(),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Microsoft OAuth
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),

  // Nuxt Dashboard (frontend - public vars)
  NUXT_PUBLIC_AUTH_BASE_URL: z.string().url().optional(),
  NUXT_PUBLIC_API_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

export const BOTS_ENV_KEYS = [
  "PROVIDER_SPLIT",
  "DISCORD_BOT_TOKEN",
  "BOTS_PORT",
  "BOTS_CONFIG_PULL_URL",
  "BOTS_CONFIG_PULL_TOKEN",
  "BOTS_CONFIG_REFRESH_MS",
  "BOTS_CONFIG_TIMEOUT_MS",
] as const;

export type BotsEnv = Pick<Env, (typeof BOTS_ENV_KEYS)[number]>;

export function getBotsEnv(source: Env = env): BotsEnv {
  return {
    PROVIDER_SPLIT: source.PROVIDER_SPLIT,
    DISCORD_BOT_TOKEN: source.DISCORD_BOT_TOKEN,
    BOTS_PORT: source.BOTS_PORT,
    BOTS_CONFIG_PULL_URL: source.BOTS_CONFIG_PULL_URL,
    BOTS_CONFIG_PULL_TOKEN: source.BOTS_CONFIG_PULL_TOKEN,
    BOTS_CONFIG_REFRESH_MS: source.BOTS_CONFIG_REFRESH_MS,
    BOTS_CONFIG_TIMEOUT_MS: source.BOTS_CONFIG_TIMEOUT_MS,
  };
}

export const API_ENV_KEYS = [
  "NODE_ENV",
  "PORT",
  "CORS_ORIGINS",
  "LOG_LEVEL",
  "PROVIDER_SPLIT",
  "DISCORD_BOT_TOKEN",
  "BOTS_CONFIG_PULL_TOKEN",
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
    BOTS_CONFIG_PULL_TOKEN: source.BOTS_CONFIG_PULL_TOKEN,
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
