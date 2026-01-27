
# Metric Storage Normalization Plan (Revised)

## Goal

Evitar duplicação de dados armazenando metadados pesados e embeddings de Movies, TV Shows e Videos na tabela global `semantic_external_items`. Implementar **Bulk Async Enrichment** para cachear lotes inteiros de resultados de busca em background, otimizando performance e custo.

## Bulk Async Workflow

1. Usuário busca por "Matrix".
2. TMDB retorna 20 resultados.
3. O sistema envia **todos os 20 candidatos** como um job único para a `enrichmentQueue`.
4. O worker processa o batch: calcula embeddings para novos itens e faz bulk insert em `semantic_external_items`.
5. Quando o usuário clica em "Salvar", o sistema faz o link para o item global já cacheado.

---

## Instruções Detalhadas e Melhorias

### 1. Schema e Idempotência

- **Adicionar índice único** em `semantic_external_items` (`external_id`, `type`, `provider`) para garantir que não haja duplicatas no cache global. Criar migration específica.
- Campo `semanticExternalItemId` já existe em `memory_items` e deve ser sempre usado para filmes, séries e vídeos.

### 2. Queue Infrastructure (`src/services/queue-service.ts`)

- **Nova fila**: `enrichmentQueue` (`'enrichment-processing'`).
- **Worker**: `bulk-enrich-candidates`.
  - **Payload**: `{ candidates: Array<ItemCandidate>, provider: 'tmdb' | 'youtube' | ... }`
  - **Processo**:
    1. Extrair todos os `externalIds` do payload.
    2. Consultar `semantic_external_items` para encontrar já existentes.
    3. Filtrar apenas os novos.
    4. **Batch Vectorize**: Gerar embeddings para todos os novos itens (preferir batch na API, se suportado; senão, promises paralelas).
    5. **Bulk Insert**: Inserir todos os novos itens em uma transação.

### 3. Service Logic Updates

#### `src/services/enrichment/tmdb-service.ts`

- Modificar `searchMovies` / `searchTVShows`:
  - Buscar resultados na TMDB.
  - **Disparar job bulk**: `enrichmentQueue.add('bulk-enrich-candidates', { candidates: results, provider: 'tmdb', type: 'movie' | 'tv_show' })`.
  - Retornar resultados para UI imediatamente.

#### `src/services/item-service.ts`

- Modificar `createItem`:
  1. **Consultar cache global**: Buscar em `semantic_external_items` por `externalId`.
  2. **Fallback**: Se não encontrado (job ainda pendente), criar item global inline (com embedding síncrono) e linkar.
  3. **Criar memória do usuário**:
      - `embedding` = NULL.
      - `semanticExternalItemId` = ID do item global.
      - `metadata` = JSON mínimo para UI.
  4. **Notas e links**: continuam gerando embedding inline, pois não têm cache global.

### 4. Application Setup (`src/app.ts`)

- Registrar `enrichmentQueue` no Bull Board para monitoramento.

### 5. Embedding Service (Otimização)

- Se a API de embedding suportar batch, adaptar para enviar arrays de textos, reduzindo latência e custo.
- Se não suportar, manter promises paralelas.

### 6. Estratégia de Fallback e Consistência

- Se o usuário salvar um item antes do job async terminar, gerar embedding síncrono e inserir no cache global imediatamente, garantindo UX sem bloqueio.
- Worker deve ser idempotente: se já existir, ignorar/atualizar.

### 7. Verificação e Testes

1. **Busca**: Buscar termo de filme.
2. **Monitorar**: Verificar job `bulk-enrich-candidates` no Bull Board.
3. **Banco**: Conferir novos rows em `semantic_external_items` com vetores.
4. **Salvar**: Salvar filme e garantir que `memory_items` referencia o item global e `embedding` está NULL.

---

## Considerações Finais

- O schema e infraestrutura já estão prontos para a normalização.
- O maior esforço está na criação do worker de enrichment e adaptação dos fluxos de save.
- Garantir idempotência e consistência é fundamental para evitar duplicatas e race conditions.

---

**Checklist de Implementação:**

- [x] Migration: índice único em `semantic_external_items`
- [x] Nova fila Bull: `enrichmentQueue` + worker
- [x] Dispatch job em `tmdb-service.ts`
- [x] Consulta cache global em `item-service.ts`
- [x] Registro no Bull Board
- [ ] Testes de fallback e consistência
