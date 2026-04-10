# API Surface

> Generated on 2026-04-10

> Last updated: 2026-04-10T10:37:57-03:00
> Repo state: feature/agentic-runtime-openai-sdk @ 499537d

## Overview

Intake-worker exposes two endpoints: health status and multimodal processing. The processing endpoint accepts JSON payload with attachments and returns normalized extracted text items.

## Endpoint catalog

| Method | Path | Auth | Purpose | Source |
|---|---|---|---|---|
| GET | `/health` | none | worker status and feature flags | `apps/intake-worker/src/app.ts` |
| POST | `/intake/process` | Bearer token if configured | process attachments array | `apps/intake-worker/src/app.ts` |

## Request contract (`/intake/process`)

- Body must include `attachments: unknown[]`.
- Each attachment is validated by shared multimodal schemas.
- Feature flag constraints apply by `kind`.

## Response contract

Success response contains:

```json
{
  "items": [
    {
      "kind": "audio|image",
      "messageId": "...",
      "text": "...",
      "metadata": {
        "provider": "...",
        "transport": "url|base64",
        "mimeType": "..."
      }
    }
  ]
}
```

## Error responses

| Status | Error |
|---|---|
| 400 | invalid_request |
| 401 | unauthorized |
| 422 | unprocessable_attachment |
| 500 | internal_error |

## Notes

No versioned path prefix was found for this service.
