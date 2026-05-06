# Architecture

> Generated on 2026-04-10

> Last updated: 2026-04-10T10:37:57-03:00
> Repo state: feature/agentic-runtime-openai-sdk @ 499537d

## Overview

The API app follows a transport-first architecture where `apps/api` owns HTTP concerns and lifecycle bootstrapping, and `apps/api/src` owns domain/runtime execution. This separation allows routes to stay relatively simple while orchestrator, queues, tools, enrichment, and persistence are reused across runtime contexts.

Request handling is mixed sync/async. Synchronous HTTP APIs are used for dashboard/admin/user interactions, while webhook ingestion is asynchronous through BullMQ queues. This avoids webhook timeout pressure and centralizes retries in workers.

## System diagram

```mermaid
graph TD
  Client[Dashboard / External providers] --> Hono[apps/api Hono server]
  Hono --> Middlewares[CORS + logger + auth/admin middlewares]
  Hono --> Routes[Route handlers]
  Routes --> ApiCore[apps/api/src services]
  Routes --> BullBoard[/admin/queues]
  ApiCore --> Queues[BullMQ queues/workers]
  Queues --> Redis[(Redis)]
  ApiCore --> Postgres[(PostgreSQL)]
  ApiCore --> External[TMDB/YouTube/Evolution/Discord]
  ApiCore --> AI[Cloudflare AI Gateway]
  Hono --> Obs[Sentry + OTel + Langfuse]
```

## Component breakdown

### API server shell

- **Responsibility:** Boot Hono app, attach routes and middleware, initialize cron and queue dashboard.
- **Location:** `apps/api/src/server.ts`, `apps/api/src/index.ts`
- **Communicates with:** `apps/api/src`, Redis, provider adapters
- **Protocol:** In-process imports + HTTP

### Webhook routes

- **Responsibility:** Validate provider webhook, parse incoming payload, enqueue async processing.
- **Location:** `apps/api/src/routes/webhook-new.ts`
- **Communicates with:** `messageQueue`, provider adapters
- **Protocol:** HTTP POST -> queue job

### Dashboard routes

- **Responsibility:** Expose authenticated user/admin endpoints consumed by dashboard app.
- **Location:** `apps/api/src/routes/dashboard/*`
- **Communicates with:** api-core services and DB
- **Protocol:** HTTP JSON

### Shared runtime core

- **Responsibility:** Intent classification, agent orchestration, tool execution, persistence, queue workers.
- **Location:** `apps/api/src/services/*`
- **Communicates with:** DB, Redis, LLMs, external APIs
- **Protocol:** In-process calls + external HTTP

## Layers

The observed layering is:

1. **Transport Layer:** Hono routes/middleware (`apps/api/src/routes`, `apps/api/src/middlewares`).
2. **Application Layer:** orchestration/services (`apps/api/src/services`).
3. **Domain/Data Layer:** types + schema + DB services (`apps/api/src/types`, `apps/api/src/db`).
4. **Infrastructure Layer:** Redis/BullMQ/LLM providers/enrichment APIs.

## Cross-cutting concerns

- **Authentication:** Better Auth session cookie via `authPlugin` (`apps/api/src/lib/auth.ts`) and `authMiddleware` (`apps/api/src/middlewares/auth.middleware.ts`).
- **Authorization:** `adminMiddleware` checks `user.role === 'admin'` for `/api/admin/*`.
- **Logging:** pino-based loggers via `@nexo/api-core/utils/logger`, plus Hono request logger.
- **Error handling:** Hono `app.onError`, HTTPException handling, global error service, Sentry capture.
- **Configuration:** centralized env validation via `@nexo/env`; API references `@nexo/api-core/config/env` re-export.
