# Data Layer

> Generated on 2026-04-10

> Last updated: 2026-04-10T10:37:57-03:00
> Repo state: feature/agentic-runtime-openai-sdk @ 499537d

## Overview

The API data layer uses PostgreSQL through Drizzle ORM and `postgres` driver, with schemas centralized in `apps/api/src/db/schema`. Redis is used for queue transport and selective caching. Semantic retrieval combines pgvector embeddings and PostgreSQL FTS.

Migrations are managed by Drizzle Kit from `apps/api`, but schema source of truth points to `apps/api/src`.

## Databases and stores

| Store | Purpose | Main files |
|---|---|---|
| PostgreSQL | transactional and conversational persistence | `apps/api/src/db/index.ts` |
| pgvector extension usage | semantic embeddings on memory and external items | `apps/api/src/db/schema/items.ts`, `semantic-external-items.ts` |
| Redis | BullMQ queues + cache helpers | `apps/api/src/config/redis.ts` |

## Core tables

| Table | Role | Notable fields |
|---|---|---|
| `users` | root identity | `status`, `role`, assistant personalization fields |
| `user_channels` | provider identity linking | unique `(channel, channelUserId)` |
| `conversations` | conversation state machine | `state`, `context` JSONB, `closeAt` |
| `messages` | conversation transcript | provider metadata JSONB |
| `memory_items` | user memory objects | `metadata` JSONB, `embedding` vector(384) |
| `semantic_external_items` | cached enrichment payloads | `rawData` JSONB, `embedding` vector(384) |
| `feature_flags` | runtime pivots/channels | DB-backed flag state |
| `global_tools` | tool enable/disable | global tool governance |

## Migrations strategy

| Item | Value |
|---|---|
| Drizzle config | `apps/api/drizzle.config.ts` |
| Schema source | `../../apps/api/src/db/schema/index.ts` |
| Output folder | `apps/api/drizzle` |
| Commands | `pnpm db:generate`, `pnpm db:push`, `pnpm db:studio` |

## Access patterns

### Drizzle query builder in services

```ts
const item = await db.query.memoryItems.findFirst({
  where: and(eq(memoryItems.id, id), eq(memoryItems.userId, userId)),
});
```

Source: `apps/api/src/services/memory-search.ts`

### Hybrid semantic + keyword query

```ts
SELECT id, title,
  1 - (embedding <=> $query::vector) AS cosine_similarity
FROM memory_items
ORDER BY embedding <=> $query::vector ASC
```

Source: `apps/api/src/services/memory-search.ts`

## Caching strategy

| Cache | Scope | Invalidation |
|---|---|---|
| Redis key-value (`cacheGet/cacheSet`) | tool availability and misc | explicit `cacheDelete` hooks |
| Queue persistence | BullMQ jobs | automatic cleanup options per queue/job |

## Connection management

- PostgreSQL uses one `postgres` client with `prepare: false` and notice hooks.
- Redis shared connection for BullMQ plus optional cache connection.
- Queue setup fails fast if required Redis env vars are missing.

## Notes

Could not determine explicit SQL migrations history quality from current scan alone (ordering/conflict safety) without executing migration commands.
