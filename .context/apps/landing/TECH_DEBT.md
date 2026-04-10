# Tech Debt

> Generated on 2026-04-10

> Last updated: 2026-04-10T10:37:57-03:00
> Repo state: feature/agentic-runtime-openai-sdk @ 499537d

## Overview

Landing debt is low in complexity but has maintainability issues around generated artifacts in source and lack of test coverage.

## Findings

| Severity | Finding | Evidence |
|---|---|---|
| Medium | Generated artifacts tracked in `src/` | `App.vue.js`, `App.vue.d.ts`, maps |
| Medium | No automated tests | no test files/scripts |
| Low | Placeholder CTA URLs | `YOUR_NUMBER`, `YOUR_BOT` |

## Risks

1. Generated files can drift from source and confuse code review.
2. Marketing funnel links can break without test checks.
3. Placeholder links can accidentally reach production if not replaced.

## Suggested backlog

1. Exclude generated files from source control (or move to build output only).
2. Add minimal smoke tests for render and CTA links.
3. Externalize CTA targets to env/config.

## Notes

No severe architectural debt signal was found.
