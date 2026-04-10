# Conventions

> Generated on 2026-04-10

> Last updated: 2026-04-10T10:37:57-03:00
> Repo state: feature/agentic-runtime-openai-sdk @ 499537d

## Overview

Intake-worker conventions prioritize explicit contracts and simple control flow.

## Conventions observed

| Convention | Example |
|---|---|
| App factory pattern | `createIntakeWorkerApp()` in `src/app.ts` |
| Guard-first route implementation | auth/body checks before processing |
| Shared contract reuse | `normalizeMultimodalPayload` from `@nexo/shared` |
| Env parsing via zod | `src/config/env.ts` |

## Error response convention

All errors are shaped via helper:

```ts
jsonError(c, status, error, message)
```

Source: `apps/intake-worker/src/app.ts`

## Notes

No custom lint/style rules specific to this app were found beyond workspace standards.
