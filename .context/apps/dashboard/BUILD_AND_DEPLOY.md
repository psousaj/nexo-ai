# Build And Deploy

> Generated on 2026-04-10

> Last updated: 2026-04-10T10:37:57-03:00
> Repo state: feature/agentic-runtime-openai-sdk @ 499537d

## Overview

Dashboard build uses Nuxt pipeline in a pnpm workspace context. Deployment target is Vercel with app-local `vercel.json` that runs workspace-aware install/build commands from monorepo root.

## Build commands

| Action | Command | Source |
|---|---|---|
| Dev | `pnpm run dev` | `apps/dashboard/package.json` |
| Build | `pnpm run build` | `apps/dashboard/package.json` |
| Preview | `pnpm run preview` | `apps/dashboard/package.json` |
| Typecheck | `pnpm run typecheck` | `apps/dashboard/package.json` |

## Deployment configuration

| Item | Value | File |
|---|---|---|
| Framework | `nuxtjs` | `apps/dashboard/vercel.json` |
| Build command | `cd ../.. && pnpm build --filter=@nexo/dashboard` | `apps/dashboard/vercel.json` |
| Output directory | `.output` | `apps/dashboard/vercel.json` |
| Install command | `cd ../.. && pnpm install --frozen-lockfile` | `apps/dashboard/vercel.json` |

## CI evidence

- GitHub Actions workflow `dashboard-ci.yml` runs lint and typecheck on push.
- No explicit dashboard build or test job found in that workflow.

## Environment and runtime

- Nuxt runtime config expects `public.apiUrl` and `public.authBaseUrl`.
- Dashboard defaults to port 5173 in local dev.
- SSR disabled in config, so deployment behavior is SPA/client rendering.

## Notes

Could not determine whether preview/production environment variable sets are validated at deploy time in CI.
