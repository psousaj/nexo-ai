# Conventions

> Generated on 2026-04-10

> Last updated: 2026-04-10T10:37:57-03:00
> Repo state: feature/agentic-runtime-openai-sdk @ 499537d

## Overview

Dashboard follows Nuxt file-system conventions with app code under `app/`. Security-sensitive routes are guarded through middleware and store/session checks. API access is intended to be centralized in composables and utils.

## File organization conventions

| Area | Path | Convention |
|---|---|---|
| Pages | `app/pages/**` | route-driven Vue files |
| Components | `app/components/**` | reusable UI units |
| Composables | `app/composables/**` | app-level business adapters |
| Middleware | `app/middleware/**` | route guards |
| Stores | `app/stores/**` | Pinia state |
| Plugins | `app/plugins/**` | client injection and setup |

## Security conventions

1. Protected routes should pass through `auth.global` middleware.
2. Admin routes should include `role` middleware.
3. Backend remains source of truth for authorization decisions.

## API conventions

- Axios client defined in `app/utils/api.ts` with `/api` normalization.
- Composable methods in `useDashboard.ts` expose endpoint calls.
- Better Auth client is injected via plugin and consumed with `useAuthClient()`.

## Styling/tooling conventions

| Tool | Use |
|---|---|
| ESLint + Biome | lint/format |
| Nuxt UI + Tailwind | component and utility styling |
| Vue Query | server state caching |

## Notes

Could not determine a strict page/component naming style guide beyond existing patterns.
