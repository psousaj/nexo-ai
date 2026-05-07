# Nexo v0.7 Hermes Engine Design

**Date:** 2026-05-07  
**Status:** Approved  
**Scope:** Full-system design spec for the Hermes Engine inside the Nexo monorepo

## 1. Problem Statement

The current Nexo codebase already has strong pieces for a modern agent system: multichannel adapters, enrichment providers, embeddings, hybrid memory search, context assembly, and a tool catalog. The main problem is that the cognitive core is still too coupled. The current `AgentOrchestrator` mixes state handling, routing, clarification, direct tool execution, and response control in one large flow. That makes the system hard to evolve into an assistive agent that can handle ambiguous input, audio-first usage, long-term memory, and high-autonomy actions safely.

Hermes Engine exists to replace that center of gravity without discarding the infrastructure Nexo already built well. The goal is not to "use Hermes from outside." The goal is to implement the same architectural philosophy natively inside Nexo: a bounded agent runtime, strong registries, memory as a first-class system, and proactive cognition with auditability.

## 2. Product Goals

The v0.7 design is anchored on these product decisions:

- **Balanced triad:** capture well, recall well, and act well from day one.
- **Assistive focus:** the engine must work for older adults and users with attention or memory difficulties.
- **Input parity:** audio and text are first-class inputs.
- **Channel parity:** Telegram and WhatsApp have practical parity in the first version.
- **Single-user model:** the first design targets one end user, not caregiver or family networks.
- **High autonomy:** the engine can act proactively and execute low-risk actions without waiting for confirmation every time.
- **Hybrid agent runtime:** the LLM plans and reasons inside a bounded runtime, but policies, state, persistence, and audit remain owned by code.
- **Near-rewrite inside the monorepo:** the new core is built natively in Nexo and replaces the old center gradually, while reusing infrastructure that already works.

## 3. Non-Goals

The following are explicitly out of scope for v0.7:

- Multi-user, caregiver, or family permission models
- Group-chat parity as a primary requirement
- Automatic code rewriting or automatic procedural workflow mutation
- A rigid domain schema as the main memory model
- A thin wrapper around an external Hermes service

## 4. Current Assets to Reuse and Boundaries to Change

The current repository contains important building blocks that should be reused behind new boundaries.

| Existing asset | Role in v0.7 | Design decision |
| --- | --- | --- |
| `apps/api/src/adapters/messaging/*` | Provider integration | Reuse as transport adapters only; remove business logic from them |
| `apps/api/src/services/enrichment/*` | External metadata enrichment | Reuse as provider implementations behind the Semantic Wrapper pipeline and tool providers |
| `apps/api/src/services/ai/embedding-service.ts` | Embedding generation | Reuse for semantic wrapper and retrieval |
| `apps/api/src/services/memory-search.ts` | Hybrid retrieval | Evolve into Hermes retrieval/context services behind registries |
| `apps/api/src/services/context-builder.ts` | Long-term context assembly | Evolve into Hermes context assembler with session-aware prompt building |
| `apps/api/src/services/tools/*` | Tool contracts and metadata | Replace the current split approach with one first-class registry model |
| `apps/api/src/services/agent-orchestrator.ts` | Legacy cognitive core | Retire as the final center of the system |
| `apps/api/src/services/ai/openai-manual-loop.ts` | Early manual agent loop | Replace with a generic registry-driven kernel; no hardcoded minimal tool subset |

## 5. Target Architecture

Hermes Engine introduces a new native core inside the monorepo. The new architecture is built from these layers:

1. **Provider Adapters** normalize Telegram and WhatsApp events.
2. **Ingestion Gateway** converts provider events into canonical intake contracts.
3. **Hermes Kernel** runs bounded agent turns.
4. **Tool Registry** exposes all executable capabilities through a single policy-aware catalog.
5. **Session Registry** owns session state and transitions.
6. **Memory Registry** owns storage, retrieval, derived memory, and storage routing.
7. **Semantic Wrapper Pipeline** interprets and enriches every saved artifact before commit.
8. **Retrieval and Context Assembly** build the working context for each turn.
9. **Proactive Jobs** refresh memory and generate derived context over time.
10. **Outgoing Gateway** delivers responses in a channel-aware form.
11. **Observability and Policy Layer** audits every important decision.

### High-Level Flow

```text
Telegram / WhatsApp
        |
        v
Provider Adapter
        |
        v
Ingestion Gateway
        |
        v
IntakeEnvelope
        |
        v
Hermes Kernel <----> Session Registry
     |      \
     |       \----> Tool Registry ----> External providers / internal services
     |
     \----> Memory Registry <---- Semantic Wrapper Pipeline <---- Enrichment / Embeddings
                     |
                     +----> Postgres
                     +----> pgvector
                     \----> Redis
        |
        v
Outgoing Gateway
```

