# Glossary

> Generated on 2026-04-10

> Last updated: 2026-04-10T10:37:57-03:00
> Repo state: feature/agentic-runtime-openai-sdk @ 499537d

## Terms

| Term | Meaning in this app |
|---|---|
| Auth Store | Pinia store that projects Better Auth session into app user state. |
| Callback URL | Redirect target preserved during login navigation. |
| Public route | Route allowed without active session (`/login`, `/signup`, `/confirm-email`). |
| Role middleware | Route middleware that blocks non-admin access to `/admin/*`. |
| CASL ability | Frontend permission model updated from role/permissions. |
| Dashboard composable | `useDashboard()` endpoint facade used by pages/components. |
| Runtime config | Nuxt public config containing API/Auth base URLs. |
| Memory view model | Frontend representation of backend memory item payload. |
| Conversation audit | Admin view into message history for a conversation. |

## Notes

Terminology is UI-facing and may differ from backend schema naming in `packages/api-core`.
