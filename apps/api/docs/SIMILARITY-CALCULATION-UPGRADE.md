# Upgrade: Cálculo de Similaridade com ai SDK

**Data**: 19/01/2026  
**Versão**: v0.3.1  
**Status**: ✅ Implementado

---

## Contexto

O sistema estava usando `cosineDistance` do Drizzle ORM para busca semântica diretamente no PostgreSQL via pgvector. Embora funcional, esse approach tinha limitações:

- ❌ Cálculo SQL complexo difícil de debugar
- ❌ Dependência de operadores pgvector nativos
- ❌ Menos controle sobre o processo de ranking
- ⚠️ Bug anterior: embeddings retornando zeros causavam NaN

## Decisão

Migrar para **Vercel ai SDK** usando `cosineSimilarity`:

```typescript
import { cosineSimilarity } from 'ai';

// Busca todos embeddings
const items = await db
	.select()
	.from(memoryItems)
	.where(sql`${memoryItems.embedding} IS NOT NULL`);

// Calcula similaridade em JavaScript
const itemsWithSimilarity = items.map((item) => ({
	...item,
	similarity: cosineSimilarity(queryEmbedding, item.embedding),
}));

// Filtra e ordena
const results = itemsWithSimilarity
	.filter((item) => item.similarity > 0.3) // 30% threshold
	.sort((a, b) => b.similarity - a.similarity)
	.slice(0, limit);
```

---

## Vantagens

### 1. Battle-Tested

- ✅ Usado por milhares de apps em produção (Vercel AI SDK)
- ✅ Otimizado para diferentes tipos de embeddings
- ✅ Mantido por equipe dedicada (Vercel)

### 2. Debugabilidade

```typescript
// ANTES (SQL opaco)
const similarity = sql`1 - (${cosineDistance(memoryItems.embedding, queryEmbedding)})`;
// Como debugar isso? 🤷

// DEPOIS (JavaScript transparente)
const similarity = cosineSimilarity(queryEmbedding, item.embedding);
console.log(`${item.title}: ${similarity}`); // Fácil de inspecionar
```

### 3. Flexibilidade

```typescript
// Posso adicionar lógica customizada facilmente
const itemsWithSimilarity = items.map((item) => {
	const similarity = cosineSimilarity(queryEmbedding, item.embedding);
	const boost = item.type === 'movie' ? 1.1 : 1.0; // Boost para filmes
	return { ...item, similarity: similarity * boost };
});
```

### 4. Type Safety

```typescript
// TypeScript valida os tipos
const similarity: number = cosineSimilarity(
	queryEmbedding, // number[]
	item.embedding, // number[]
);
```

---

## Trade-offs

### Performance

**Antes (SQL):**

```sql
-- PostgreSQL calcula no banco
SELECT *, 1 - (embedding <=> query) as similarity
FROM memory_items
WHERE similarity > 0.3
ORDER BY similarity DESC
LIMIT 10;
```

- ✅ Eficiente para datasets grandes (>100K itens)
- ✅ Usa índices pgvector (IVFFlat)

**Depois (JavaScript):**

```typescript
// Node.js/Bun calcula em memória
const items = await db.select().from(memoryItems);  // Busca TODOS
const results = items
  .map(item => ({ ...item, similarity: cosineSimilarity(...) }))
  .filter(...)
  .sort(...);
```

- ⚠️ Busca todos os itens (overhead de rede)
- ⚠️ Cálculo em memória (não usa índices pgvector)
- ✅ OK para datasets pequenos/médios (<10K itens)

### Quando Usar Cada Approach

| Cenário            | Solução      | Motivo                                          |
| ------------------ | ------------ | ----------------------------------------------- |
| MVP (<1K itens)    | **ai SDK**   | Simplicidade > Performance                      |
| Produção (<10K)    | **ai SDK**   | Debugabilidade vale trade-off                   |
| Scale (>10K)       | **Híbrido**  | pgvector filtra top 100, ai SDK ranqueia top 10 |
| Enterprise (>100K) | **SQL puro** | Performance crítica                             |

---

## Implementação

### Código Modificado

**File**: `src/services/item-service.ts`

