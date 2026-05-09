# Tech Stack

> Generated: May 9, 2026 | Branch: development | Commit: 07478fe

## Monorepo & Build

| Component | Version | Purpose |
|-----------|---------|---------|
| **pnpm** | 9.x | Package manager; workspace support |
| **Turbo** | 2.5.4 | Task orchestration; monorepo build |
| **Node.js** | 20+ LTS | Runtime for API + build tools |
| **TypeScript** | 5.x | Strict typing for all workspaces |
| **Biome** | 1.9.4 | Linting + formatting (replaces ESLint + Prettier) |

## API (`@nexo/api`)

### Runtime

| Component | Version | Purpose |
|-----------|---------|---------|
| **Node.js** | 20+ | JavaScript runtime |
| **Hono** | 4.x | Web framework (lightweight, fast) |
| **tsx** | Latest | TypeScript executor for dev |
| **tsup** | Latest | Bundler for production builds |

### Database & ORM

| Component | Version | Purpose |
|-----------|---------|---------|
| **PostgreSQL** | 15+ | Primary data store |
| **Drizzle ORM** | 0.45.1 | Type-safe query builder |
| **pg** | Latest | PostgreSQL client driver |
| **pgvector** | Latest | Vector type (PostgreSQL extension) |

### Caching & Queues

| Component | Version | Purpose |
|-----------|---------|---------|
| **Redis** | 7+ | In-memory cache + message queue |
| **Bull** | 5.70.4 | Job queue (Bull + Redis) |
| **ioredis** | Latest | Redis client library |

### Authentication

| Component | Version | Purpose |
|-----------|---------|---------|
| **Better-Auth** | 1.4.17 | OAuth + Magic Link authentication |
| **jsonwebtoken** | Latest | JWT generation/verification |

### AI & LLM Integration

| Component | Version | Purpose |
|-----------|---------|---------|
| **@google/genai** | 2.0.1 | Google Gemini API |
| **@google/generative-ai** | 0.24.1 | Gemini SDK (alternative) |
| **ai** | 6.0.49 | Vercel SDK (LLM abstraction layer) |
| **Cloudflare AI** | Latest | Embeddings + model gateway |

### Messaging Adapters

| Component | Version | Purpose |
|-----------|---------|---------|
| **Grammy** | 1.42.0 | Telegram bot framework |
| **discord.js** | Latest | Discord bot client |
| **Evolution API** | 2.1.1 | WhatsApp gateway (Docker image) |

### Enrichment APIs (Third-party)

| Component | Version | Purpose |
|-----------|---------|---------|
| **TMDB** | REST API v3 | Movie/TV metadata |
| **YouTube API** | v3 | Video search + metadata |
| **Spotify API** | Latest | Music metadata |
| **Google Books** | REST API | Book metadata |
| **Brave Search** | REST API | Web search |
| **Open Graph** | Meta protocol | Link previews |

### Observability

| Component | Version | Purpose |
|-----------|---------|---------|
| **Sentry** | 10.39.0 | Error tracking + performance monitoring |
| **OpenTelemetry** | 0.x | Distributed tracing |
| **Pino** | Latest | Structured logging |

### Utilities

| Component | Version | Purpose |
|-----------|---------|---------|
| **Zod** | Latest | Runtime type validation |
| **dotenv** | 17.x | Environment variable loading |
| **chrono-node** | 2.9.0 | Natural language date parsing |

### Testing

| Component | Version | Purpose |
|-----------|---------|---------|
| **Vitest** | Latest | Unit test framework (faster than Jest) |
| **Playwright** | Latest | E2E testing (optional) |

## Dashboard (`@nexo/dashboard`)

### Framework

| Component | Version | Purpose |
|-----------|---------|---------|
| **Nuxt** | 3.x | Vue meta-framework (SSR disabled) |
| **Vue** | 3.5.0 | UI framework |
| **Vite** | Latest | Build tool (via Nuxt) |
| **vue-tsc** | Latest | TypeScript compiler for Vue |

### State & Data