## 6. Canonical Contracts

### 6.1 `IntakeEnvelope`

Every inbound interaction is normalized into an `IntakeEnvelope`. This is the only contract the kernel receives from the transport side.

Required conceptual fields:

- `envelope_id`
- `provider`
- `provider_event_id`
- `user_id`
- `linked_channel_identity`
- `session_key`
- `received_at`
- `message_kind` (`text`, `audio`, `image`, `link`, `mixed`)
- `raw_text`
- `attachments`
- `transcription` with confidence metadata when audio exists
- `provider_payload_ref`
- `idempotency_key`

### 6.2 `ObservationEnvelope`

Every tool result or internal observation returns to the kernel as an `ObservationEnvelope`.

Required conceptual fields:

- `observation_id`
- `turn_id`
- `source_tool`
- `status`
- `structured_output`
- `side_effects`
- `confidence`
- `observed_at`
- `audit`

This keeps the core in an explicit observe -> act -> observe cycle instead of passing loose objects across services.

### 6.3 `MemoryEnvelope`

`MemoryEnvelope` is the canonical memory unit. All memory-relevant artifacts enter the system through this structure.

Required conceptual fields:

- `memory_envelope_id`
- `schema_version`
- `user_id`
- `session_key`
- `source_kind` (`intake`, `observation`, `derived`, `job`)
- `source_channel`
- `created_at`
- `raw_artifact`
- `normalized_content`
- `artifact_metadata`
- `confidence`
- `uncertainty_signals`
- `entity_extractions`
- `typed_projection_candidates`
- `linked_memory_ids`
- `embedding_refs`
- `audit`
- `relevance_decay`

### 6.4 `schema_version`

Because the envelope is canonical, it must carry its own version. This lets future pipelines handle envelopes created by earlier system generations without corrupting interpretation or forcing destructive migrations.

### 6.5 `relevance_decay`

Every memory envelope carries declarative decay semantics. This is not only a ranking hint; it is part of lifecycle management.

The design uses these decay classes:

- **`ephemeral`**: short-lived situational context
- **`contextual`**: medium-term context that may matter again
- **`durable`**: long-term preference, fact, or recurring routine
- **`critical`**: high-importance memory that should not decay out of practical retrieval

`relevance_decay` also tracks:

- `last_accessed_at`
- `reinforcement_count`
- `decay_score`
- `expires_after_days` when applicable

This allows the engine to reduce long-term noise for assistive usage patterns without deleting everything indiscriminately.

## 7. Hybrid Envelope Memory Model

The memory system is not schema-first. It is **hybrid-envelope first**.

The canonical truth is the envelope itself: raw artifact, normalized content, uncertainty, evidence, and lineage. Typed memory exists as **optional projections**, not as the only legal shape. A movie, song, reminder, person, routine, medication signal, or device reference can all be represented as typed projections built on top of the same envelope model.

This design solves the rigidity problem that affected earlier iterations of Nexo:

- the system can accept ambiguous or poorly described input first;
- the meaning can be improved later through enrichment and linking;
- domain understanding can evolve without redesigning the whole memory substrate.

## 8. Semantic Wrapper Pipeline

No memory-relevant data is committed directly to final storage. Everything passes through a centralized **Semantic Wrapper** pipeline first.

The pipeline stages are:

1. **Artifact capture**: preserve raw text, audio, media, or tool result.
2. **Normalization**: transcribe, clean, and structure the input.
3. **Intent and meaning hypotheses**: produce candidate interpretations.
4. **Entity extraction**: identify people, media, reminders, routines, places, or other concepts.
5. **Enrichment dispatch**: call TMDB, Spotify, Books, YouTube, OpenGraph, and other providers when appropriate.
6. **Linking and deduplication**: connect with existing memories and avoid redundant storage.
7. **Embedding generation**: generate semantic vectors for retrieval.
8. **Projection generation**: materialize typed projections only when confidence supports them.
9. **Commit through Memory Registry**: route the final write to Postgres, pgvector, and Redis as needed.

This centralizes the spirit of the existing enrichment system while removing provider-specific branching from the main agent loop.

## 9. Hermes Kernel and Session Model

### 9.1 `HermesKernel`

The new heart of the system is `HermesKernel.runTurn(IntakeEnvelope)`.

Each turn executes a bounded loop:

1. Load session snapshot and relevant context.
2. Ask the model to decide the next step.
3. If the next step is a tool call, validate it through the registry and execute it.
4. Convert the result into an `ObservationEnvelope`.
5. Rebuild working context if needed.
6. Stop only on `respond`, `await_confirmation`, `halt`, or explicit error.

