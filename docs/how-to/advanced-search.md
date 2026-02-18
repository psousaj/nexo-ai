# Advanced Search - Exemplos de Uso

## API Endpoint

`GET /items/search`

## Filtros Disponíveis

### 1. Busca por texto (query)

```http
GET /items/search?query=matrix
```

Retorna todos items com "matrix" no título.

### 2. Filtrar por tipo

```http
GET /items/search?type=movie
GET /items/search?type=tv_show
GET /items/search?type=note
GET /items/search?type=link
GET /items/search?type=video
```

### 3. Filtrar por ano (movies/tv_shows)

```http
# Filmes entre 1990 e 2000
GET /items/search?type=movie&yearRange=1990,2000

# Filmes de 2023
GET /items/search?type=movie&yearRange=2023,2023
```

### 4. Filtrar por streaming disponível

```http
# Apenas filmes com streaming
GET /items/search?type=movie&hasStreaming=true

# Apenas filmes sem streaming (não lançado ou expirou)
GET /items/search?type=movie&hasStreaming=false
```

### 5. Filtrar por rating mínimo

```http
# Filmes com rating >= 8.0
GET /items/search?type=movie&minRating=8.0

# Séries bem avaliadas (>= 7.5)
GET /items/search?type=tv_show&minRating=7.5
```

### 6. Filtrar por gêneros

```http
# Filmes de terror
GET /items/search?type=movie&genres=Terror

# Filmes de ação OU comédia (OR logic)
GET /items/search?type=movie&genres=Ação,Comédia
```

### 7. Ordenação

```http
# Ordenar por data de criação (padrão)
GET /items/search?orderBy=created

# Ordenar por rating (maior primeiro)
GET /items/search?orderBy=rating

# Ordenar por ano (mais recente primeiro)
GET /items/search?orderBy=year
```

## Exemplos Combinados

### Encontrar filmes de terror recentes com bom rating e streaming

```http
GET /items/search?type=movie&genres=Terror&yearRange=2020,2024&minRating=7.0&hasStreaming=true&orderBy=rating
```

### Séries de ficção científica clássicas (1980-1999)

```http
GET /items/search?type=tv_show&genres=Ficção científica&yearRange=1980,1999&orderBy=year
```

### Filmes bem avaliados disponíveis para assistir agora

```http
GET /items/search?type=movie&hasStreaming=true&minRating=8.0&orderBy=rating&limit=20
```

## Uso no Código

```typescript
import { itemService } from '@/services/item-service';

// Busca avançada
const results = await itemService.advancedSearch({
  userId: 'user-123',
  type: 'movie',
  query: 'matrix',
  yearRange: [1990, 2010],
  hasStreaming: true,
  minRating: 7.5,
  genres: ['Ficção científica', 'Ação'],
  orderBy: 'rating',
  limit: 10,
});

// Filmes de terror disponíveis no streaming
const horrorMovies = await itemService.advancedSearch({
  userId: 'user-123',
  type: 'movie',
  genres: ['Terror'],
  hasStreaming: true,
  orderBy: 'rating',
});

// Todas as séries (sem filtros)
const allShows = await itemService.advancedSearch({
  userId: 'user-123',
  type: 'tv_show',
  orderBy: 'created',
});
```

## Notas de Performance

- **Indexes**: GIN index em `metadata` garante queries JSONB rápidas
- **Cache**: Resultados podem ser cacheados no Redis (futuro)
- **Limit**: Padrão 20 items, máximo recomendado 100
- **OR logic**: Filtro de gêneros usa OR (item tem pelo menos 1 gênero)

## Roadmap

### v0.4.0+
- [ ] Full-text search em descrições (não só títulos)
- [ ] Filtro por streaming provider específico (ex: "apenas Netflix")
- [ ] Filtro por diretor/elenco
- [ ] Agregações: contagem por gênero, ano, etc
- [ ] Semantic search com pgvector (quando > 500 items)

