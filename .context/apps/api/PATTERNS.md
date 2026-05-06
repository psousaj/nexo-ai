# Patterns

> Generated on 2026-04-10

> Last updated: 2026-04-10T10:37:57-03:00
> Repo state: feature/agentic-runtime-openai-sdk @ 499537d

## Overview

The backend strongly favors deterministic runtime orchestration with explicit contracts around LLM output and tool execution. Operationally, it follows queue-backed async processing and service singleton usage. Config and prompts are centralized, reducing hidden behavior drift.

At the same time, some modules became large and multi-responsibility, creating local pattern erosion in complexity hotspots.

## Architectural patterns catalog

| Pattern | Where | Status |
|---|---|---|
| Deterministic runtime over LLM | `apps/api/src/services/agent-orchestrator.ts` | Consistent |
| Queue-based webhook processing | `apps/api/src/routes/webhook-new.ts`, `queue-service.ts` | Consistent |
| Service singleton exports | many `services/*.ts` files | Consistent |
| DB-first feature flags + OpenFeature provider | `feature-flag.service.ts` | Consistent |
| Prompt centralization (YAML) | `config/prompt-builder.ts`, `config/prompts/*.yml` | Consistent |
| Thin route handlers | most route files | Mostly consistent |

## Code examples

### Queue handoff from webhook

```ts
await messageQueue.add(
  "message-processing",
  { incomingMsg: message, providerName: "telegram" },
  { removeOnComplete: true, attempts: 3 }
);
```

Source: `apps/api/src/routes/webhook-new.ts`

### Auth + admin middleware layering

```ts
dashboardRouter.use('*', authMiddleware);
dashboardRouter.use('/admin/*', adminMiddleware);
```

Source: `apps/api/src/routes/dashboard/index.ts`

### Feature flag runtime update

```ts
await db.update(featureFlags)
  .set({ enabled, updatedAt: new Date() })
  .where(eq(featureFlags.key, key));
this.provider.putConfiguration(config);
```

Source: `apps/api/src/services/feature-flag.service.ts`

## Error handling strategy

| Layer | Strategy |
|---|---|
| HTTP layer | Hono `onError`, structured JSON responses |
| Worker layer | retries + queue `failed` listeners + global error handler |
| Runtime/LLM layer | guard clauses, fallback messaging, parser validation |
| Observability | Sentry capture + OTel attributes + Langfuse traces |

## Configuration management

- Env schema in `packages/env/src/index.ts` with zod.
- API accesses env through `@nexo/api-core/config/env` re-export.
- Runtime flags from DB tables (`feature_flags`, `global_tools`) not only env booleans.

## Anti-patterns / inconsistencies

| Finding | Evidence | Risk |
|---|---|---|
| Very large orchestrator and tool modules | `agent-orchestrator.ts`, `tools/index.ts` | cognitive load and regression risk |
| Admin route concentration | `apps/api/src/routes/dashboard/admin.routes.ts` | mixed responsibilities |
| Manual OpenAPI path object | `apps/api/src/server.ts` | spec drift from real routes |

## Notes

No dependency injection framework was found. Construction and singleton references are module-level and import-driven.