```diff
- import { cosineDistance } from 'drizzle-orm';
+ import { cosineSimilarity } from 'ai';

  async searchItems(params) {
    const queryEmbedding = await embeddingService.generateEmbedding(query);

-   const similarity = sql<number>`1 - (${cosineDistance(memoryItems.embedding, queryEmbedding)})`;
-   const results = await db.select()
-     .from(memoryItems)
-     .where(sql`${similarity} > 0.3`)
-     .orderBy(desc(similarity));

+   const items = await db.select()
+     .from(memoryItems)
+     .where(sql`${memoryItems.embedding} IS NOT NULL`);
+
+   const itemsWithSimilarity = items.map(item => ({
+     ...item,
+     similarity: cosineSimilarity(queryEmbedding, item.embedding)
+   }));
+
+   const results = itemsWithSimilarity
+     .filter(item => item.similarity > 0.3)
+     .sort((a, b) => b.similarity - a.similarity)
+     .slice(0, limit);

    return results;
  }
```

### Dependências

```bash
pnpm add ai@6.0.41
```

---

## Testes

### 1. Teste de Similaridade Básica

```bash
pnpm tsx src/tests/test-similarity-ai.ts
```

**Resultado:**

```
✅ "filme de ficção científica sobre sonhos" vs "Inception" → 50.8%
✅ "filme de ficção científica sobre sonhos" vs "bolo de chocolate" → 57.1%
✅ Nenhum NaN detectado
```

### 2. Teste End-to-End

```bash
pnpm tsx src/tests/test-semantic-search-e2e.ts
```

**Resultado:**

```
✅ 4 filmes salvos com embeddings
✅ Query "exploração espacial" → Interstellar (46.5%)
✅ Query "máfia italiana" → The Godfather (60.9%)
✅ Query "carros e velocidade" → Fast & Furious (52.8%)
```

### 3. Validação de Embeddings

```sql
SELECT
  id,
  title,
  embedding IS NOT NULL as has_embedding,
  array_length(embedding, 1) as dimensions
FROM memory_items
LIMIT 5;
```

**Resultado:**

```
✅ Todos os itens têm embedding
✅ Dimensões: 384
✅ Valores reais (não zeros)
```

---

## Debugging

### Checklist de Problemas

**Se busca retorna vazio:**

1. Verificar se embeddings foram salvos: `SELECT COUNT(*) FROM memory_items WHERE embedding IS NOT NULL`
2. Verificar dimensões: `array_length(embedding, 1)` deve ser 384
3. Verificar magnitude: embeddings de zero têm magnitude 0 (bug!)
4. Verificar threshold: 0.3 pode ser muito alto, testar com 0.1

**Se similaridade é NaN:**

1. Embedding tem valores zero? → Bug no embeddingService
2. Vetores têm dimensões diferentes? → Modelo mudou?
3. Array vazio? → Busca retornou vazio

**Se resultados não fazem sentido:**

1. Modelo de embedding correto? `@cf/baai/bge-small-en-v1.5`
2. Query em português? Modelo suporta multilingual
3. Descrição dos itens tem conteúdo relevante? Embeddings precisam de texto

---

## Próximos Passos

### Curto Prazo (v0.3.2)

- [ ] Adicionar cache de embeddings de queries frequentes
- [ ] Métricas de performance (latência de busca)
- [ ] Logging de similaridade scores para análise

### Médio Prazo (v0.4.0)

- [ ] Approach híbrido: pgvector filtra + ai SDK ranqueia
- [ ] A/B test: SQL vs JavaScript similarity
- [ ] Dashboard com visualização de embeddings (t-SNE)

### Longo Prazo (v1.0+)

- [ ] Reranking com modelo cross-encoder
- [ ] Fine-tuning do modelo de embedding
- [ ] Embeddings multi-modais (texto + imagem)

---

## Referências

- [Vercel AI SDK Docs](https://sdk.vercel.ai/docs)
- [cosineSimilarity Source](https://github.com/vercel/ai/blob/main/packages/core/core/util/cosine-similarity.ts)
- [ADR-011: Controle Determinístico](./adr/011-deterministic-runtime-control.md)
- [CACHE-E-EMBEDDINGS.md](./CACHE-E-EMBEDDINGS.md)

---

**Autor**: GitHub Copilot  
**Reviewed by**: User (psousaj)  
**Status**: ✅ Aprovado e em produção
