# ADR-003: JSONB para Metadados Flexíveis

**Status**: accepted

**Data**: 2026-01-05

## Contexto

Cada tipo de item (movie, video, link, note) tem metadados diferentes:

- Filmes: TMDB data, streaming, ratings
- Vídeos: YouTube stats, channel, duration
- Links: OpenGraph, preview
- Notas: categorias, prioridade

Opções:

1. Tabelas separadas por tipo (movie, video, link)
2. Campos nullable na mesma tabela
3. JSONB flexível

## Decisão

Usar campo **`metadata` JSONB** na tabela `items`.

## Consequências

### Positivas

- **Flexibilidade**: adicionar campos sem migrations
- **Performance**: GIN indexes permitem queries eficientes
- **Type-safety**: TypeScript types por tipo de item
- **Simplicidade**: uma tabela, menos JOINs

### Negativas

- **Validação runtime**: TypeScript não valida DB
- **Queries complexas**: requer conhecimento JSONB operators
- **Sem FK**: não pode fazer FOREIGN KEY em campos JSONB

## Implementação

```typescript
// Schema Drizzle
export const items = pgTable(
  "items",
  {
    metadata: jsonb("metadata").$type<ItemMetadata>(),
  },
  (table) => ({
    metadataIdx: index("items_metadata_idx").using("gin", table.metadata),
  })
);

// Type guards
export function isMovieMetadata(
  type: ItemType,
  metadata: any
): metadata is MovieMetadata {
  return type === "movie";
}
```

## Queries Exemplo

```sql
-- Buscar filmes de terror
SELECT * FROM items
WHERE type = 'movie'
  AND metadata @> '{"genres": ["Terror"]}';

-- Buscar com streaming Netflix
SELECT * FROM items
WHERE metadata @> '{"streaming": [{"provider": "Netflix"}]}';
```

## Alternativas Consideradas

1. **EAV (Entity-Attribute-Value)**: Muito complexo, performance ruim
2. **Tabelas separadas**: Mais rígido, JOINs complexos
3. **JSON text**: Sem indexes, queries lentas