| Component | Version | Purpose |
|-----------|---------|---------|
| **Pinia** | Latest | Vue state management (Vuex successor) |
| **@tanstack/vue-query** | Latest | Server state synchronization |

### Authorization

| Component | Version | Purpose |
|-----------|---------|---------|
| **@casl/ability** | 6.8.0 | Authorization logic |
| **@casl/vue** | 2.2.6 | CASL integration for Vue |

### UI Components

| Component | Version | Purpose |
|-----------|---------|---------|
| **@nuxt/ui** | Latest | Headless component library |
| **Tailwind CSS** | Latest | Utility-first CSS framework |
| **@iconify-json/heroicons** | 1.2.2 | Icon set (Heroicons) |
| **@iconify-json/lucide** | 1.2.87 | Icon set (Lucide) |
| **lucide-vue-next** | Latest | Vue icon components |

### HTTP Client

| Component | Version | Purpose |
|-----------|---------|---------|
| **Axios** | Latest | HTTP client for API calls |

### Testing

| Component | Version | Purpose |
|-----------|---------|---------|
| **Vitest** | Latest | Unit tests |
| **Playwright** | Latest | E2E browser tests |

### Development Tools

| Component | Version | Purpose |
|-----------|---------|---------|
| **ESLint** | Latest | JavaScript linting (deprecated in favor of Biome) |
| **Biome** | 1.9.4 | Formatting + linting |

## Landing (`@nexo/landing`)

### Framework

| Component | Version | Purpose |
|-----------|---------|---------|
| **Vue** | 3.5.0 | UI framework |
| **Vite** | Latest | Build tool |

### Styling

| Component | Version | Purpose |
|-----------|---------|---------|
| **Tailwind CSS** | Latest | Utility CSS |

### Icons

| Component | Version | Purpose |
|-----------|---------|---------|
| **lucide-vue-next** | Latest | Icon components |

## Shared Packages

### @nexo/env

| Component | Purpose |
|-----------|---------|
| **Zod** | Environment variable schema validation |

### @nexo/shared

| Component | Purpose |
|-----------|---------|
| **Zod** | Schema definitions (MemoryItem, Conversation, etc.) |

### @nexo/otel

| Component | Purpose |
|-----------|---------|
| **@opentelemetry/sdk-node** | OpenTelemetry Node SDK |
| **@opentelemetry/auto-instrumentations-node** | Auto-instrumentation for libraries |

### @nexo/typescript-config

| File | Purpose |
|------|---------|
| **base.json** | Base TypeScript config (strict mode) |
| **node.json** | Node.js specific (commonjs, module resolution) |
| **nuxt.json** | Nuxt-specific (vue, jsx, etc.) |

## Infrastructure

| Component | Version | Purpose |
|-----------|---------|---------|
| **Docker** | 20+ | Containerization (API) |
| **Docker Compose** | 2+ | Multi-container orchestration (dev) |
| **PostgreSQL** | 15+ | Primary database |
| **Redis** | 7+ | Cache + message queue |
| **Cloudflare** | — | AI gateway, workers, edge computing |
| **Vercel** | — | Deployment (Dashboard, Landing) |
| **Railway/Heroku** | — | Deployment (API) |

## Version constraints

### Core constraints

- **Node.js:** 20+ (LTS)
- **PostgreSQL:** 15+ (for pgvector support)
- **Redis:** 7+ (for streams support)
- **TypeScript:** 5.x (strict mode)

### Breaking changes to watch

| Version | Impact | Notes |
|---------|--------|-------|
| Nuxt 4 | Major | Breaking API changes; migration needed |
| Vue 4 | Major | Hypothetical future version |
| TypeScript 6 | Minor | May require tsconfig updates |
| Drizzle 1.0 | Minor | API stabilization |

## Optional integrations (not required)

- **Sentry:** Error tracking (can be disabled via env var)
- **Playwright:** E2E tests (can run dashboard without E2E)
- **Cloudflare Workers:** Proposed but not implemented (ADR-015)

---

**See also:** [ARCHITECTURE.md](./ARCHITECTURE.md), [apps/api/index.md](./apps/api/index.md)
