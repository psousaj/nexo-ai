# Sistema de Cache e Embeddings - Nexo AI

## Visão Geral

O sistema implementa **duas funcionalidades críticas**:

1. **Cache de APIs externas** (Redis)
2. **Busca semântica** (PostgreSQL Vector + Cloudflare Embeddings)

---

## 1. Sistema de Cache (Redis)

### Onde é usado?

Cache **apenas** para chamadas externas caras/lentas:

#### ✅ TMDB (Cinema)

```typescript
// src/services/enrichment/tmdb-service.ts

// Busca de filmes (TTL: 24h)
searchMovies(title: string) → cache: tmdb:movie:search:{title}

// Busca de séries (TTL: 24h)
searchTVShows(title: string) → cache: tmdb:tv:search:{title}

// Detalhes de filme (TTL: 24h)
getMovieDetails(tmdbId: number) → cache: tmdb:movie:details:{tmdbId}

// Detalhes de série (TTL: 24h)
getTVShowDetails(tmdbId: number) → cache: tmdb:tv:details:{tmdbId}

// Provedores de streaming (TTL: 24h)
getWatchProviders(tmdbId: number, type: 'movie'|'tv') → cache: tmdb:providers:{type}:{tmdbId}
```

#### ✅ YouTube Data API

```typescript
// src/services/enrichment/youtube-service.ts

// Busca de vídeos (TTL: 12h)
getVideoMetadata(url: string) → cache: youtube:{videoId}
```

#### ✅ OpenGraph (Links)

```typescript
// src/services/enrichment/opengraph-service.ts

// Metadados de links (TTL: 24h ou 1h se falhar)
fetchOpenGraphMetadata(url: string) → cache: opengraph:{url}
```

### Configuração Redis

```typescript
// src/config/redis.ts

REDIS_HOST=redis-12704.c336.samerica-east1-1.gce.cloud.redislabs.com
REDIS_PORT=12704
REDIS_USER=psousaj
REDIS_PASSWORD=***
REDIS_TLS=false  // ⚠️ IMPORTANTE: sem TLS (Bull + ioredis funcionam melhor assim)
```

### Funções de Cache

```typescript
// Cache GET (retorna null se não existir ou erro)
cacheGet<T>(key: string): Promise<T | null>

// Cache SET (com TTL opcional)
cacheSet<T>(key: string, value: T, ttlSeconds?: number): Promise<void>

// Cache DELETE
cacheDelete(key: string): Promise<void>
```

### Comportamento

- **Silencioso**: Se Redis falhar, retorna `null` (não bloqueia app)
- **Fallback**: API externa é chamada se cache falhar
- **TTL inteligente**: 24h para dados estáveis, 1h para erros

---

## 2. Sistema de Embeddings (PostgreSQL Vector)

### O que são Embeddings?

**Embeddings** = vetores numéricos (1024 dimensões) que representam o **significado semântico** de um texto.

Exemplo:

```
Texto: "Inception filme de Christopher Nolan sobre sonhos"
Vector: [0.234, -0.512, 0.891, ..., 0.123] (1024 números)
```

### Modelo Usado

```typescript
// src/services/ai/embedding-service.ts

Modelo: @cf/qwen/qwen2.5-embedding-0.6b
Provider: Cloudflare Workers AI
Dimensões: 1024
Idiomas: Português, Inglês, +60 idiomas
```

### Quando são gerados?

**Embeddings são criados SEMPRE que um item é salvo**:

```typescript
// src/services/item-service.ts

async saveItem(type: ItemType, title: string, metadata?: ItemMetadata) {
  // 1. Prepara texto rico para embedding
  const textToEmbed = this.prepareTextForEmbedding({ type, title, metadata });

  // 2. Gera vetor de 1024 dimensões
  const embedding = await embeddingService.generateEmbedding(textToEmbed);

  // 3. Salva no banco
  await db.insert(memoryItems).values({
    type,
    title,
    metadata,
    embedding, // ← Vetor salvo aqui
    userId
  });
}
```

### Texto usado para embedding

O sistema cria um **texto rico** combinando todos os campos relevantes:

```typescript
// Filme
prepareTextForEmbedding({
  type: 'movie',
  title: 'Inception',
  metadata: {
    year: 2010,
    genres: ['Ação', 'Ficção Científica'],
    director: 'Christopher Nolan',
    overview: 'Dom Cobb é um ladrão com a rara habilidade...'
  }
})

// Resultado:
"Filme: Inception
Ano: 2010
Gêneros: Ação, Ficção Científica
Diretor: Christopher Nolan
Sinopse: Dom Cobb é um ladrão com a rara habilidade..."
```

### Schema do Banco

```sql
-- src/db/schema/items.ts

CREATE TABLE memory_items (
  id UUID PRIMARY KEY,
  type TEXT NOT NULL, -- 'movie', 'tv_show', 'video', 'link', 'note'
  title TEXT NOT NULL,
  metadata JSONB,
  embedding VECTOR(1024), -- ← Vetor de similaridade
  user_id UUID NOT NULL,
  created_at TIMESTAMP
);

-- Índice para busca rápida
CREATE INDEX memory_items_embedding_idx
ON memory_items
USING ivfflat (embedding vector_cosine_ops);
```

### Busca Semântica

Usuário busca: **"filme sobre sonhos"**

```typescript
// src/services/item-service.ts

async searchItems(query: string, userId: string) {
  // 1. Gera embedding da query
  const queryEmbedding = await embeddingService.generateEmbedding("filme sobre sonhos");

  // 2. Calcula similaridade de cosseno (1 = idêntico, 0 = diferente)
  const similarity = sql`1 - (embedding <=> ${queryEmbedding})`;

  // 3. Busca itens com similaridade > 0.3
  const results = await db
    .select({ item, similarity })
    .from(memoryItems)
    .where(and(
      eq(memoryItems.userId, userId),
      sql`embedding IS NOT NULL`,
      sql`1 - (embedding <=> ${queryEmbedding}) > 0.3` // Threshold
    ))
    .orderBy(desc(similarity))
    .limit(10);

  return results; // "Inception" (0.87), "A Origem" (0.85), ...
}
```

