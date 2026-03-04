# Copilot Instructions - Nexo AI

Nexo AI is a monorepo for a messaging assistant that saves/searches user content (movies, shows, videos, links, notes) across Telegram/WhatsApp/Discord.

## Build, test, and lint commands

### Monorepo (root)

```bash
pnpm dev                 # all apps via Turbo
pnpm dev:api             # API only
pnpm dev:dash            # Dashboard only
pnpm dev:landing         # Landing only

pnpm build               # build all workspaces
pnpm lint                # workspace lint tasks
pnpm typecheck           # workspace typecheck tasks
pnpm test                # workspace test tasks

pnpm build:api
pnpm build:dashboard
pnpm build:landing

pnpm db:generate         # API drizzle generate through Turbo
pnpm db:push             # API drizzle push through Turbo
pnpm db:studio           # API drizzle studio through Turbo
```

### API (`apps/api`)

```bash
pnpm run dev
pnpm run build
pnpm run start
pnpm run start:binary

pnpm run db:generate
pnpm run db:push
pnpm run db:studio

pnpm run test
pnpm run test:watch
pnpm run test:ui

# Single test file
pnpm run test -- src/tests/intent-classifier.test.ts

pnpm run lint:biome
pnpm run lint:biome:fix
pnpm run format:check
```

### Dashboard (`apps/dashboard`)

```bash
pnpm run dev
pnpm run build
pnpm run preview

pnpm run test
pnpm run test:unit
pnpm run test:nuxt
pnpm run test:e2e

# Single test file
pnpm run test -- src/tests/example.test.ts

pnpm run lint
pnpm run typecheck
```

## High-level architecture (big picture)

Core flow (deterministic runtime):

1. Messaging adapter receives webhook/event (`apps/api/src/adapters/messaging/*`).
2. Intent classification runs first (`apps/api/src/services/intent-classifier.ts`).
3. `agent-orchestrator.ts` routes:
   - deterministic actions (`delete_all`, `list_all`, `cancel`) run directly
   - complex actions call LLM planner
4. LLM must return `AgentLLMResponse` JSON (`types/index.ts`), then runtime validates/parses and executes tool(s).
5. Tools in `apps/api/src/services/tools/index.ts` call enrichment services (`apps/api/src/services/enrichment/*`) and persistence services.
6. Conversation state/context is persisted in Postgres (`conversations.context` JSONB) and transitioned by `apps/api/src/services/conversation-service.ts`.
7. Message processing is queued (Bull + Redis) to avoid webhook timeout and support retries.

Database shape to keep in mind:

- Drizzle schemas in `apps/api/src/db/schema/*`
- `memory_items` stores typed content metadata in JSONB + embeddings for semantic search
- `semantic_external_items` caches external entities (movies/TV/videos)

## Key conventions specific to this repository

1. **Critical rule (ADR-011)**: LLM never controls state/flow; code controls orchestration and execution.
2. **LLM response contract is strict**: use `AgentLLMResponse` + parser/validator (`utils/json-parser.ts`); no free-form tool decisions outside schema.
3. **Prompts are centralized**: keep/update prompts in `apps/api/src/config/prompts.ts`; do not scatter prompt text across services.
4. **Tools use strong contracts**: prefer specific tool functions (save/enrich/search variants) over generic “do everything” handlers.
5. **State updates go through service layer**: use `conversationService` transitions, not ad-hoc DB state writes.
6. **Path aliases**: API imports use `@/` (`apps/api/tsconfig.json`); follow existing alias usage.
7. **Service singleton pattern**: services are exported as instantiated singletons and reused across routes/adapters.
8. **Server management expectation**: check whether dev servers are already running before restarting to avoid unnecessary disruption.

## Mandatory execution workflow (for refactors/features)

Use this strict loop for delivery:

1. implement one feature
2. add/update tests for that feature
3. run tests until green
4. only then move to next feature

Required pattern: **feature -> tests -> green -> next**.

Additional rules:

- Operate in a loop until all milestones and planned features are complete.
- Commit after each completed feature/iteration (never batch many unrelated features in one commit).
- Use a dedicated refactor branch (recommended: `refactor/conversational-memory-pivot`).
- Open and keep an incremental PR updated for GitHub review after each green feature block.

## Source files used for these instructions

- `AGENTS.md`
- `README.md`
- `apps/api/package.json`
- `apps/dashboard/package.json`
- `apps/landing/package.json`
- `docs/concepts/architecture-overview.md`
- `docs/concepts/deterministic-runtime.md`
