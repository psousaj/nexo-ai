# Architecture

> Generated on 2026-04-10

> Last updated: 2026-04-10T10:37:57-03:00
> Repo state: feature/agentic-runtime-openai-sdk @ 499537d

## Overview

The intake-worker architecture is intentionally minimal: one Hono app with health and processing endpoints, adapter abstraction for extraction engines, and shared schema normalization to keep contract behavior consistent with the rest of the monorepo.

It isolates multimodal parsing and extraction logic from the main API process, allowing future scaling or replacement of OCR/STT adapters without touching core webhook/runtime orchestration.

## System diagram

```mermaid
graph LR
  Caller --> Endpoint[/intake/process]
  Endpoint --> TokenCheck[Auth check]
  TokenCheck --> Validate[attachments validation]
  Validate --> Normalize[@nexo/shared normalizer]
  Normalize --> AdapterAudio[STT adapter]
  Normalize --> AdapterImage[OCR adapter]
  AdapterAudio --> Result[items[] response]
  AdapterImage --> Result
```

## Component breakdown

### App factory

- **Responsibility:** defines routes and request flow.
- **Location:** `apps/intake-worker/src/app.ts`
- **Protocol:** HTTP JSON

### Env and flags

- **Responsibility:** parse worker env and derive multimodal feature flags.
- **Location:** `src/config/env.ts`, `src/config/feature-flags.ts`

### Adapters

- **Responsibility:** transform normalized payload to text output.
- **Location:** `src/adapters/ocr/ocr-adapter.ts`, `src/adapters/stt/stt-adapter.ts`

## Layers

1. HTTP transport (Hono).
2. Validation/normalization (`@nexo/shared`).
3. Adapter execution.
4. JSON output.

## Cross-cutting concerns

- **Authentication:** Bearer token check when token configured.
- **Authorization:** none beyond token gate.
- **Logging:** console startup line in `src/index.ts`.
- **Error handling:** explicit JSON error helper with status-specific responses.
- **Configuration:** zod schema from env parser.
