# Railway Deploy - Nexo AI

## Deploy Automático

Railway detecta automaticamente o Dockerfile e faz deploy:

1. Conecte o repositório no Railway
2. Configure as variáveis de ambiente
3. Deploy automático a cada push

## Variáveis de Ambiente (Railway)

Configure no painel do Railway:

```bash
# Database
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Messaging
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=...
META_WHATSAPP_TOKEN=...
META_WHATSAPP_PHONE_NUMBER_ID=...
META_VERIFY_TOKEN=...
META_WHATSAPP_APP_SECRET=...

# AI
GOOGLE_API_KEY=...
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_API_TOKEN=...

# APIs
TMDB_API_KEY=...
YOUTUBE_API_KEY=...

# App Config
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
APP_URL=https://nexo-ai.up.railway.app
```

## Build & Deploy Local

```bash
# Build imagem
docker build -t nexo-ai .

# Rodar local
docker run -p 3000:3000 --env-file .env nexo-ai

# Testar
curl http://localhost:3000/health
```

## Railway CLI (Opcional)

```bash
# Instalar Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link projeto
railway link

# Deploy manual
railway up

# Ver logs
railway logs
```

## Configuração do Webhook

Após deploy, configure webhooks:

### Telegram

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://nexo-ai.up.railway.app/webhook/telegram"}'
```

### WhatsApp

No Meta Developer Portal:

- Callback URL: `https://nexo-ai.up.railway.app/webhook/whatsapp`
- Verify Token: (seu META_VERIFY_TOKEN)

## Health Check

Railway usa o HEALTHCHECK do Dockerfile automaticamente:

```
GET /health → {"status":"ok","timestamp":"..."}
```

## Troubleshooting

### Logs

```bash
railway logs --tail
```

### Restart

```bash
railway restart
```

### Redeploy

```bash
git commit --allow-empty -m "redeploy"
git push
```