The loop is bounded by:

- maximum rounds
- token budget
- wall-clock budget
- policy gates
- retry limits

### 9.2 State-machine decoupling

The kernel does not access the database directly. It asks the **Session Registry** for state reads and state transitions.

The Session Registry owns:

- active session status
- pending confirmations
- resumable intent state
- retry counters
- temporary working context
- wait states for external completion

This satisfies the architectural requirement that the cognitive core does not directly own persistence.

### 9.3 Policy classes

The runtime enforces policy classes in code, not only in prompt wording.

| Policy class | Meaning |
| --- | --- |
| `auto` | Safe to execute automatically |
| `confirm` | Requires explicit confirmation before execution |
| `deny` | Not allowed in the current runtime or context |

Given the product decision for high autonomy, these defaults apply:

- **Auto:** retrieval, summarization, semantic save, reminder organization, low-risk internal updates, proactive low-risk nudges
- **Confirm:** destructive actions, irreversible actions, financially sensitive actions, privacy-sensitive ambiguous actions
- **Deny:** actions outside the configured trust boundary

## 10. Tool Registry

The Tool Registry becomes the only executable capability catalog visible to the kernel.

Each tool entry includes:

- tool name
- description
- JSON Schema contract
- supported modalities
- side-effect class
- idempotency behavior
- timeout
- retryability
- cooldown or rate limit
- auth requirements
- policy class

This replaces the current split between tool metadata, standalone functions, and a manual loop that only supports a minimal hardcoded subset. In Hermes Engine, the registry dynamically compiles the allowed catalog for the current turn.

Enrichment providers, memory operations, reminder operations, session operations, and delivery helpers are all represented through this single abstraction layer.

## 11. Gateway, Sessions, and Multimodal Ingestion

Telegram and WhatsApp adapters remain important, but they stop making cognitive decisions. Their job is transport normalization and secure ingress.

The **Ingestion Gateway** owns:

- validation of provider events
- attachment resolution
- idempotency
- `IntakeEnvelope` creation
- queue handoff

### Audio and text parity

Audio is treated as a first-class input, not as a side attachment.

For audio:

1. store the raw artifact;
2. run speech-to-text;
3. attach transcription and confidence;
4. forward ambiguity as part of the data contract.

For text:

1. preserve the raw text;
2. normalize into the same intake structure.

This means the kernel always sees a unified interaction object, regardless of whether the user typed clearly, typed vaguely, or sent a short audio.

### Identity and session boundaries

Each provider retains its own channel identity, but both Telegram and WhatsApp can link to the same internal user. Session state stays channel-aware, while long-term memory stays user-owned.

The first version is designed for **1:1 sessions**. Group scenarios are left architecturally possible but are not a first-order constraint.

### Outgoing Gateway

The **Outgoing Gateway** decides how to deliver a response based on channel capabilities:

- text
- audio replies
- typing or waiting indicators
- buttons or quick actions when supported

The kernel decides **what** should happen. The gateway decides **how** to express that safely on each channel.

## 12. Retrieval and Context Assembly

Retrieval is built on top of the hybrid envelope memory model and reuses the existing strengths of Nexo's semantic search stack.

The retrieval/context layer is responsible for:

- hybrid vector + keyword retrieval
- recent-session recall
- active routines and pending reminders
- durable user preferences
- derived memory from self-improvement and refresh jobs
- uncertainty-aware context shaping

The prompt/context assembler should preserve the useful behavior of the current `context-builder.ts`, including:

- session-scoped context
- memory summaries instead of raw dumps
- prompt snapshot caching where safe
- profile and identity injection

The difference is that v0.7 assembles context from registries and envelopes rather than from a partially ad hoc combination of services and profile content.

## 13. Proactive Refresh and Learning

Hermes Engine learns declaratively and auditably.

### 13.1 `SelfImprovementReview`

After relevant turns or complex tasks, the engine can run a short review pass to extract:

- preferences
- stable habits
- resolved conflicts
- recurring references
- workflow lessons that belong in declarative memory

This does **not** rewrite code or auto-edit procedural workflows. It only creates derived memory with provenance.

### 13.2 `ProactiveRefreshJob`

Periodic jobs revisit older envelopes and projections to detect:

- forgotten tasks
- drifting routines
- repeated references
- context worth summarizing
- outdated but still useful durable memories

These jobs can create:

- summary envelopes
- reminder candidates
- confidence-scored derived facts
- proactive nudges

### 13.3 Decay and cleanup

