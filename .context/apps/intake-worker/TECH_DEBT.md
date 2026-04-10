# Tech Debt

> Generated on 2026-04-10

> Last updated: 2026-04-10T10:37:57-03:00
> Repo state: feature/agentic-runtime-openai-sdk @ 499537d

## Overview

Debt level is low to medium due to small scope. Main debt is implementation completeness: extraction adapters are placeholders and operational hardening is minimal.

## Findings

| Severity | Finding | Evidence |
|---|---|---|
| Medium | OCR/STT adapters are stubs | `src/adapters/ocr/ocr-adapter.ts`, `src/adapters/stt/stt-adapter.ts` |
| Low | No persistence/audit trail in worker | app-only request/response flow |
| Low | Minimal observability/logging | startup console log only |

## Risks

1. Contract can be validated but text extraction quality may not meet production needs.
2. Lack of tracing can complicate issue diagnosis when integrated upstream.
3. Without queue/retry, caller must handle retries on transient failures.

## Suggested backlog

1. Replace stub adapters with production OCR/STT providers.
2. Add structured logging and trace correlation IDs.
3. Consider optional async queue mode for large payload bursts.

## Notes

No high coupling or file-size hotspot was found in this app.
