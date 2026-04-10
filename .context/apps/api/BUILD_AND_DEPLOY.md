# Build And Deploy

> Generated on 2026-04-10

> Last updated: 2026-04-10T10:37:57-03:00
> Repo state: feature/agentic-runtime-openai-sdk @ 499537d

## Overview

API build and runtime are monorepo-driven with pnpm + Turbo. Packaging uses tsup output and a multi-stage Dockerfile for production-like container execution. Local observability and provider dependencies can be bootstrapped with Docker Compose files in repository root.

Deployment automation exists for release tags, but app-specific API deployment workflow is not fully declared in this repository.

## Build pipeline

| Stage | Command | Source |
|---|---|---|
| Install deps | `pnpm install --frozen-lockfile` | root and Dockerfile |
| Build API | `pnpm build --filter=@nexo/api` | root scripts, Dockerfile |
| Run API | `NODE_ENV=production node dist/index.js` | `apps/api/package.json` |
| Train NLP model | `pnpm train:nexo` | `apps/api/package.json`, Dockerfile |

## Docker model

| Stage | Details | File |
|---|---|---|
| Builder | installs workspace deps, builds API and packages | `apps/api/Dockerfile` |
| Runner | installs production deps, copies dist artifacts | `apps/api/Dockerfile` |
| Runtime user | non-root `appuser` | `apps/api/Dockerfile` |
| Exposed port | `3001` | `apps/api/Dockerfile` |

## Runtime dependencies

| Dependency | Purpose |
|---|---|
| PostgreSQL | main persistence |
| Redis | queues and cache |
| Cloudflare AI Gateway | LLM and embeddings |
| External APIs | TMDB, YouTube, Evolution, optional Discord |

## CI/CD evidence

| Workflow | Behavior | File |
|---|---|---|
| `dashboard-ci.yml` | lint + typecheck on push | `.github/workflows/dashboard-ci.yml` |
| `release.yml` | creates release by tag from root version | `.github/workflows/release.yml` |

## Environment configuration

- Env schema: `packages/env/src/index.ts`
- API defaults and requirements include DB, Redis, provider keys, observability DSNs.
- Drizzle migration config: `apps/api/drizzle.config.ts`

## Notes

Could not determine one canonical production host/orchestrator for API (e.g., Railway/ECS/Kubernetes) from code alone. ADR docs mention deployment history, but runtime IaC is not present here.
