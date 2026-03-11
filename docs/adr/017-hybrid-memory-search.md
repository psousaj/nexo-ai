# ADR-018: Hybrid Memory Search (Vector + Keyword)

**Status**: accepted

**Data**: 2026-02-16

## Contexto

O NEXO AI precisa buscar itens salvos por usuários com:
- **Busca semântica**: "filmes de ficção científica" → encontra Interstellar, Matrix, etc
- **Busca por palavra-chave**: "interstellar" → encontrar exatamente "Interstellar"
- **Busca hierárquica**: "filmes de 2014" → todos os filmes de 2014

Solução atual usa apenas **pgvector** (busca vetorial):

### Problemas do Apenas Vetorial

1. **Falsos positivos**: "carro" retorna "carroça" (similaridade semântica)
2. **Ignora palavras-chave**: Busca por "matrix" pode não achar se a embedding for diferente
3. **Sem ranking por popularidade**: Itens frequentes não têm vantagem

## Decisão

Implementar **busca híbrida** combinando:
1. **Busca vetorial** (pgvector) - similaridade semântica
2. **Busca por texto** (PostgreSQL FTS) - palavras exatas
3. **Fusão de rankings** - combinação ponderada dos resultados

### Arquitetura

```
                    Query do Usuário
                           │
                ┌──────────┴──────────┐
                ▼                     ▼
        Vector Search          Keyword Search
        (pgvector)             (PostgreSQL FTS)
                │                     │
                ▼                     ▼
           Cosine Similarity       ts_rank
           (0.0 a 1.0)            (0.0 a 1.0)
                │                     │
                └──────────┬──────────┘
                           ▼
                    Merge Híbrido
          (weight: 70% vector + 30% keyword)
                           ▼
                    Re-rank
                (por score normalizado)
                           ▼
                      Top N Resultados
```

### SQL Queries

```sql
-- 1. Vector Search (pgvector)
SELECT
  id,
  type,
  title,
  metadata,
  1 - (embedding <=> query_embedding) AS cosine_similarity
FROM memory_items
WHERE user_id = $1
  AND embedding IS NOT NULL
ORDER BY embedding <=> query_embedding ASC
LIMIT 20;

-- 2. Keyword Search (PostgreSQL FTS)
SELECT
  id,
  type,
  title,
  metadata,
  ts_rank(to_tsvector('portuguese', title || ' ' || COALESCE(metadata::text, '')),
           plainto_tsquery('portuguese', $2)) AS rank
FROM memory_items
WHERE user_id = $1
  AND to_tsvector('portuguese', title || ' ' || COALESCE(metadata::text, ''))
    @@ plainto_tsquery('portuguese', $2)
ORDER BY rank DESC
LIMIT 20;

-- 3. Merge (Application Level)
const vectorResults = await db.execute(sql_vector);
const keywordResults = await db.execute(sql_keyword);

// Normalize scores to 0-1
const vectorNorm = normalizeScores(vectorResults);
const keywordNorm = normalizeScores(keywordResults);

// Weighted merge (70% semantic, 30% keyword)
const merged = new Map();
vectorResults.forEach(item => {
  merged.set(item.id, item.score * 0.7);
});
keywordResults.forEach(item => {
  const existing = merged.get(item.id);
  if (existing) {
    merged.set(item.id, (existing + item.score * 0.3) / 2);
  } else {
    merged.set(item.id, item.score * 0.3);
  }
});
```

## Estratégias de Fusão

### 1. Weighted Average (Default)

```
score = vector_score * 0.7 + keyword_score * 0.3
```

**Uso**: Busca geral, balanceada

### 2. Reciprocal Rank Fusion (RRF)

```
score = 60 / (60 + vector_rank) + 60 / (60 + keyword_rank)
```

**Uso**: Quando rankings são mais importantes que scores absolutos

### 3. Average of Normalized

```
vector_norm = (vector_score - min) / (max - min)
keyword_norm = (keyword_score - min) / (max - min)
score = (vector_norm + keyword_norm) / 2
```

**Uso**: Quando precisar normalizar diferentes escalas

## Configuração

### Pesos Configuráveis

```typescript
interface HybridSearchConfig {
  vectorWeight: number;  // 0.0 a 1.0 (default: 0.7)
  textWeight: number;    // 0.0 a 1.0 (default: 0.3)
  mergeStrategy: 'average' | 'weighted' | 'reciprocal_rank_fusion';
  minScore: number;      // Score mínimo para incluir (default: 0.3)
  maxResults: number;     // Máximo de resultados (default: 10)
}
```

### Ajuste por Tipo de Conteúdo

```typescript
const configByType = {
  movie: { vectorWeight: 0.8, textWeight: 0.2 },  // Títulos de filmes são únicos
  note: { vectorWeight: 0.6, textWeight: 0.4 },   // Notas podem ter sobreposição
  link: { vectorWeight: 0.5, textWeight: 0.5 },   // URLs são específicas
};
```

