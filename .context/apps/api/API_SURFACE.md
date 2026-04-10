# API Surface

> Generated on 2026-04-10

> Last updated: 2026-04-10T10:37:57-03:00
> Repo state: feature/agentic-runtime-openai-sdk @ 499537d

## Overview

The API app exposes mixed endpoint categories: operational endpoints (`/health`, docs), webhook ingestion (`/webhook/*`), legacy items endpoints (`/items`), Better Auth pass-through (`/api/auth/*`), and dashboard-focused user/admin APIs (`/api/*`). Authenticated dashboard endpoints rely on cookie sessions plus role middleware where required.

Webhook endpoints are intentionally thin and asynchronous. Dashboard APIs are mostly synchronous CRUD/operations over user data, flags, tools, and integration connectivity.

## Route inventory

### Public/operational

| Method | Path | Auth | Source |
|---|---|---|---|
| GET | `/` | none | `apps/api/src/server.ts` |
| GET | `/health` | none | `apps/api/src/routes/health.ts` |
| GET | `/openapi.json` | none | `apps/api/src/server.ts` |
| GET | `/doc`, `/scalar` | none | `apps/api/src/server.ts` |

### Webhooks

| Method | Path | Auth | Behavior |
|---|---|---|---|
| POST | `/webhook/telegram` | token verification via adapter | parse and enqueue `message-processing` |
| POST | `/webhook/whatsapp/evolution` (path from env) | webhook secret verification | parse and enqueue `message-processing` |

Source: `apps/api/src/routes/webhook-new.ts`

### Items (legacy direct)

| Method | Path | Auth model | Source |
|---|---|---|---|
| GET | `/items` | query `userId` | `apps/api/src/routes/items.ts` |
| GET | `/items/:id` | query `userId` | `apps/api/src/routes/items.ts` |
| POST | `/items/search` | body `userId` | `apps/api/src/routes/items.ts` |
| DELETE | `/items/:id` | query `userId` | `apps/api/src/routes/items.ts` |

### Auth and dashboard API

| Prefix | Notes |
|---|---|
| `/api/auth/*` | forwarded to Better Auth handler |
| `/api/user/*` | profile/accounts/linking/preferences |
| `/api/memories/*` | memory CRUD/search |
| `/api/analytics/*` | dashboard metrics |
| `/api/admin/*` | admin-only operational endpoints |

Sources: `apps/api/src/routes/auth-better.routes.ts`, `apps/api/src/routes/dashboard/*.ts`

## Auth and authorization

| Concern | Mechanism | File |
|---|---|---|
| Session auth | Better Auth cookie session | `apps/api/src/middlewares/auth.middleware.ts` |
| Role auth | `user.role === 'admin'` | `apps/api/src/middlewares/admin.middleware.ts` |
| Better Auth config | DB + optional Redis secondary storage | `packages/api-core/src/lib/auth.ts` |

## Internal contracts

- Route handlers call singleton services from `packages/api-core`.
- Admin endpoints also expose provider connectivity test operations and feature/tool toggles.
- Queue interaction is direct in webhook routes and orchestrator/worker services.

## External integrations and contracts

| Integration | Contract shape | Where |
|---|---|---|
| Telegram webhook | provider payload -> normalized `IncomingMessage` | adapter + webhook route |
| Evolution webhook | provider payload + auth header | adapter + webhook route |
| Better Auth | `/api/auth/*` handler contract | auth route |
| Bull Board | mounted dashboard plugin | `/admin/queues` |

## Versioning

No explicit URI API versioning (e.g., `/v1`) was found. Versioning is currently implicit via deployment and route evolution.

## Notes

Could not determine a published external API compatibility policy. OpenAPI metadata exists but appears partial/manual.
