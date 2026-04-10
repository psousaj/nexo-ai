# API Surface

> Generated on 2026-04-10

> Last updated: 2026-04-10T10:37:57-03:00
> Repo state: feature/agentic-runtime-openai-sdk @ 499537d

## Overview

No internal REST/GraphQL API client or server endpoint is implemented in `apps/landing`. The app is a static frontend surface with external navigation links.

## External links observed

| Link type | Example in code |
|---|---|
| WhatsApp CTA | `https://wa.me/YOUR_NUMBER` |
| Telegram CTA | `https://t.me/YOUR_BOT` |
| Discord CTA | `href="#"` placeholder |

Source: `apps/landing/src/App.vue`

## Contracts

- No authenticated API contract.
- No versioned API consumption.
- No webhook or callback endpoint.

## Notes

Could not determine real production CTA targets because values are placeholders in current source.
