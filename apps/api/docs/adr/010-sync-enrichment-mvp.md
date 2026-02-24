# ADR-010: Enriquecimento Síncrono no MVP

**Status**: accepted

**Data**: 2026-01-10

## Contexto

Enrichment de metadados (TMDB, YouTube, OpenGraph) pode ser feito de duas formas:

### Opção A: Síncrono (Blocking)
```typescript
// Webhook aguarda enrichment completar
const metadata = await enrichmentService.enrich("movie", { tmdbId: 123 });
await itemService.createItem({ ...item, metadata });
return sendMessage("✅ Salvo!");
```

**Tempo típico:** 200-500ms (TMDB + streaming providers)

### Opção B: Assíncrono (Background)
```typescript
// Webhook responde imediatamente
await env.ENRICHMENT_QUEUE.send({ itemId, type, tmdbId });
return sendMessage("✅ Salvando... busco detalhes em instantes!");

// Worker separado processa fila
async queue(batch) {
  for (const msg of batch.messages) {
    const metadata = await enrichmentService.enrich(...);
    await itemService.updateMetadata(msg.itemId, metadata);
    await sendMessage("📊 Detalhes atualizados!");
  }
}
```

**Tempo resposta:** < 50ms (imediato)  
**Custo:** Workers Queues = $5/mês (Workers Paid plan)

## Decisão

Manter **enriquecimento SÍNCRONO** no MVP (v0.2.0-v0.3.0) e migrar para **assíncrono em v0.4.0** SE necessário.

## Justificativa

### Cloudflare Workers Free Tier é Suficiente

```
CPU Time Limit: 50ms/request (free) | 30s/request (paid)

Breakdown típico de request:
├── Parse webhook:        1ms  ✅
├── DB queries:           5ms  ✅
├── LLM call (Gemini):   não conta no CPU (I/O bound) ✅
├── TMDB API:            não conta no CPU (I/O bound) ✅
├── Save to DB:          5ms  ✅
└── Send response:       não conta no CPU (I/O bound) ✅

Total CPU time: ~15ms ✅ (muito abaixo de 50ms)
```

**APIs externas NÃO contam** no CPU time (são I/O bound).  
Apenas código JavaScript sincronizado conta.

### Implementação Mais Simples

- ✅ Fluxo linear (fácil debugar)
- ✅ Sem complexidade de filas
- ✅ Sem necessidade de Workers Paid ($5/mês)
- ✅ Menos código para manter

### UX Aceitável

Usuário aguarda 1-2s (tempo natural de conversa).  
Não percebe diferença entre síncrono e assíncrono nesse range.

## Quando Mudar para Assíncrono (v0.4.0+)

Migrar para Workers Queues SE:

1. ✅ **CPU time exceder 50ms em 10%+ dos requests**  
   Monitorar via Cloudflare Analytics

2. ✅ **Enrichment demorar > 3s consistentemente**  
   TMDB rate limit, APIs lentas, etc

3. ✅ **Upgrade para Workers Paid já justificado** por outros motivos  
   Durable Objects, R2, etc

## Consequências

### Positivas

- **Custo zero** (Free tier suficiente)
- **Simplicidade** (menos código, menos bugs)
- **UX boa** (1-2s é aceitável)
- **Rápido de implementar** MVP

### Negativas

- **Não escala** para enrichments > 3s
- **Bloqueante** se TMDB ficar lento
- **Refactor necessário** se mudar para async

## Implementação Futura (v0.4.0)

Se precisar migrar para async:

```typescript
// webhook.ts
export default {
  async fetch(request, env, ctx) {
    // Salva item rapidamente
    const item = await itemService.createItem({
      userId,
      type: "movie",
      title: "Interstellar",
      metadata: null, // Enriquece depois
    });

    // Enfileira enrichment (não-bloqueante)
    await env.ENRICHMENT_QUEUE.send({
      itemId: item.id,
      type: "movie",
      tmdbId: 157336,
    });

    return sendMessage("✅ Salvei! Buscando mais detalhes...");
  },

  // Queue consumer (worker separado)
  async queue(batch, env) {
    for (const msg of batch.messages) {
      const { itemId, type, tmdbId } = msg.body;

      // Enriquece em background
      const metadata = await enrichmentService.enrich(type, { tmdbId });

      // Atualiza item
      await itemService.updateMetadata(itemId, metadata);

      // Notifica usuário (opcional)
      await sendMessage("📊 Detalhes atualizados: streaming, gêneros, etc!");
    }
  },
};
```

**Setup Workers Queues:**
[[queues.producers]]
queue = "enrichment-queue"
binding = "ENRICHMENT_QUEUE"

[[queues.consumers]]
queue = "enrichment-queue"
max_batch_size = 10
max_batch_timeout = 30
```

**Custo:** $5/mês Workers Paid + consumo de Queue

## Métricas para Decisão

| Métrica                 | Síncrono (Atual) | Assíncrono (v0.4.0) |
| ----------------------- | ---------------- | ------------------- |
| **Tempo resposta**      | 1-2s             | < 200ms             |
| **CPU time**            | ~15ms            | ~5ms                |
| **Custo**               | $0               | $5/mês              |
| **Complexidade código** | Baixa            | Média               |
| **Escalabilidade**      | Até 1000 users   | Ilimitado           |

**Threshold de mudança:** Quando CPU time médio > 40ms OU tempo total > 3s

## Alternativas Consideradas

1. **Async desde o início**: Premature optimization, custo desnecessário
2. **Cloudflare Durable Objects**: Overkill, mais caro, não precisa state
3. **External queue (SQS, Redis)**: Adiciona dependência externa

## Referências

- [Cloudflare Workers Limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Workers Queues Documentation](https://developers.cloudflare.com/queues/)
- Roadmap v0.4.0: considerar async enrichment