## Consequências Positivas

### 1. Melhor Precisão

```
Query: "ficção científica"

Vector puro:
  - Interstellar (0.95)
  - Matrix (0.92)
  - Interestelar (0.85)  ❌ erro de digitação

Hybrid:
  - Interstellar (0.97)
  - Matrix (0.94)
  - The Martian (0.88) ✅ melhor matching
```

### 2. Tolerância a Erros de Digitação

```
Query: "matriz" (sem acento)

Vector: pode não achar
Keyword: encontra "Matrix" via ILIKE ou tsquery
```

### 3. Performance

- Paralelização: duas queries independentes
- Otimização: `LIMIT 20` cada, depois merge
- Cache: embeddings podem ser cacheados

## Implementação

### Service

```typescript
// services/memory-search.ts
export async function searchMemory(options: MemorySearchOptions) {
  const { query, userId, config } = options;

  // 1. Vector search
  const vectorResults = await db.execute(sql`
    SELECT id, type, title, metadata,
           1 - (embedding <=> ${getEmbedding(query)}::vector) AS score
    FROM memory_items
    WHERE user_id = ${userId}
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${getEmbedding(query)}::vector ASC
    LIMIT ${maxResults * 2}
  `);

  // 2. Keyword search
  const keywordResults = await db.execute(sql`
    SELECT id, type, title, metadata,
           ts_rank(tsv, plainto_tsquery($2)) AS score
    FROM memory_items,
         to_tsvector('portuguese', title || ' ' || COALESCE(metadata::text, '')) tsv
    WHERE user_id = ${userId}
      AND tsv @@ plainto_tsquery($2)
    ORDER BY ts_rank DESC
    LIMIT ${maxResults * 2}
  `);

  // 3. Merge
  const merged = mergeHybridResults(vectorResults, keywordResults, config);

  // 4. Filter by minScore
  return merged.filter(r => r.score >= minScore).slice(0, maxResults);
}
```

### Tools para LLM

```typescript
// Adicionado às tools disponíveis para o agente
memory_search: {
  name: 'memory_search',
  description: 'Busca memória do usuário usando busca híbrida (semântica + palavras-chave)',
  parameters: {
    query: 'string',
    maxResults: 'number',
    types: ['string'],
  },
}
```

## Trade-offs

### Prós

- ✅ **Precisão**: Melhor que vetor ou texto isoladamente
- ✅ **Robustez**: Funciona bem mesmo com erros de digitação
- ✅ **Flexível**: Pesos configuráveis por contexto
- ✅ **Escalar**: PostgreSQL FTS escala bem

### Contras

- ⚠️ **Complexidade**: Mais complexo que busca única
- ⚠️ **Custo**: Duas queries ao invés de uma
- ⚠�️ **Latência**: Leve aumento no tempo de resposta
- ⚠️ **Sintonização**: Pesos precisam ser ajustados

## Alternativas Consideradas

### 1. Elasticsearch

**Problemas**:
- Mais infraestrutura
- Custo operacional
- Overkill para quantidade de dados atual

### 2. Apenas PostgreSQL FTS

**Problemas**:
- Sem entendimento semântico
- Falso positivos por sinonímia (ex: "filme" ≠ "cinema")

### 3. Apenas Vector (pgvector)

**Problemas**:
- Não acha combinações exatas
- Sensível a erros de digitação
- Dificulta buscar IDs específicos

## Otimizações Futuras

### 1. Busca em Daily Logs

```sql
SELECT * FROM agent_daily_logs
WHERE user_id = $1
  AND to_tsvector('portuguese', content) @@ plainto_tsquery($2)
ORDER BY log_date DESC;
```

### 2. Busca Híbrida com Learning to Rank

```typescript
// Coletar feedback: quais resultados o usuário clicou?
// Ajustar pesos dinamicamente baseado em feedback
const adjustedWeights = await learnWeights(userId, clickedItems);
```

### 3. Caching de Embeddings

```typescript
const cachedEmbedding = await cache.get(`embedding:${query}`);
if (cachedEmbedding) return cachedEmbedding;
```

## Referências

- PostgreSQL FTS: https://www.postgresql.org/docs/current/textsearch.html
- pgvector: https://github.com/pgvector/pgvector
- Reciprocal Rank Fusion: https://plg.nd.edu/~gcynto/pub/7118/ng/
- ADR-011: Controle Runtime Determinístico

## Status da Implementação

| Componente | Status |
|-----------|--------|
| Hybrid Search Service | ✅ Implementado |
| PostgreSQL FTS | ✅ Implementado |
| Merge Strategies | ✅ Implementado (3 estratégias) |
| Configurable Weights | ✅ Suportado |
| Memory Tools | ✅ Integradas ao Agent |
| Daily Logs Search | ✅ Implementado |
| Learning to Rank | ⏳ Futuro |
