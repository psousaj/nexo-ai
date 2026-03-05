# PLAN — Nexo AI Pivot to a Conversational Memory Assistant

## 1) Goal

Refactor Nexo AI from a CRUD-first assistant into a **free conversational companion** that still enforces **strict deterministic execution** for side effects (save/update/delete/integrations).

Core product behavior:
- Free conversation by default (max 2–3 paragraphs per reply).
- Detect memory-capture intent from slash commands, natural language, audio, and image.
- Execute tools only through a strict JSON contract (`AgentDecisionV2`).
- Keep tone/humor configurable per user profile (friendly by default).

Target stack direction:
- Keep **pnpm**.
- Runtime: **Bun**.
- HTTP framework migration: **Hono -> Elysia**.
- Cron migration: **node-cron -> @elysiajs/cron**.

---

## 2) Program milestones

- **M0 — Baseline & Guardrails**
  - Observability, feature flags, schema telemetry, eval baseline.
- **M1 — Conversational Freedom**
  - Open chat flow + short-response policy + companion behavior.
- **M2 — Strict Tool Contract V2**
  - Runtime validation gate for all tool calls.
- **M3 — Multimodal Memory Intake**
  - Audio STT + image OCR (Python worker) + fallbacks.
- **M4 — Provider Decoupling**
  - Messaging core extraction + Discord split app.
- **M5 — Elysia Migration**
  - HTTP and cron migration completed.
- **M6 — Hardening & Go-Live**
  - KPI/SLO closure + operational readiness.
- **M7 — Telegram Native Experience**
  - Integrate high-value Telegram-native bot features into the Nexo conversational memory flow.

---

## 3) Current implementation status

### Completed and already merged into PR #93

1. `AgentDecisionV2` contract scaffold
   - `apps/api/src/types/agent-decision-v2.ts`
   - Exported via `apps/api/src/types/index.ts`

2. V2 parser helpers and runtime validation hooks
   - `apps/api/src/utils/json-parser.ts`

3. Pivot feature flag scaffold
   - `packages/env/src/index.ts`
   - `apps/api/src/config/pivot-feature-flags.ts`

4. Telemetry for V2 parse validity/invalidity
   - Metrics:
     - `agent_decision_v2_parse_valid_total`
     - `agent_decision_v2_parse_invalid_total`

5. Admin route for effective pivot flags
   - `GET /api/admin/pivot-feature-flags`
   - `apps/api/src/routes/dashboard/admin.routes.ts`

6. Tests delivered and green for the above
   - `agent-decision-v2.test.ts`
   - `json-parser-agent-decision-v2.test.ts`
   - `pivot-feature-flags.test.ts`
   - `admin-routes-pivot-feature-flags.test.ts`

7. Obsolete file removed
   - Deleted: `TODO_FEATURE_FLAGS.md`
   - Its content is now tracked in this plan and in session plan.

### Milestone progress snapshot

- M0: **In progress**
- M1: Pending
- M2: **Partially done** (contract + parser foundation done; orchestrator rollout pending)
- M3: Pending
- M4: Pending
- M5: Pending
- M6: Pending
- M7: Pending

---

## 4) Feature-flag rollout map (migrated from old TODO file)

Active pivot capabilities controlled by flags:
- `CONVERSATION_FREE`
- `TOOL_SCHEMA_V2`
- `MULTIMODAL_AUDIO`
- `MULTIMODAL_IMAGE`
- `PROVIDER_SPLIT`
- `ELYSIA_RUNTIME`

Rollout rules:
1. Dev -> Staging -> Canary -> Production.
2. Roll forward by capability, never big-bang.
3. Keep explicit rollback path per flag.
4. Any side-effect flow must stay deterministic, even when `CONVERSATION_FREE=true`.

---

## 5) Parallel technical tickets (execution-ready)

### Scope additions (confirmed)

- Support **bodyless memories** (`raw_content` optional).
- Enforce **type-specific rich metadata** for save/search quality.
- Movie save requires rich fields (title, year, director, cast, genres, overview, etc.).
- Long contextual text (e.g., recipes) can be saved as note with short `semantic_context`.
- If intent is ambiguous, ask a clarification question before saving.

### Tickets

#### Track A — Memory model and vector quality

- **TKT-A1: Memory canonical model v2**
  - Unified fields: `memory_type`, `source_modality`, `raw_content?`, `semantic_context`, `metadata`.
  - Explicit support for bodyless memories.

- **TKT-A2: Embedding document builders by type**
  - Per-domain vector builders.
  - Movie builder includes rich metadata.
  - Long notes include normalized body + short semantic summary.

