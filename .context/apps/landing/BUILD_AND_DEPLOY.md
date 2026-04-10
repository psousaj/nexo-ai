# Build And Deploy

> Generated on 2026-04-10

> Last updated: 2026-04-10T10:37:57-03:00
> Repo state: feature/agentic-runtime-openai-sdk @ 499537d

## Overview

Landing uses standard Vite build workflow and has explicit Vercel deployment configuration.

## Build commands

| Action | Command | Source |
|---|---|---|
| Dev | `pnpm run dev` | `apps/landing/package.json` |
| Build | `pnpm run build` | package file |
| Preview | `pnpm run preview` | package file |

## Deployment config

| Item | Value | File |
|---|---|---|
| Framework | `vite` | `apps/landing/vercel.json` |
| Build command | `cd ../.. && pnpm build --filter=@nexo/landing` | vercel config |
| Output directory | `dist` | vercel config |
| Install command | `cd ../.. && pnpm install --frozen-lockfile` | vercel config |

## Runtime config

- Local dev port defaults to `3005` in `vite.config.ts`.
- `strictPort: false` allows fallback if occupied.

## Notes

No dedicated CI workflow specific to landing was found.
