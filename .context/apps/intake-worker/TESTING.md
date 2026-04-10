# Testing

> Generated on 2026-04-10

> Last updated: 2026-04-10T10:37:57-03:00
> Repo state: feature/agentic-runtime-openai-sdk @ 499537d

## Overview

Intake-worker test setup uses Vitest in Node environment. Given the small app scope, tests are focused on app route behavior and adapter interactions.

## Config summary

| Item | Value | Source |
|---|---|---|
| Framework | Vitest | `apps/intake-worker/vitest.config.ts` |
| Environment | Node | `apps/intake-worker/vitest.config.ts` |
| Include pattern | `src/tests/**/*.test.ts` | config file |
| Alias | `@` -> `./src`, plus `@nexo/shared` | config file |

## Metrics

| Metric | Value |
|---|---|
| Test files (scan) | 3 |
| Source files (scan) | 10 |

## Test focus

| Area | Files |
|---|---|
| App endpoint flow | `src/tests/app.test.ts` |
| Adapter behavior | `src/tests/adapters.test.ts` |

## Notes

Could not determine coverage percentage from static scan.
