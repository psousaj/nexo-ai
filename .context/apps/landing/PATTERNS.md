# Patterns

> Generated on 2026-04-10

> Last updated: 2026-04-10T10:37:57-03:00
> Repo state: feature/agentic-runtime-openai-sdk @ 499537d

## Overview

Landing follows single-component page composition with local reactive state and declarative section rendering. It uses static arrays as content sources and simple timer-based animation for social proof counter.

## Pattern catalog

| Pattern | Where | Status |
|---|---|---|
| Single-root component page composition | `src/App.vue` | Consistent |
| Local state refs for UI behavior | `src/App.vue` | Consistent |
| Static content arrays | `features`, `testimonials` in `App.vue` | Consistent |
| CSS-driven section styling | `App.vue` + `style.css` | Consistent |

## Code examples

```ts
const isMenuOpen = ref(false);
const usersCount = ref(0);
```

```ts
const timer = setInterval(() => {
  current += increment;
  usersCount.value = Math.floor(current);
}, 16);
```

Source: `apps/landing/src/App.vue`

## Inconsistencies

| Finding | Evidence | Risk |
|---|---|---|
| Build/generated artifacts tracked in source | `App.vue.js`, `*.d.ts`, `*.map` in `src/` | maintenance noise |

## Notes

No shared component system or design token package integration was observed in this app.
