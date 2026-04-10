# Patterns

> Generated on 2026-04-10

> Last updated: 2026-04-10T10:37:57-03:00
> Repo state: feature/agentic-runtime-openai-sdk @ 499537d

## Overview

The worker uses explicit guard-then-process patterns: auth guard, payload shape guard, schema normalization, feature flag gate, adapter dispatch, and typed error response. This makes behavior deterministic and easy to test.

## Pattern catalog

| Pattern | Where | Status |
|---|---|---|
| Guard clauses for auth and payload | `src/app.ts` | Consistent |
| Shared schema normalization | `@nexo/shared` normalizer | Consistent |
| Adapter abstraction by modality | `src/adapters/*` | Consistent |
| Structured JSON error helper | `jsonError()` in `src/app.ts` | Consistent |

## Code examples

```ts
if (!isAuthorizedRequest(c)) {
  return jsonError(c, 401, 'unauthorized', 'Missing or invalid bearer token');
}
```

Source: `apps/intake-worker/src/app.ts`

```ts
const normalized = normalizeMultimodalPayload(payload, flags);
```

Source: `apps/intake-worker/src/app.ts`

## Error handling strategy

| Condition | Status code |
|---|---|
| Missing/invalid token | 401 |
| Invalid body shape | 400 |
| Unprocessable attachment/flag/schema issue | 422 |
| Unexpected processing failure | 500 |

## Notes

No retry/circuit-breaker pattern exists yet because adapters are local stubs and processing is synchronous per request.