`relevance_decay` influences both ranking and hygiene. Ephemeral noise loses weight naturally unless reinforced by future access, linking, or repeated importance signals.

This is necessary for assistive usage because users may generate a high volume of short-lived context that should not permanently dominate retrieval quality.

### 13.4 Auditability

Every learned or refreshed fact must answer:

- what source envelopes supported it
- what rule or inference created it
- when it was created
- what confidence it carries
- how it changes future behavior

## 14. Safety, Failure Handling, and Observability

Hermes Engine is designed for high autonomy, so runtime safety is part of the core design.

### 14.1 Failure handling

Failures are explicit and layer-specific:

- gateway failures
- ingestion failures
- transcription failures
- enrichment failures
- retrieval failures
- tool execution failures
- delivery failures

When a downstream dependency fails, the system should:

1. preserve the raw envelope;
2. record the failure in audit data;
3. retry when safe and idempotent;
4. degrade gracefully when retry is not enough.

Graceful degradation includes:

- asking a clarifying question
- continuing with partial context
- stating uncertainty explicitly
- scheduling a deferred retry

### 14.2 Idempotency and retries

Inbound events, tool calls, and jobs must all support stable ids and deduplication. This prevents duplicate reminders, duplicate writes, or repeated side effects when Telegram or WhatsApp retries delivery.

### 14.3 Explainability

When the engine acts from memory or inference, it should be able to explain itself simply. Assistive trust depends on the user understanding why the system remembered, suggested, or acted.

### 14.4 Observability

Every turn and job should emit:

- trace id
- context hash
- selected tools
- policy decisions
- latency
- retries
- failures
- side effects
- final user-visible response

This makes autonomous behavior debuggable instead of opaque.

## 15. Proposed Module Layout Inside the Monorepo

The new core should live under a dedicated Hermes subtree in `apps/api/src/`.

```text
apps/api/src/hermes/
  adapters/
  contracts/
  gateway/
  kernel/
  policies/
  registries/
  memory/
  retrieval/
  context/
  jobs/
  delivery/
  observability/
```

The implementation target is:

- reuse current infrastructure services where they are already strong;
- stop extending the legacy orchestrator as the long-term center;
- make the Hermes subtree the final core for conversational cognition.

## 16. Validation Strategy

v0.7 is not valid because the code compiles. It is valid only when the new architecture proves the balanced triad in real scenarios.

### 16.1 Layered testing

The system needs tests for:

- provider adapters
- ingestion gateway
- STT and multimodal normalization
- kernel loop behavior
- registry contracts
- semantic wrapper pipeline
- retrieval and context building
- proactive jobs
- outgoing delivery
- policy enforcement

### 16.2 Required assistive scenarios

End-to-end validation must cover these scenarios:

| Scenario | Expected outcome |
| --- | --- |
| Short ambiguous text from an older user | The engine asks, infers, or retrieves context safely instead of failing literally |
| Erratic or fragmented input from a user with attention difficulties | The engine captures intent without forcing rigid syntax |
| Low-confidence audio | The engine keeps the artifact, surfaces uncertainty, and resolves safely |
| Vague reference such as "that medicine" or "the thing for the light" | Retrieval and context linking recover the right memory or ask focused clarification |
| Save flow with enrichment | The artifact is committed through the Semantic Wrapper and becomes searchable |
| Proactive reminder or summary | The engine acts or asks according to policy and produces audit traces |
| Decay of trivial short-lived information | Retrieval quality improves over time instead of getting noisier |

### 16.3 Shadow mode and replay

Before full cutover, the new kernel should be able to replay real or recorded envelopes and compare outcomes against the current system. This is the safest way to validate behavior while the legacy system still exists.

## 17. Acceptance Criteria

The v0.7 Hermes Engine design is considered successfully realized when the new core can do all of the following in Telegram and WhatsApp:

1. Receive text and audio through the same canonical intake model.
2. Interpret ambiguous user input with context instead of rigid literal parsing.
3. Save memory only through the Semantic Wrapper pipeline.
4. Retrieve semantically relevant long-term context through the envelope model.
5. Execute useful low-risk actions autonomously with runtime guardrails.
6. Ask for confirmation on destructive or sensitive actions.
7. Generate proactive summaries or nudges from old envelopes with full auditability.
8. Expose explainable behavior instead of opaque autonomous decisions.

## 18. Final Design Summary

Nexo v0.7 Hermes Engine is a native assistive agent core built inside the monorepo. It keeps Nexo's strongest infrastructure pieces, but replaces the current cognitive center with a registry-driven, envelope-based, multimodal, policy-aware runtime. The design is intentionally full-system: capture, recall, and action are treated as one architecture, because assistive autonomy only works when those three pillars are designed together.
