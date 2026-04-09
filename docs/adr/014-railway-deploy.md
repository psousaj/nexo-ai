# ADR-014: Railway como Plataforma de Deploy

**Status**: accepted  
**Data**: 2026-01-05  
**Atualizado**: 2026-02-01  
**Renomeado de**: `015-cloudflare-workers.md` (decisão original de usar CF Workers como deploy foi descartada)

## Contexto

A decisão original era usar Cloudflare Workers como plataforma de deploy. Porém, com o crescimento dos requisitos do projeto (Bull queues, Redis, long-running processes, ML local com NLP.js e integração operacional com Evolution self-hosted), Cloudflare Workers se mostrou incompatível:

- **CPU limit 50ms**: incompatível com NLP.js training e processamento de áudio
- **Sem runtime de processo longo**: workers de fila e processamento contínuo exigem processo persistente
- **Sem suporte a Bull/ioredis**: queues exigem conexão TCP Redis longa

## Decisão

Usar **Railway** como plataforma de deploy principal da API.

## Implementação

### railway.toml

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "apps/api/Dockerfile"

[deploy]
startCommand = "node apps/api/dist/index.js"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

[[volumes]]
mount = "/data/app"
name = "app-data"
```

- **Build**: Docker via `apps/api/Dockerfile`
- **Runtime**: Node.js (processo longo, sem timeout de CPU)
- **Volume persistente**: `/data/app` para dados operacionais da aplicação

## Por que Railway?

| Critério | Cloudflare Workers | Railway |
|---------|-------------------|---------|
| Bull + Redis | ❌ sem TCP longo | ✅ nativo |
| Runtime de workers | ❌ limite 50ms CPU | ✅ processo longo |
| NLP.js | ❌ bundle incompatível | ✅ Node.js |
| Filesystem | ❌ sem acesso | ✅ volume persistente |
| Custo MVP | ✅ gratuito | $5/mês |
| Deploy | ✅ simples | ✅ git push |

## Cloudflare: uso restrito a AI Gateway

Cloudflare ainda é usado **apenas como AI Gateway** (proxy das chamadas LLM), não como runtime. Isso mantém a vantagem de rate limiting, caching e fallback entre providers sem o custo operacional de gerenciar a plataforma.

## Dashboard e Landing

- **Dashboard** (Nuxt 4): Vercel (via `apps/dashboard/vercel.json`)
- **Landing** (Vite): Vercel (via `apps/landing/vercel.json`)

## Consequências

### Positivas
- Processo longo: sem limites de CPU/memória problemáticos
- Volume persistente para dados operacionais
- Redis e Bull funcionam nativamente
- Deploy simples via Dockerfile + git push

### Negativas
- Custo: $5/mês mínimo (vs Cloudflare Workers free)
- Cold starts mais lentos (container vs edge)
- Menos regiões globais que edge computing

## Referências

- `railway.toml` — configuração de deploy
- `apps/api/Dockerfile` — imagem de produção
- `apps/dashboard/vercel.json` — deploy do dashboard
