# Tech Stack

> Generated on 2026-04-10

> Last updated: 2026-04-10T10:37:57-03:00
> Repo state: feature/agentic-runtime-openai-sdk @ 499537d

## Overview

Intake worker uses a very small TypeScript stack centered on Hono and shared contracts from `@nexo/shared`. It favors simplicity and predictable contract behavior over infrastructure complexity.

## Inventory

| Category | Technology | Evidence |
|---|---|---|
| Runtime web framework | Hono + `@hono/node-server` | `apps/intake-worker/src/index.ts` |
| Validation | Zod | `src/config/env.ts`, app route handling |
| Shared contract | `@nexo/shared` | `src/app.ts` |
| Build | tsup | `apps/intake-worker/package.json` |
| Dev runner | tsx | `apps/intake-worker/package.json` |
| Tests | Vitest | `apps/intake-worker/vitest.config.ts` |

## Commands

| Action | Command |
|---|---|
| Dev | `pnpm run dev` |
| Build | `pnpm run build` |
| Start | `pnpm run start` |
| Test | `pnpm run test` |

## Notes

No direct database, queue, or observability SDK dependencies were found in this app.
