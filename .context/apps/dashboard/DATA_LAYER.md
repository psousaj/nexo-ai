# Data Layer

> Generated on 2026-04-10

> Last updated: 2026-04-10T10:37:57-03:00
> Repo state: feature/agentic-runtime-openai-sdk @ 499537d

## Overview

Dashboard has no direct database layer. Its data model is fully API-driven and session-driven. Persistence is owned by backend services; frontend keeps ephemeral state in-memory (Pinia, Vue Query cache, component refs).

## Data sources

| Source | Usage | Location |
|---|---|---|
| Backend REST API | primary application data | `app/composables/useDashboard.ts`, pages |
| Better Auth session | auth identity/session status | `app/stores/auth.ts`, auth plugin |
| Runtime config | endpoint base URLs | `nuxt.config.ts`, `app/utils/api.ts` |

## State stores

| Store/cache | Purpose |
|---|---|
| Pinia auth store | user session projection + permissions |
| Vue Query cache | query-level response caching and refetch policy |
| Local refs/computed | page-local UI state |

## Access pattern example

```ts
const { data } = await api.get('/memories', { params: { search, type } });
```

Source: `apps/dashboard/app/composables/useDashboard.ts`

## Data consistency behavior

- Auth store refreshes profile after authentication checks.
- Query invalidation is manually triggered on some admin actions.
- No offline persistence strategy found.

## Notes

Could not determine SSR hydration concerns here because app explicitly disables SSR (`ssr: false`).
