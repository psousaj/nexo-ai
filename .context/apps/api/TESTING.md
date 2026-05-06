# Testing

> Generated on 2026-04-10

> Last updated: 2026-04-10T10:37:57-03:00
> Repo state: feature/agentic-runtime-openai-sdk @ 499537d

## Overview

The API app uses Vitest in Node environment and includes a broad set of tests around orchestrator behavior, adapters, runtime guards, feature flags, enrichment, and transport boundaries. The test suite count is high for the app shell because tests frequently target `apps/api/src` behavior through API-level aliases.

Coverage reporters are configured in Vitest, but CI workflow currently emphasizes lint/typecheck and does not enforce coverage thresholds in GitHub Actions.

## Test framework and config

| Item | Value | Source |
|---|---|---|
| Framework | Vitest | `apps/api/vitest.config.ts` |
| Environment | Node | `apps/api/vitest.config.ts` |
| Setup | `src/tests/setup.ts` | `apps/api/vitest.config.ts` |
| Include pattern | `src/tests/**/*.test.ts` | `apps/api/vitest.config.ts` |
| Coverage reporters | text, json, html | `apps/api/vitest.config.ts` |

## Test inventory

| Metric | Value |
|---|---|
| Test files (scan) | 49 |
| App source files (scan) | 77 |

## Test categories observed

| Category | Example files |
|---|---|
| Orchestrator/runtime | `agent-orchestrator-routing.test.ts`, `agent-orchestrator-context-wiring.test.ts` |
| Intent/classifier | `intent-classifier.test.ts`, `intent-classifier-reminder.test.ts` |
| Adapter/webhook | `evolution-adapter.test.ts`, `discord-adapter.test.ts`, `webhook-routes-evolution-only.test.ts` |
| Feature flags/tools | `feature-flag-service.test.ts`, `tool-availability.service.test.ts` |
| Embedding/AI transport | `embedding-service.test.ts`, `openai-gateway-transport.test.ts` |
| End-to-end behavior slices | `test-semantic-search-e2e.ts`, `test-enrichment-flow.ts` |

## Testing pattern examples

```ts
const app = new Hono().route("/webhook", webhookRoutes);
```

Source: `apps/api/src/tests/webhook-routes-evolution-only.test.ts`

```ts
await featureFlagService.initialize();
```

Source: feature-flag service test files

## Gaps and risks

1. No explicit minimum coverage threshold found in config.
2. CI workflow in `.github/workflows/dashboard-ci.yml` does not run API tests by default.
3. Some integration behaviors depend on external providers and may rely on mocks/stubs.

## Notes

Could not determine flaky-test rates or execution duration trends from static code analysis.
