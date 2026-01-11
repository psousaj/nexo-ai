# Setup & Deploy

## Environment Variables

### Arquivo `.env`

```env
# Database (Supabase)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:5432/postgres

# Telegram Bot (PADRÃO)
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_WEBHOOK_SECRET=seu_secret_opcional

# WhatsApp (OPCIONAL - Feature futura)
# META_WHATSAPP_TOKEN=EAAxxxx
# META_WHATSAPP_PHONE_NUMBER_ID=123456789012345
# META_VERIFY_TOKEN=seu_token_secreto
# META_BUSINESS_ACCOUNT_ID=123456789012345

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

| Serviço           | URL                                                                    | Instruções                               |
| ----------------- | ---------------------------------------------------------------------- | ---------------------------------------- |
| **Supabase**      | [supabase.com](https://supabase.com)                                   | Settings > API > copiar keys             |
| **Telegram**      | [@BotFather](https://t.me/BotFather) no Telegram                       | `/newbot` > copiar token                 |
| **Meta WhatsApp** | [developers.facebook.com](https://developers.facebook.com)             | (Opcional) Criar App > WhatsApp > tokens |
| **Claude**        | [console.anthropic.com](https://console.anthropic.com)                 | API Keys > Create Key                    |
| **TMDB**          | [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) | Request API Key (grátis)                 |
| **YouTube**       | [console.cloud.google.com](https://console.cloud.google.com)           | Enable YouTube Data API v3               |

## Setup Telegram Bot

### 1. Criar Bot

1. Abra [@BotFather](https://t.me/BotFather) no Telegram
2. Envie `/newbot`
3. Escolha nome e username
4. Copie o token fornecido para `TELEGRAM_BOT_TOKEN`

### 2. Configurar Webhook

Após deploy, configure o webhook:

```bash
curl -X POST "https://api.telegram.org/bot<SEU_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://sua-api.workers.dev/webhook/telegram",
    "secret_token": "seu_secret_opcional"
  }'
```

Ou use o método `setWebhook()` do `TelegramAdapter`.

## Setup WhatsApp (Opcional)

Se quiser ativar WhatsApp no futuro:

### 1. Criar App Meta

1. Acesse [developers.facebook.com](https://developers.facebook.com)
2. Criar App > Business
3. Adicionar produto "WhatsApp"
4. Obter tokens e configurar

### 2. Configurar Webhook

```
URL: https://sua-api.workers.dev/webhook/whatsapp
Verify Token: (seu META_VERIFY_TOKEN)
```

## Deploy - Cloudflare Workers

### 1. Configurar Secrets

```bash
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put TELEGRAM_BOT_TOKEN
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
