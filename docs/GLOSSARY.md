# Glossary

> Generated: May 9, 2026 | Branch: development | Commit: 07478fe

## Project-specific terminology

### Agent

An autonomous system that interprets user requests and executes actions (save memory, search, enrich). The Nexo agent consists of the orchestrator, kernel, and tool registry.

### Deterministic Runtime

A system where LLM outputs are strictly validated against JSON schemas before execution. The Hermes kernel is deterministic—it rejects malformed LLM responses instead of trying to interpret them.

### Enrichment

Process of fetching external data about a user's query and augmenting it with metadata. Example: user says "Inception", enrichment fetches IMDB/TMDB data about the movie.

### Hermes Kernel

The core deterministic loop in the API that orchestrates tool execution. Named after the Greek messenger god (carries messages between worlds). Max 6 turns per user message.

### Intent Classification

Process of determining user intent (what they want to do). Classification outputs: `delete_all`, `list_all`, `cancel`, or `complex` (route to LLM).

### Memory Item

A user-saved reference to content (movie, link, note, video). Core artifact stored in PostgreSQL with embeddings.

### Memory Registry

PostgreSQL-backed registry that handles memory search (hybrid keyword + semantic) and CRUD operations on memory items.

### LLM (Large Language Model)

External AI model (Gemini, Claude, etc.) called via Cloudflare AI gateway for complex reasoning and tool selection.

### Session

A conversation session between user and bot. Contains messages, state, and context. Identified by unique UUID.

### Skill

Reusable agentic skill (e.g., "movie expert", "web searcher"). Defined in `agent_skills` table; loaded dynamically at runtime.

### Tool

An executable function called by the kernel (e.g., `save_memory`, `search_memory`, `enrich_movie`). Tools are registered in the registry and validated before execution.

### Tool Registry

In-memory (later PostgreSQL-backed) registry of available tools. Built at startup; determines what the LLM can invoke.

### Turn (or Agent Turn)

One iteration of the kernel loop:
1. Call LLM with tools schema
2. LLM returns tool invocation (JSON)
3. Execute tool
4. Update kernel state

Max 6 turns per user message.

### Webhook

HTTP endpoint called by external systems (Telegram, WhatsApp, Discord) when users send messages. Examples: `/webhook/telegram`, `/webhook/whatsapp`.

---

## Acronyms

| Acronym | Full form | Context |
|---------|-----------|---------|
| **ADR** | Architecture Decision Record | ADR-011, ADR-014, etc. |
| **API** | Application Programming Interface | REST API, GraphQL API |
| **BYOK** | Bring Your Own Key | Users provide own Gemini/Claude API keys (NEX-53) |
| **CASL** | CSS Abstraction Syntax Language | Authorization library for Vue (role-based access) |
| **CLI** | Command Line Interface | Hermes control via terminal |
| **CORS** | Cross-Origin Resource Sharing | Browser security policy |
| **CRUD** | Create, Read, Update, Delete | Database operations |
| **DDD** | Domain-Driven Design | Software design approach |
| **E2E** | End-to-end | Playwright tests that simulate user flows |
| **ETL** | Extract, Transform, Load | Data pipeline |
| **HMR** | Hot Module Replacement | Nuxt/Vite dev server feature (live reload) |
| **HTTP** | HyperText Transfer Protocol | Web protocol (REST uses this) |
| **JWT** | JSON Web Token | Authentication token format |
| **LOC** | Lines of Code | Code quantity metric |
| **LLM** | Large Language Model | AI model (Gemini, Claude, etc.) |
| **MVP** | Minimum Viable Product | Simplest working version |
| **NEX** | Nexo Epic | Ticket prefix (NEX-21, NEX-30, etc.) |
| **NLP** | Natural Language Processing | Text understanding |
| **OAuth** | Open Authorization | OAuth 2.0 protocol (login with Google) |
| **ORM** | Object-Relational Mapping | Drizzle, Prisma (database query builders) |
| **OTEL** | OpenTelemetry | Observability framework |
| **PR** | Pull Request | GitHub code review mechanism |
| **REST** | Representational State Transfer | Architectural style for APIs |
| **RLS** | Row-Level Security | PostgreSQL feature (user data isolation) |
| **SPA** | Single Page Application | Frontend app (Nuxt Dashboard is SPA) |
| **SQL** | Structured Query Language | Database query language |
| **SSR** | Server-Side Rendering | Nuxt rendering mode (disabled in Dashboard) |
| **TTL** | Time To Live | Cache/token expiration |
| **UX** | User Experience | User-facing design/interaction |
| **UUID** | Universally Unique Identifier | 128-bit identifier (e.g., `550e8400-e29b-41d4-a716-446655440000`) |
| **VC** | Version Control | Git |
| **VCS** | Version Control System | Git, GitHub |
| **Zod** | — | TypeScript validation library (Z-schema validation) |

