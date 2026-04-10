# Build And Deploy

> Generated on 2026-04-10

> Last updated: 2026-04-10T10:37:57-03:00
> Repo state: feature/agentic-runtime-openai-sdk @ 499537d

## Overview

Intake-worker is built and run as a standalone Node service in the monorepo workspace. It currently has no dedicated container manifest in this folder, so deployment packaging appears to be environment-specific outside this repository or handled by generic workspace tooling.

## Build/run commands

| Action | Command | Source |
|---|---|---|
| Dev | `pnpm run dev` | `apps/intake-worker/package.json` |
| Build | `pnpm run build` | package scripts |
| Start | `pnpm run start` | package scripts |
| Test | `pnpm run test` | package scripts |

## Runtime requirements

| Variable | Purpose |
|---|---|
| `PORT` | service port |
| `INTAKE_WORKER_TOKEN` | optional bearer token gate |
| `MULTIMODAL_AUDIO` | enable audio processing |
| `MULTIMODAL_IMAGE` | enable image processing |

## Notes

Could not determine dedicated CI/CD workflow or deployment target for this app from repository workflow files.