#### Track B — Save/search tools

- **TKT-B1: Rich domain save tools contracts**
  - Strengthen save contracts per type (movie/book/music/link/note/etc.).
  - Require minimum metadata before persistence.

- **TKT-B2: Generic bodyless memory save flow**
  - Tool/path for short insights without full body content.

- **TKT-B3: Search strategy by domain**
  - Hybrid retrieval (structured + vector) tuned by memory type.

#### Track C — Runtime behavior and policies

- **TKT-C1: Ambiguity policy**
  - Ask clarifying questions for type ambiguity.
  - Prefer note flow for long contextual text.

- **TKT-C2: Note contextualizer**
  - Extract compact title, 1–3 sentence context, tags, vector doc.

- **TKT-C3: Orchestrator V2 integration**
  - Plug `AgentDecisionV2` into orchestrator runtime with deterministic side-effect gate.

#### Track D — Verification and quality

- **TKT-D1: Test matrix**
  - Unit/integration/e2e for:
    - rich movie save
    - recipe -> note
    - bodyless memory
    - ambiguity handling

- **TKT-D2: KPI baseline + regression guardrails**
  - Track invalid JSON, false-save rate, latency, retrieval quality.

### Dependency waves

1. **Wave 1:** A1 + C1  
2. **Wave 2:** A2 + B1 + C2  
3. **Wave 3:** B2 + B3 + C3  
4. **Wave 4:** D1 + D2

---

## 6) Execution and delivery policy (mandatory)

Loop for every ticket:
`feature -> tests -> green -> commit -> push -> next`

Rules:
1. One commit per completed ticket.
2. No next ticket before relevant tests are green.
3. Keep PR incremental and always up to date.
4. Keep this file and session `plan.md` synchronized.

Branch and PR:
- Branch: `refactor/conversational-memory-pivot`
- PR: `https://github.com/psousaj/nexo-ai/pull/93`

---

## 7) Recommended next tickets to execute now

Ready immediately:
1. `TKT-A1` (memory canonical model v2)
2. `TKT-C1` (ambiguity policy)

Then continue by dependency waves until M0–M6 are complete.

---

## 8) New milestone — M7 Telegram Native Experience

Goal: add Telegram-native interaction features that improve discovery, UX, and memory-capture conversion while preserving deterministic side-effect execution.

### M7 scope (in)

- Command UX:
  - global commands (`/start`, `/help`, `/settings`) and domain commands for memory flows.
  - command scopes by context (private chat, groups, admins, language).
- Menu and keyboards:
  - menu button configuration.
  - reply keyboard and inline keyboard templates for save/search/disambiguation flows.
- Deep linking:
  - support `t.me/<bot>?start=<payload>` and deterministic payload parsing for onboarding, account linking, and referral/context handoff.
- Attachment entrypoint:
  - attachment-menu-compatible flow wired to current multimodal intake.
- Inline mode:
  - `inline_query` support for quick memory search/share from any Telegram chat.

### M7 scope (out for now)

- Monetization features (Stars, paid media, subscriptions, ads revenue share).
- Full Mini App productization (store optimization, story integrations, advanced webapp APIs).

### M7 technical tickets

- **TKT-TG1: Command catalog and scopes**
  - Define command matrix + localized descriptions.
  - Configure per-scope commands via Bot API / BotFather automation script.

- **TKT-TG2: Global command handlers**
  - Implement deterministic handlers for `/start`, `/help`, `/settings`.
  - Keep responses aligned with conversational assistant positioning.

- **TKT-TG3: Keyboard system**
  - Add reusable inline/reply keyboard builders.
  - Map callback actions to deterministic runtime intents (no free-form side effects).

- **TKT-TG4: Deep-link payload gateway**
  - Add signed/validated payload parser.
  - Support onboarding, account-link, and context-prefill intents.

- **TKT-TG5: Attachment menu integration**
  - Route attachment-menu launches into multimodal intake with confirmation policy.

- **TKT-TG6: Inline mode memory search**
  - Implement inline query endpoint + result ranking for memory retrieval snippets.

- **TKT-TG7: Telegram-specific test matrix**
  - Unit/integration coverage for commands, callbacks, deep links, inline query, and attachment launch paths.

### M7 dependency order

1. `TKT-TG1` -> `TKT-TG2`
2. `TKT-TG3` and `TKT-TG4` in parallel after `TKT-TG2`
3. `TKT-TG5` after `TKT-TG3`
4. `TKT-TG6` after `TKT-TG1`
5. `TKT-TG7` after all TG implementation tickets
