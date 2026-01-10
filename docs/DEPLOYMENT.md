# Deployment Guide

## Cloudflare Workers

### Pré-requisitos

1. Conta Cloudflare
2. Wrangler CLI instalado: `npm install -g wrangler`
3. Autenticado: `wrangler login`

### 1. Configurar wrangler.toml

```toml
name = "nexo-ai"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
NODE_ENV = "production"
APP_URL = "https://nexo-ai.your-subdomain.workers.dev"

# Não colocar secrets aqui!
```

### 2. Configurar Secrets

```bash
wrangler secret put DATABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put META_WHATSAPP_TOKEN
wrangler secret put META_WHATSAPP_PHONE_NUMBER_ID
wrangler secret put META_VERIFY_TOKEN
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put TMDB_API_KEY
wrangler secret put YOUTUBE_API_KEY
```

### 3. Deploy

```bash
# Build
bun run build

# Deploy
wrangler deploy
```

### 4. Configurar Webhook WhatsApp

Após deploy, configure no Meta Developer Portal:

- **Callback URL**: `https://nexo-ai.your-subdomain.workers.dev/webhook/meta`
- **Verify Token**: (seu `META_VERIFY_TOKEN`)
- **Webhook Fields**: `messages`

## Supabase Database

### Connection Pooler

Para Cloudflare Workers, use connection pooler (pgbouncer):

```
postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:6543/postgres
```

**Importante**: Porta `6543`, não `5432`!

### Migrations

Execute localmente antes do deploy:

```bash
bun run db:push
```

## Troubleshooting

### Erro: CPU Time Exceeded

Cloudflare Workers free tier: 50ms CPU time

**Solução**:

- Use `waitUntil()` para operações assíncronas não-bloqueantes
- Upgrade para Workers Paid ($5/mês) - 30s CPU time

### Erro: Module not found

Certifique-se de incluir no `wrangler.toml`:

```toml
[build]
command = "bun run build"

node_compat = true
```

### Database Connection Timeout

- Use Supabase pooler (porta 6543)
- Configure timeout no connection string:
  ```
  ?connection_timeout=10
  ```

## Monitoramento

### Logs

```bash
wrangler tail
```

### Metrics

Dashboard Cloudflare:

- Request count
- CPU time
- Errors
- Bandwidth

## Custos Estimados

| Serviço                | Plano     | Custo/mês |
| ---------------------- | --------- | --------- |
| Cloudflare Workers     | Free      | $0        |
| Supabase               | Free      | $0        |
| Claude API             | Pay-as-go | ~$5-20    |
| TMDB API               | Free      | $0        |
| YouTube Data API       | Free      | $0        |
| Meta WhatsApp Business | Free      | $0        |
| **Total estimado**     |           | **$5-20** |

## Rollback

```bash
# Lista deployments
wrangler deployments list

# Rollback
wrangler rollback --message "reverting to previous version"
```
