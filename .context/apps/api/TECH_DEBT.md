# Tech Debt

> Generated on 2026-04-10

> Last updated: 2026-04-10T10:37:57-03:00
> Repo state: feature/agentic-runtime-openai-sdk @ 499537d

## Overview

The API runtime is feature-rich and well-instrumented, but complexity has concentrated in a few large modules. Debt is primarily structural (large files, mixed responsibilities, implicit contracts) rather than foundational architecture mistakes.

This debt assessment includes app shell and its direct runtime dependency `packages/api-core`, because that package is the real behavior engine for API.

## High-risk hotspots

| Severity | Finding | Evidence |
|---|---|---|
| High | Orchestrator monolith | `packages/api-core/src/services/agent-orchestrator.ts` (~2110 LOC) |
| High | Tool registry/execution concentration | `packages/api-core/src/services/tools/index.ts` (~1843 LOC) |
| Medium | Large intent classifier with multi-strategy complexity | `packages/api-core/src/services/intent-classifier.ts` (~1038 LOC) |
| Medium | Admin route file with broad responsibilities | `apps/api/src/routes/dashboard/admin.routes.ts` (~541 LOC) |
| Medium | Queue and message services are heavy and cross many concerns | `queue-service.ts`, `message-service.ts` |

## Quantified signals

| Signal | Value | Notes |
|---|---|---|
| TODO/FIXME/HACK matches (apps+packages+docs filtered) | 22 | includes docs and code comments |
| Files over 500 LOC (source scan) | multiple critical services | includes runtime core hotspots |
| High import-count file(s) | `agent-orchestrator.ts`, `apps/api/src/server.ts` | coupling proxy |

## Debt categories

### Structural coupling

- App shell routes import many singleton services from api-core directly.
- Module boundaries are convention-based; no enforced architecture checks found.

### Operational risk

- Manual OpenAPI object in `apps/api/src/server.ts` can diverge from actual routes.
- Release script performs push/merge logic outside CI policy controls (human-run script).

### Maintainability risk

- Complex state machine logic in one large orchestrator makes isolated changes difficult.
- Tool implementations combine persistence + enrichment + response logic in long modules.

## Suggested debt reduction backlog

1. Split `agent-orchestrator.ts` into state handlers by state/action family.
2. Split `tools/index.ts` by domain (save/search/delete/integration).
3. Move admin route sub-domains into dedicated files (`feature-flags`, `connectivity`, `conversations`, etc.).
4. Generate OpenAPI from route schemas or tests to reduce drift.
5. Add CI job that runs API tests and optional coverage summary.

## Notes

No dead-code analysis tool output was available in this scan, so unused export/dependency claims are intentionally excluded.
