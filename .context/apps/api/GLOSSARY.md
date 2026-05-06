# Glossary

> Generated on 2026-04-10

> Last updated: 2026-04-10T10:37:57-03:00
> Repo state: feature/agentic-runtime-openai-sdk @ 499537d

## Terms

| Term | Meaning in this codebase |
|---|---|
| Agent Orchestrator | Main deterministic runtime coordinator for intent/state/tool flow. |
| Intent Classification Task | Structured internal task that classifies user intent before routing. |
| Tool | Explicit callable capability with contract (save/search/delete/enrich/etc). |
| Global Tool Flag | DB-backed enable/disable switch for tool availability for all users. |
| Pivot Feature Flag | Runtime behavior gate (conversation mode/channel/tool schema). |
| Conversation State | State machine marker for current conversation stage (`idle`, confirmation states, etc). |
| Pending Action | Deferred action payload stored in conversation context awaiting user confirmation. |
| Memory Item | Persisted user content record (movie, note, link, etc) in `memory_items`. |
| Semantic External Item | Cached external enrichment data + embedding for reuse. |
| Session Key | Composite routing identity used for multi-channel session context. |
| Intake Worker | Separate app for multimodal attachment normalization/processing. |
| Evolution API | WhatsApp runtime/provider integration used by this backend. |
| Better Auth | Session/auth framework used for `/api/auth/*` and dashboard login. |
| Bull Board | Queue monitoring UI mounted at `/admin/queues`. |
| Langfuse | AI observability/tracing layer for LLM interactions. |

## Notes

Terminology for some concepts appears in ADRs and comments with slight naming variation (e.g., "provider", "channel", "account"). When in doubt, prefer schema field naming as canonical source.
