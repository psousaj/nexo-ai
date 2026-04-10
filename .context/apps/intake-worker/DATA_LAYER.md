# Data Layer

> Generated on 2026-04-10

> Last updated: 2026-04-10T10:37:57-03:00
> Repo state: feature/agentic-runtime-openai-sdk @ 499537d

## Overview

Intake-worker does not have a persistence layer. It performs request-time validation/transformation and returns derived outputs immediately. Any long-term storage is expected to happen in other services.

## Data handling inventory

| Layer | Technology | Notes |
|---|---|---|
| Input validation | Zod schemas via `@nexo/shared` | request payload contracts |
| Feature gating | env-derived booleans | request acceptance control |
| In-memory processing | JS objects | no DB/cache writes |

## Access patterns

- Parse request JSON.
- Validate `attachments` array presence.
- Normalize each payload.
- Dispatch to adapter and build response objects.

## Notes

Could not determine downstream persistence contract from this app alone; caller integration decides how extracted items are stored.
