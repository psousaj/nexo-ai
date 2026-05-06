# ADR-010: Enriquecimento Assíncrono via Bull Queues

**Status**: accepted  
**Data**: 2026-01-10  
**Atualizado**: 2026-02-01  
**Supersede**: ADR-010-sync (decisão original de enrichment síncrono descartada)

## Contexto

A decisão original (v0.2.0–v0.3.0) era usar enrichment síncrono via Cloudflare Workers, considerando o límite de CPU de 50ms. Com a migração para **Node.js + Railway** (ADR-015 revisado), não existem limites de CPU por request — o bottleneck passou a ser a experiência do usuário: esperar 1–3s por TMDB/YouTube antes de receber confirmação é ruim.

## Decisão

Enriquecimento de metadados (TMDB, YouTube, OpenGraph, Books, Spotify) é **100% assíncrono** desde v0.4.0, implementado via **Bull Queue** (`enrichmentQueue`) no Redis.

```
Webhook
  ↓
save_movie / save_tv_show / save_video / save_link
  ↓
itemService.createItem({...metadata_basica}) ← responde imediatamente
  ↓
enrichmentQueue.add({itemId, type, externalId}) ← não-bloqueante
  ↓
usuário recebe: "✅ Salvo! Enriquecendo metadados..."
  ↓ (background)
enrichmentWorker → TMDB/YouTube/OpenGraph → itemService.updateMetadata()
```

## Implementação

- **Fila**: `enrichmentQueue` em `apps/api/src/services/queue-service.ts`
- **Worker**: processa em batch, retry automático com backoff exponencial
- **Save**: `save_*` tools retornam imediatamente com metadata básica (título, ano)
- **Enriquecimento**: TMDB, YouTube, OpenGraph, Books, Spotify rodam em background

## Por que não Cloudflare Workers Queues?

O projeto migrou de Cloudflare Workers para **Node.js na Railway** (ver ADR-015 revisado). Com Node.js long-running, Bull + Redis é a solução natural para filas, sem custo adicional (já existe Redis para sessões/Bull board).

## Consequências

### Positivas

- **UX melhor**: usuário recebe confirmação em < 200ms
- **Resiliência**: falhas de TMDB/YouTube não bloqueiam o fluxo principal
- **Retry automático**: 3x com backoff exponencial
- **Monitorável**: Bull Board em `http://localhost:3002/admin/queues`

### Negativas

- **Latência na atualização**: metadados completos chegam segundos depois
- **Complexidade**: Redis obrigatório (mas já é dependência para sessões)

## Referências

- `apps/api/src/services/queue-service.ts` — definição das filas
- `apps/api/src/services/enrichment/` — TMDB, YouTube, OpenGraph, Books, Spotify
- `apps/api/src/services/tools/index.ts` — tools de save que enfileiram enrichment
