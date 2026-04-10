# Modules

> Generated on 2026-04-10

> Last updated: 2026-04-10T10:37:57-03:00
> Repo state: feature/agentic-runtime-openai-sdk @ 499537d

## Overview

The intake-worker module layout is compact and maps directly to runtime stages: startup, app flow, adapters, config, and tests.

## Module inventory

### app-core

- **Path:** `apps/intake-worker/src/app.ts`
- **Responsibility:** route definitions (`/health`, `/intake/process`), validation path, adapter dispatch.
- **Public interface:** `createIntakeWorkerApp()`.

### startup

- **Path:** `apps/intake-worker/src/index.ts`
- **Responsibility:** start HTTP server with env port.

### adapters

- **Path:** `apps/intake-worker/src/adapters/**`
- **Responsibility:** pluggable extraction behavior for audio/image.
- **Current state:** stub implementations.

### config

- **Path:** `apps/intake-worker/src/config/**`
- **Responsibility:** env parsing and feature flag derivation.

### shared-contract-link

- **Path:** external dependency `@nexo/shared`
- **Responsibility:** normalized schema and parser contract.

## Dependency graph

```mermaid
graph LR
  Index --> App
  App --> Config
  App --> Shared[@nexo/shared]
  App --> OCR
  App --> STT
```

## Notes

Could not determine adapter plug-in discovery mechanism beyond direct class instantiation in app factory.
