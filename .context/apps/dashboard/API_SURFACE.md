# API Surface

> Generated on 2026-04-10

> Last updated: 2026-04-10T10:37:57-03:00
> Repo state: feature/agentic-runtime-openai-sdk @ 499537d

## Overview

Dashboard primarily consumes backend APIs from `apps/api` and Better Auth endpoints. This document catalogs the outbound API surface used by dashboard code, not server-side route declarations.

## Outbound endpoint catalog

### User profile/accounts/preferences

| Method | Path | Purpose | Evidence |
|---|---|---|---|
| GET | `/user/profile` | profile details | `app/stores/auth.ts` |
| GET | `/user/accounts` | linked accounts | `app/composables/useDashboard.ts` |
| GET | `/user/preferences` | read preferences | `app/composables/useDashboard.ts` |
| PATCH | `/user/preferences` | update preferences | `app/composables/useDashboard.ts` |
| POST | `/user/link/telegram` | generate telegram link token | `app/composables/useDashboard.ts` |
| GET | `/user/link/discord` | oauth link | `app/composables/useDashboard.ts` |
| GET | `/user/link/google` | oauth link | `app/composables/useDashboard.ts` |
| DELETE | `/user/accounts/:provider` | unlink account | `app/composables/useDashboard.ts` |

### Memories and analytics

| Method | Path | Purpose |
|---|---|---|
| GET | `/memories` | list/search memory items |
| POST | `/memories` | create memory item |
| PATCH | `/memories/:id` | update memory item |
| DELETE | `/memories/:id` | delete memory item |
| GET | `/analytics` | dashboard KPIs |

### Admin

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/users` | user management table |
| GET | `/admin/conversations` | conversations summary |
| GET | `/admin/conversations/:id/messages` | conversation audit |
| GET/POST/PATCH | `/admin/tools*` | tool controls |
| GET/PATCH | `/admin/feature-flags*` | feature flag controls |
| GET/POST | `/admin/whatsapp-settings*` | WhatsApp operational controls |

## Auth and transport

| Concern | Mechanism |
|---|---|
| Session transport | cookies with `withCredentials: true` |
| API client | Axios instance from `app/utils/api.ts` |
| Auth client | Better Auth Vue client plugin |

## Versioning

No client-side explicit API version path usage (`/v1`, `/v2`) was found.

## Notes

Could not determine full endpoint usage coverage from composables only; some pages call `$fetch` directly and may bypass shared adapter patterns.