### Vantagens da Busca Vetorial

**Busca tradicional (LIKE)**:

```sql
SELECT * FROM items WHERE title ILIKE '%sonho%';
-- ❌ Não encontra "Inception" (título não tem "sonho")
```

**Busca semântica (Vector)**:

```sql
SELECT * FROM items
WHERE 1 - (embedding <=> query_vector) > 0.3
ORDER BY similarity DESC;
-- ✅ Encontra "Inception" (embedding entende que é sobre sonhos)
```

---

## 3. Fluxo Completo: Salvando um Filme

```
User: "salva inception"
  ↓
IntentClassifier: action='save'
  ↓
AgentOrchestrator: tool='enrich_movie'
  ↓
TMDB Service:
  1. Check cache: tmdb:movie:search:inception
  2. Cache MISS → API externa
  3. Retorna: [{id: 27205, title: "Inception", year: 2010}]
  4. Save cache (TTL: 24h)
  ↓
ItemService.saveItem():
  1. Prepara texto: "Filme: Inception\nAno: 2010\nGêneros: Ação..."
  2. Gera embedding: [0.234, -0.512, ...]
  3. Salva no DB:
     - title: "Inception"
     - type: "movie"
     - metadata: {tmdb_id: 27205, genres: [...], ...}
     - embedding: [1024 dimensões]
  ↓
User recebe: "✅ Inception (2010) salvo!"
```

---

## 4. Fluxo Completo: Buscando Filmes

```
User: "busca filmes de suspense"
  ↓
IntentClassifier: action='search'
  ↓
AgentOrchestrator: tool='search_items'
  ↓
ItemService.searchItems():
  1. Gera embedding da query: [0.891, -0.234, ...]
  2. Calcula similaridade no DB (PostgreSQL)
  3. Retorna itens com similaridade > 0.3:
     - "Seven" (0.89) ← Alta similaridade
     - "Gone Girl" (0.85)
     - "Zodíaco" (0.82)
  ↓
User recebe lista formatada
```

---

## 5. Monitoramento

### Logs de Cache

```bash
# Cache HIT (encontrou no Redis)
[CACHE] DEBUG: Cache HIT: tmdb:movie:search:inception

# Cache MISS (não encontrou, vai chamar API)
[CACHE] DEBUG: Cache MISS: tmdb:movie:search:matrix

# Cache SET (salvou no Redis)
[CACHE] DEBUG: Cache SET: tmdb:movie:search:matrix (TTL: 86400s)
```

### Logs de Embedding

```bash
# Embedding gerado com sucesso
[ENRICHMENT] INFO: Embedding gerado (1024 dims)

# Falha ao gerar embedding
[DB] WARN: ⚠️ Falha ao gerar embedding, salvando sem vetor
```

---

## 6. Troubleshooting

### Redis não conecta

```bash
# Erro: ERR_SSL_WRONG_VERSION_NUMBER
# Solução: Desabilitar TLS no .env

REDIS_TLS=false  # ← Importante!
```

### Embedding falha

**Problema comum: Erro 400 - BadRequestError**

```bash
[ENRICHMENT] ERROR: Erro ao gerar embedding
  err: {
    "type": "BadRequestError",
    "message": "400 status code (no body)",
    "status": 400
  }
```

**Causa**: Texto muito grande para o modelo Cloudflare Workers AI

**Solução automática**: Sistema **trunca textos > 2000 caracteres**

```typescript
// src/services/ai/embedding-service.ts
// Limite: 2000 chars (≈ 512 tokens)
// Truncamento automático + warning no log

// Logs esperados:
[ENRICHMENT] WARN: ⚠️ Texto truncado para embedding
  originalLength: 2500
  truncatedLength: 2000

[ENRICHMENT] INFO: ✅ Embedding gerado
  dimensions: 1024
```

**Teste manual**:

```bash
# Verifique variáveis do Cloudflare
CLOUDFLARE_ACCOUNT_ID=seu-account-id
CLOUDFLARE_API_TOKEN=seu-token

# Teste direto:
npx tsx -e "
import { embeddingService } from './src/services/ai/embedding-service';
const vec = await embeddingService.generateEmbedding('teste');
console.log('Dimensões:', vec.length); // Deve ser 1024
"
```

### Busca semântica não funciona

```bash
# Verifique se embedding foi salvo
psql $DATABASE_URL -c "
SELECT id, title,
       embedding IS NOT NULL as has_embedding
FROM memory_items
WHERE user_id = 'seu-user-id'
LIMIT 5;
"

# Se has_embedding = false, re-salvar itens
```

---

## 7. Próximos Passos

### Melhorias Futuras

1. **Hybrid Search**: Combinar busca vetorial + keyword (BM25)
2. **Reranking**: Usar modelo de reranking para melhorar resultados
3. **Cache distribuído**: Redis Cluster para escalar
4. **Embeddings incrementais**: Atualizar apenas campos alterados
5. **Metrics**: Medir hit rate, latência, custos

### ADRs Relacionados

- [ADR-002: Supabase Postgres](./adr/002-supabase-postgres.md) - Database
- [ADR-003: JSONB Metadata](./adr/003-jsonb-metadata.md) - Flexibilidade
- [ADR-005: AI-Agnostic](./adr/005-ai-agnostic.md) - Providers

---

**Última atualização**: 19 de janeiro de 2026  
**Versão**: v0.3.12
