# Tech Stack

> Generated on 2026-04-10

> Last updated: 2026-04-10T10:37:57-03:00
> Repo state: feature/agentic-runtime-openai-sdk @ 499537d

## Overview

The API stack is TypeScript-first and centered on Hono for HTTP routing, Drizzle for DB access, BullMQ for asynchronous processing, and OpenAI-compatible AI access through Cloudflare AI Gateway. The implementation is split between app shell (`apps/api`) and shared backend core (`packages/api-core`).

The dependency profile shows strong integration needs: messaging providers, enrichment APIs, auth/session, observability, and queue infra. Build tooling is tsup/tsx for runtime, with Vitest for tests.

## Runtime and framework inventory

| Category | Technology | Where configured |
|---|---|---|
| HTTP framework | Hono | `apps/api/src/server.ts` |
| HTTP server | `@hono/node-server` | `apps/api/src/index.ts` |
| Validation | Zod + `@hono/zod-validator` | route files in `apps/api/src/routes` |
| Auth | Better Auth | `packages/api-core/src/lib/auth.ts` |
| DB ORM | Drizzle ORM + postgres-js | `packages/api-core/src/db/index.ts` |
| Queue | BullMQ + ioredis | `packages/api-core/src/services/queue-service.ts` |
| AI | `ai` SDK + OpenAI SDK + Cloudflare AI Gateway | `packages/api-core/src/services/ai/*` |
| Observability | Sentry + OpenTelemetry + Langfuse | `apps/api/src/sentry.ts`, `packages/otel`, `packages/api-core/src/services/langfuse.ts` |

## Key libraries

| Library | Purpose | Evidence |
|---|---|---|
| `hono` | routing/middleware | `apps/api/package.json` |
| `drizzle-orm` | SQL mapping and schema typing | `apps/api/package.json`, `packages/api-core/src/db/schema/*` |
| `bullmq` | async job queues | `apps/api/package.json`, `packages/api-core/src/services/queue-service.ts` |
| `ioredis` | Redis clients for queue/cache | `packages/api-core/src/config/redis.ts` |
| `openai`, `ai`, `ai-gateway-provider` | LLM + tool runtime | `packages/api-core/package.json`, `packages/api-core/src/services/ai` |
| `node-nlp` | neural intent classifier component | `apps/api/package.json` |
| `discord.js` | Discord messaging adapter | `packages/api-core/package.json` |

## Build, test, and local run

| Action | Command | Scope |
|---|---|---|
| Dev API | `pnpm dev:api` | monorepo root |
| Dev local (app) | `pnpm run dev` | `apps/api` |
| Build | `pnpm build:api` | monorepo root |
| Test | `pnpm run test` | `apps/api` |
| DB generate | `pnpm db:generate` | root -> api |

## Configuration and env

The API runtime depends on validated env vars from `packages/env/src/index.ts`, including:

- PostgreSQL (`DATABASE_URL`)
- Redis (`REDIS_*`)
- Cloudflare AI gateway (`CLOUDFLARE_*`)
- Messaging and integrations (`TELEGRAM_*`, `EVOLUTION_*`, `TMDB_API_KEY`, `YOUTUBE_API_KEY`)
- Security and auth (`BETTER_AUTH_*`, `COOKIE_DOMAIN`, `CORS_ORIGINS`)

## Notes

Could not determine a single canonical production deploy target for API directly from code. There is a Dockerfile for container deploy and release automation in GitHub Actions, but no explicit IaC for API runtime environment in this repository.
