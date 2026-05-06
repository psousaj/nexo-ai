# Patterns

> Generated on 2026-04-10

> Last updated: 2026-04-10T10:37:57-03:00
> Repo state: feature/agentic-runtime-openai-sdk @ 499537d

## Overview

Dashboard code follows a composable-first pattern for backend communication and middleware-first pattern for route protection. State management is minimal and focused: auth/session in Pinia, data freshness in Vue Query, UI logic in pages/components.

## Pattern catalog

| Pattern | Where | Status |
|---|---|---|
| Single composable API facade | `app/composables/useDashboard.ts` | Consistent |
| Route middleware auth/role guard | `app/middleware/*.ts` | Consistent |
| Plugin-injected clients | `app/plugins/auth.client.ts`, `api.client.ts` | Consistent |
| Session-derived ability update | `app/stores/auth.ts` + CASL plugin | Consistent |
| Runtime-config-driven base URL | `app/utils/api.ts` | Consistent |

## Code examples

### Auth middleware redirect flow

```ts
if (!isPublicRoute && !authStore.isAuthenticated) {
  return navigateTo('/login', { replace: true });
}
```

Source: `apps/dashboard/app/middleware/auth.global.ts`

### API client normalization

```ts
if (baseUrl.endsWith('/api')) return baseUrl;
return `${baseUrl}/api`;
```

Source: `apps/dashboard/app/utils/api.ts`

### Ability update from user role

```ts
if (newUser.role === 'admin') {
  ability.update([{ action: 'manage', subject: 'all' }]);
}
```

Source: `apps/dashboard/app/stores/auth.ts`

## Error handling strategy

- UI-level try/catch around API calls in composables/pages.
- Warning logs for profile sync failure in auth store.
- Toast notifications used on some pages for user feedback.

## Inconsistencies

| Finding | Evidence | Risk |
|---|---|---|
| Mixed fetch styles (`axios` and `$fetch`) | `useDashboard.ts` vs admin pages | duplicated request behavior |
| Some TODO stubs in admin/profile pages | `pages/admin/users.vue`, `pages/profile/personality.vue` | incomplete UX actions |

## Notes

No global frontend error boundary strategy was found in scanned files.
