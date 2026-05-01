# Conventions

> Generated on 2026-04-10

> Last updated: 2026-04-10T10:37:57-03:00
> Repo state: feature/agentic-runtime-openai-sdk @ 499537d

## Overview

The API follows monorepo conventions that emphasize centralized prompts, deterministic orchestration, service singleton exports, and strict routing/middleware layering. Path aliases are widely used to keep imports stable and readable.

Conventions are documented in `AGENTS.md` and `.github/copilot-instructions.md`, and are reflected in code organization.

## Naming and file organization

| Convention | Example |
|---|---|
| Routes grouped by domain under `routes/dashboard` | `admin.routes.ts`, `user.routes.ts` |
| Services are singleton exports | `export const featureFlagService = ...` |
| Prompt definitions centralized | `apps/api/src/config/prompts/*.yml` |
| DB schema one file per table/domain | `apps/api/src/db/schema/*.ts` |
| Middleware as explicit functions | `authMiddleware`, `adminMiddleware` |

## Import conventions

| Scope | Alias pattern |
|---|---|
| API app | `@/` for app-local imports (`apps/api/src/tsconfig.json`) |
| Shared runtime | `@nexo/api-core/...` subpath exports |
| Package imports | workspace protocol via pnpm (`workspace:*`) |

## Runtime conventions

1. Webhook processing should enqueue jobs; avoid heavy sync work in route handlers.
2. Role-gated admin routes must pass through `authMiddleware` then `adminMiddleware`.
3. Feature/tool toggles are persisted in DB and propagated in runtime provider.
4. Conversation state transitions go through conversation service, not ad-hoc route updates.
5. LLM prompts should come from prompt builder, not inline route/service strings.

## Git and workflow conventions (from repository instructions)

- Work in small tasks.
- Loop required: task -> test -> commit.
- Avoid automated `git push` unless explicitly requested by user.
- Keep work in dedicated branch for planning cycle.

## Code style and tooling

| Tool | Role |
|---|---|
| Biome | format/lint (biome check/write) |
| Vitest | unit/integration tests |
| Turbo | workspace task orchestration |
| tsup/tsx | build and dev runtime |

## Notes

Could not determine a formal API deprecation/versioning convention document inside the app itself.
