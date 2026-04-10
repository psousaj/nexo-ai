# Tech Debt

> Generated on 2026-04-10

> Last updated: 2026-04-10T10:37:57-03:00
> Repo state: feature/agentic-runtime-openai-sdk @ 499537d

## Overview

Dashboard debt is mostly in consistency and test coverage rather than architectural flaws. Core auth/middleware structure is clear, but implementation style differs across pages and some unfinished actions remain.

## Findings

| Severity | Finding | Evidence |
|---|---|---|
| Medium | Mixed data-fetching patterns (`axios` and `$fetch`) | `useDashboard.ts` vs admin page files |
| Medium | Low test surface relative to UI size | 4 test files vs 260 source files |
| Low | TODO placeholders in pages | `app/pages/admin/users.vue`, `app/pages/profile/personality.vue` |
| Low | Role check duplicated front/back | frontend middleware + backend admin middleware |

## Potential impact

1. Divergent request patterns can create inconsistent auth header/cookie behavior.
2. Refactors in composables may miss pages using direct `$fetch`.
3. Incomplete admin actions can lead to UX dead-ends.

## Suggested backlog

1. Standardize on one API access pattern for all pages.
2. Expand tests for middleware redirects and role-gated pages.
3. Replace TODO actions with disabled UI states plus tracked issues.
4. Add dashboard-specific CI tests beyond lint/typecheck.

## Notes

No major bundle/performance debt signal was confirmed from static config alone.
