# Deploy na Railway

## Configuração Rápida

### 1. Conectar repositório

```bash
# Via Railway CLI
railway init

# Ou conecte via GitHub no dashboard Railway
```

### 2. Configurar variáveis de ambiente

No Railway dashboard, adicione todas as env vars de `.env`:

```bash
# Database (use Railway PostgreSQL ou Supabase)
DATABASE_URL=postgresql://...

# AI Providers
GOOGLE_API_KEY=...
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_API_TOKEN=...

# Messaging
TELEGRAM_BOT_TOKEN=...

# Enrichment APIs
TMDB_API_KEY=...
YOUTUBE_API_KEY=...

# (Opcional) Observability
UPTRACE_DSN=...

# Railway configura PORT automaticamente - NÃO adicione manualmente
```

### 3. Deploy

```bash
railway up
```

## Como funciona

### PORT dinâmico

Railway atribui uma porta aleatória via `process.env.PORT`.

O Elysia já está configurado para ler `PORT`:

```typescript
// src/config/env.ts
PORT: z.coerce.number().default(3000);

// src/index.ts
app.listen(env.PORT, () => {
	console.log(`🚀 Nexo AI rodando em http://0.0.0.0:${env.PORT}`);
});
```

### Binary compilation

O Dockerfile compila para binário usando:

```bash
bun build \
  --compile \
  --minify-whitespace \
  --minify-syntax \
  --target bun-linux-x64 \
  --outfile server \
  src/index.ts
```

**Por que não usar `--minify` completo?**

OpenTelemetry usa nomes de funções para tracing. `--minify` completo minifica nomes para single character, quebrando traces.

### Distroless base image

Usa `gcr.io/distroless/base` - imagem mínima sem shell:

- ✅ Menor superfície de ataque
- ✅ ~20MB vs ~100MB (alpine)
- ✅ Mais seguro para produção
- ❌ Não tem shell (sem `sh`, `bash`)
- ❌ Não suporta HEALTHCHECK com CMD

Railway faz health checks via HTTP automaticamente, então não precisa de HEALTHCHECK no Dockerfile.

## Health Checks

Railway verifica `/health` automaticamente:

```typescript
// src/routes/health.ts
app.get('/health', () => ({
	status: 'ok',
	timestamp: new Date().toISOString(),
}));
```

## Database

### Opção 1: Railway PostgreSQL

```bash
# No Railway dashboard
railway add postgresql

# Conecta automaticamente e define DATABASE_URL
```

### Opção 2: Supabase

```bash
# Use connection pooler (porta 6543)
DATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:6543/postgres
```

## Logs

```bash
# Ver logs em tempo real
railway logs

# Ver últimas 100 linhas
railway logs --tail 100
```

## Troubleshooting

### Erro: "Address already in use"

Railway já configura `PORT` automaticamente. Não adicione `PORT` manualmente nas env vars.

### Erro: "Database connection timeout"

Use Supabase connection pooler (porta 6543, não 5432):

```
postgresql://...@db.xxx.supabase.co:6543/postgres
```

### Erro: "Binary not found"

Certifique-se que o Dockerfile está usando:

```dockerfile
CMD ["./server"]
```

Não:

```dockerfile
CMD ["bun", "run", "dist/index.js"]  # Isso não funciona com binary
```

### OpenTelemetry não envia traces

Verifique se `UPTRACE_DSN` está configurado corretamente:

```bash
railway variables set UPTRACE_DSN="https://xxx@uptrace.dev/xxx"
```

## Custos Estimados

| Recurso            | Plano  | Custo               |
| ------------------ | ------ | ------------------- |
| Railway Hobby      | $5/mês | Inclui 500h compute |
| Railway PostgreSQL | $5/mês | Backup incluído     |
| **Total**          |        | **$10/mês**         |

Railway oferece $5 grátis/mês para hobby projects.

## Deploy via GitHub Actions (CI/CD)

```yaml
# .github/workflows/deploy.yml
name: Deploy to Railway

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install Railway CLI
        run: npm i -g @railway/cli

      - name: Deploy
        run: railway up
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

Adicione `RAILWAY_TOKEN` aos secrets do GitHub:

```bash
# Gera token no Railway dashboard
railway login
railway tokens create
```

## Referências

- [Railway Docs](https://docs.railway.app/)
- [Elysia Deploy Guide](https://elysiajs.com/patterns/deploy.html#railway)
- [Bun Binary Compilation](https://bun.sh/docs/bundler/executables)