---

## External service names

### AI/LLM Providers

- **Cloudflare AI** — Embeddings, model gateway (default provider)
- **Google Gemini** — LLM provider (fallback)
- **Claude** — LLM provider (fallback)
- **LM Studio** — Local LLM (optional, self-hosted)

### Messaging Platforms

- **Telegram** — Chat platform; integrated via Grammy bot
- **WhatsApp** — Chat platform; integrated via Evolution API
- **Discord** — Chat platform; integrated via Discord.js bot

### Enrichment Services

- **TMDB** (The Movie Database) — Movie/TV metadata
- **YouTube** — Video metadata and search
- **Spotify** — Music metadata
- **Google Books** — Book metadata
- **Brave Search** — Web search engine
- **Open Graph** — Link preview metadata extraction

### Infrastructure

- **PostgreSQL** — Relational database
- **Redis** — In-memory cache + message queue
- **Sentry** — Error tracking and observability
- **Vercel** — Deployment platform (Dashboard, Landing)
- **Railway/Heroku** — Deployment platform (API)
- **Docker** — Containerization

---

## Domain concepts

### Content types

The system recognizes these memory item types:

| Type | Description | Metadata example |
|------|-------------|-----------------|
| **movie** | Film/motion picture | `{ imdb_id, tmdb_id, rating, year, genres }` |
| **tv** | Television series | `{ imdb_id, seasons, episodes, next_episode }` |
| **video** | Online video | `{ youtube_id, duration, channel }` |
| **link** | Web link/bookmark | `{ url, domain, title, description }` |
| **note** | Text note | `{ category, source, is_public }` |

### User states

| State | Meaning |
|-------|---------|
| **active** | User has logged in; can use the system |
| **inactive** | No activity in 30 days |
| **banned** | Admin has suspended account |
| **deleted** | User requested account deletion (soft delete) |

### Conversation states

| State | Meaning |
|-------|---------|
| **active** | Ongoing conversation; user can send messages |
| **closed** | User ended conversation; read-only |
| **archived** | Old conversation (>90 days); not displayed by default |

### Permission model

- **User** — Can read/update own data; cannot access other users
- **Admin** — Can read/update any user's data; manage system settings
- **Bot** — System-internal only; reads/writes on behalf of user

---

## Database terminology

### JSONB

PostgreSQL data type for JSON data with indexing support. Nexo uses JSONB for:
- Conversation context (session metadata)
- Memory item metadata (TMDB data, YouTube data, etc.)
- Feature flags configuration
- User preferences

### Vector

PostgreSQL extension (`pgvector`) for storing embedding vectors. Nexo uses 384-dimensional vectors from Cloudflare AI.

### Migration

Version-controlled schema change (SQL file in `drizzle/` directory). Example: `0001_volatile_rockslide.sql`

### Drizzle

TypeScript ORM used throughout Nexo. Generates migrations, types, and query builders from schema definitions.

---

## Testing terminology

### Unit test

Test of a single function/module in isolation (mocks dependencies).

### Integration test

Test of multiple modules working together (may use real database).

### E2E test (End-to-end)

Test of entire user flow (browser → API → database). Written in Playwright.

### Mock

Fake object that replaces real dependency for testing.

### Fixture

Setup data or state used across multiple tests.

### Coverage

Percentage of code executed by tests (target: >70%).

---

**See also:** [ARCHITECTURE.md](./ARCHITECTURE.md), [apps/api/docs/adr/](../apps/api/docs/adr/)
