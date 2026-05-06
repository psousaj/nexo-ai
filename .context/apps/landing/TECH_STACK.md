# Tech Stack

> Generated on 2026-04-10

> Last updated: 2026-04-10T10:37:57-03:00
> Repo state: feature/agentic-runtime-openai-sdk @ 499537d

## Overview

Landing uses a straightforward Vue 3 + Vite frontend stack. Tooling is intentionally small, focused on static site delivery and fast local iteration.

## Inventory

| Category | Technology | Evidence |
|---|---|---|
| Framework | Vue 3 | `apps/landing/package.json` |
| Bundler/dev server | Vite 6 | `apps/landing/package.json`, `vite.config.ts` |
| Styling | Tailwind CSS 3 + CSS | package + `tailwind.config.js` |
| Icons | `lucide-vue-next` | package file |
| Type checking | `vue-tsc` | build script |

## Commands

| Action | Command |
|---|---|
| Dev | `pnpm run dev` |
| Build | `pnpm run build` |
| Preview | `pnpm run preview` |

## Notes

No testing framework dependency is declared in this app package.
