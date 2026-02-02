# ADR-002: Supabase como Database

**Status**: accepted

**Data**: 2026-01-05

## Contexto

Precisamos de database que suporte:

- PostgreSQL com JSONB
- Auth integrado
- Row Level Security (multi-tenant)
- Acesso HTTP de Workers
- Free tier para MVP

## Decisão

Usar **Supabase** como database managed.

## Consequências

### Positivas

- **PostgreSQL real**: features completas (JSONB, GIN indexes, triggers)
- **Auth integrado**: JWT pronto, providers OAuth
- **RLS nativo**: segurança multi-tenant por padrão
- **HTTP API**: funciona perfeitamente com Workers
- **Free tier**: 500MB DB, 2GB bandwidth - suficiente para MVP
- **Realtime** (futuro): subscriptions para dashboard

### Negativas

- **Latência**: não é edge (mas OK para nosso caso)
- **Cold start DB**: ~100-200ms (melhor que alternatives)
- **Vendor lock-in**: migração requer trabalho (mas é Postgres)

## Alternativas Consideradas

1. **Neon**: Mais edge-friendly mas menos features (sem auth, sem realtime)
2. **PlanetScale**: MySQL não PostgreSQL (sem JSONB)
3. **D1 (Cloudflare)**: SQLite, sem JSONB avançado
4. **Turso**: Bom mas comunidade menor

## Implementação

```typescript
// Drizzle ORM para type-safety
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const client = postgres(DATABASE_URL);
const db = drizzle(client);
```
