# Tech Stack

> Generated on 2026-04-10

> Last updated: 2026-04-10T10:37:57-03:00
> Repo state: feature/agentic-runtime-openai-sdk @ 499537d

## Overview

The dashboard is built on Nuxt 4 and Vue 3 with modern frontend tooling: Pinia for state, Vue Query for remote data caching, Axios for API calls, and Better Auth client for session flows. UI composition uses Nuxt UI and Tailwind.

It is configured as SPA (`ssr: false`), favoring predictable client-only auth behavior in this project.

## Technology inventory

| Category | Technology | Evidence |
|---|---|---|
| Framework | Nuxt 4 (`nuxt`) | `apps/dashboard/package.json` |
| UI kit | `@nuxt/ui` | `apps/dashboard/package.json` |
| State | Pinia (`@pinia/nuxt`) | package + store files |
| Data fetching | `@tanstack/vue-query`, Axios | package + plugin/composable files |
| Auth client | `better-auth/vue` | `app/plugins/auth.client.ts` |
| Authorization model | CASL (`@casl/ability`, `@casl/vue`) | `app/plugins/casl.ts` |
| Testing | Vitest, Playwright | `vitest.config.ts`, `playwright.config.ts` |

## Build and run tools

| Action | Command |
|---|---|
| Dev | `pnpm run dev` |
| Build | `pnpm run build` |
| Preview | `pnpm run preview` |
| Typecheck | `pnpm run typecheck` |
| Test unit | `pnpm run test:unit` |
| Test e2e | `pnpm run test:e2e` |

## Runtime config

- Public API URL and auth base URL are read from Nuxt runtime config.
- `apps/dashboard/app/config/env.ts` provides fallback defaults.
- Axios base URL normalization ensures `/api` suffix.

## Notes

Could not determine strict bundle size budgets or performance budgets from config files alone.
