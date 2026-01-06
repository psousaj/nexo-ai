# Setup & Deploy

## Environment Variables

### Arquivo `.env`

```env
# Database (Supabase)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:5432/postgres

# WhatsApp (Meta API)
META_WHATSAPP_TOKEN=EAAxxxx
META_WHATSAPP_PHONE_NUMBER_ID=123456789012345
META_VERIFY_TOKEN=seu_token_secreto
META_BUSINESS_ACCOUNT_ID=123456789012345

# AI (Claude)
ANTHROPIC_API_KEY=sk-ant-api03-xxxx

# Enrichment APIs
TMDB_API_KEY=xxxx
YOUTUBE_API_KEY=AIzaSyXXXX

# Application
NODE_ENV=development
APP_URL=http://localhost:3000
LOG_LEVEL=info
```

### Obter Credenciais

| Serviço           | URL                                                                    | Instruções                          |
| ----------------- | ---------------------------------------------------------------------- | ----------------------------------- |
| **Supabase**      | [supabase.com](https://supabase.com)                                   | Settings > API > copiar keys        |
| **Meta WhatsApp** | [developers.facebook.com](https://developers.facebook.com)             | Criar App > WhatsApp > obter tokens |
| **Claude**        | [console.anthropic.com](https://console.anthropic.com)                 | API Keys > Create Key               |
| **TMDB**          | [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) | Request API Key (grátis)            |
| **YouTube**       | [console.cloud.google.com](https://console.cloud.google.com)           | Enable YouTube Data API v3          |

## Deploy - Cloudflare Workers

### 1. Configurar Secrets

```bash
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put META_WHATSAPP_TOKEN
wrangler secret put TMDB_API_KEY
wrangler secret put YOUTUBE_API_KEY
```

### 2. Deploy

```bash
wrangler deploy
```

### 3. Configurar Webhook WhatsApp

- URL: `https://seu-worker.workers.dev/webhook/meta`
- Verify Token: (seu `META_VERIFY_TOKEN`)

## Troubleshooting

**Erro: "Module not found"**

- Verifique `wrangler.toml` compatibility flags
- Rode `bun install` novamente

**Timeout em produção**

- Cloudflare Workers: 50ms CPU (free) / 30s (paid)
- Use `waitUntil()` para operações async

**Database connection issues**

- Supabase pooler: `pgbouncer` mode para serverless
- Connection string deve usar port `6543`
