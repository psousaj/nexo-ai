# Testing

> Generated on 2026-04-10

> Last updated: 2026-04-10T10:37:57-03:00
> Repo state: feature/agentic-runtime-openai-sdk @ 499537d

## Overview

Dashboard uses Vitest (jsdom) for unit/spec tests and Playwright for browser end-to-end tests. Test footprint in repository scan is still small compared to UI surface area, indicating potential coverage gaps for complex admin/profile flows.

## Framework and config

| Item | Value | Source |
|---|---|---|
| Unit test framework | Vitest | `apps/dashboard/vitest.config.ts` |
| Unit environment | jsdom | `apps/dashboard/vitest.config.ts` |
| Unit include | `src/tests/**/*.{test,spec}.{ts,js}` | `apps/dashboard/vitest.config.ts` |
| E2E framework | Playwright | `apps/dashboard/playwright.config.ts` |
| E2E projects | Chromium desktop | `playwright.config.ts` |

## Metrics

| Metric | Value |
|---|---|
| Test files (scan) | 4 |
| Source files (scan) | 260 |

## Patterns observed

- Small sample tests under `apps/dashboard/src/tests/*`.
- Playwright config integrates with Nuxt test utilities root.
- No explicit frontend coverage thresholds found in config.

## Risks

1. Low test-to-source ratio for a broad UI surface.
2. Many route/middleware/auth scenarios may rely on manual QA.
3. Admin pages with TODO actions likely have no final behavior tests yet.

## Notes

Could not determine current CI execution of dashboard Playwright tests from workflows scanned.
