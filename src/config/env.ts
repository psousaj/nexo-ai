import { z } from "zod";

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // Supabase (opcional, se usar Supabase diretamente)
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  // Meta WhatsApp API
  META_WHATSAPP_TOKEN: z.string(),
  META_WHATSAPP_PHONE_NUMBER_ID: z.string(),
  META_VERIFY_TOKEN: z.string(),
  META_BUSINESS_ACCOUNT_ID: z.string().optional(),

  // AI
  ANTHROPIC_API_KEY: z.string(),

  // Enrichment APIs
  TMDB_API_KEY: z.string(),
  YOUTUBE_API_KEY: z.string(),

  // Application
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  PORT: z.string().default("3000"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error("❌ Erro na validação das variáveis de ambiente:");
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error("Variáveis de ambiente inválidas");
  }

  return parsed.data;
}

export const env = validateEnv();
