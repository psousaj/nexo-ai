# Monorepo Architecture

> Generated: May 9, 2026 | Branch: development | Commit: 07478fe

## Overview

Nexo AI is a monorepo containing three distinct applications and four shared packages, all orchestrated via pnpm workspaces and Turbo for incremental builds and task execution. The architecture separates concerns by application domain while maximizing code reuse through shared libraries.

**Key principles:**
- **Application isolation:** Each app (`@nexo/api`, `@nexo/dashboard`, `@nexo/landing`) has its own dependencies, build process, and deployment
- **Shared libraries:** Common code lives in `packages/` and is versioned with the monorepo
- **Monorepo coordination:** Turbo manages task dependencies; pnpm links packages via `workspace:*` protocol
- **Single version:** All workspaces share the same version number (0.5.48)

## System topology

```mermaid
graph TB
    subgraph Workspace["pnpm Workspaces + Turbo"]
        subgraph Apps["Apps"]
            API["@nexo/api<br/>Node.js + Hono<br/>(5400 LOC)"]
            Dashboard["@nexo/dashboard<br/>Nuxt 3 SPA<br/>(8400 LOC)"]
            Landing["@nexo/landing<br/>Vite + Vue<br/>(400 LOC)"]
        end
        
        subgraph Packages["Shared Packages"]
            Env["@nexo/env<br/>Environment<br/>Config"]
            Shared["@nexo/shared<br/>Types +<br/>Schemas"]
            OTEL["@nexo/otel<br/>Observability"]
            TSConfig["@nexo/typescript-config<br/>TypeScript<br/>Config"]
        end
    end
    
    API --> Env
    API --> Shared
    API --> OTEL
    API --> TSConfig
    
    Dashboard --> Env
    Dashboard --> Shared
    Dashboard --> TSConfig
    
    Landing --> TSConfig
    
    subgraph Infra["Infrastructure"]
        PostgreSQL["PostgreSQL<br/>15+"]
        Redis["Redis 7+"]
        Docker["Docker<br/>Compose"]
    end
    
    API --> PostgreSQL
    API --> Redis
    Dashboard --> API
    
    Docker --> PostgreSQL
    Docker --> Redis
```

## Workspace structure

### Apps (`apps/`)

| App | Type | Purpose | Port |
|-----|------|---------|------|
| **api** | Node.js/Hono | Core runtime server | 3001 |
| **dashboard** | Nuxt 3 SPA | Admin interface | 5173 |
| **landing** | Vite + Vue | Marketing page | 5174 |

### Shared Packages (`packages/`)

| Package | Purpose | Exports |
|---------|---------|---------|
| **env** | Environment variable validation | `getApiEnv()`, `getDashboardEnv()` |
| **shared** | Schemas, types, utilities | `MemoryItem`, `Conversation`, validators |
| **otel** | OpenTelemetry setup | SDK initialization, instrumentations |
| **typescript-config** | Shared TypeScript configs | Base, Node, Nuxt configs |

### Build Config (Root)

| File | Purpose |
|------|---------|
| `pnpm-workspace.yaml` | Workspace definition; links apps + packages |
| `turbo.json` | Task orchestration; dependency graph |
| `package.json` | Root scripts; shared devDependencies (Biome, Turbo) |
| `Makefile` | Dev shortcuts (optional) |

## Build orchestration (Turbo)

### Task graph

```mermaid
graph TD
    Install["pnpm install"]
    Lint["lint"]
    TypeCheck["typecheck"]
    Build["build"]
    Test["test"]
    
    Install --> Lint
    Install --> TypeCheck
    Install --> Build
    Install --> Test
    
    Lint --> Build
    TypeCheck --> Build
    
    Test -.-> Lint
    Test -.-> TypeCheck
```

### Root scripts

```bash
pnpm dev              # Run all dev servers (Turbo parallel)
pnpm dev:api          # Just API
pnpm dev:dash         # Just Dashboard
pnpm dev:landing      # Just Landing

pnpm build            # Build all workspaces
pnpm lint             # Run linters (Biome)
pnpm typecheck        # TypeScript checks
pnpm test             # Run all tests (Vitest)

pnpm db:generate      # Drizzle migrations
pnpm db:push          # Apply Drizzle migrations
pnpm db:studio        # Open Drizzle Studio (UI)

pnpm format           # Format all code (Biome)
pnpm clean            # Remove build artifacts + node_modules
```

### Turbo caching

Turbo caches task outputs in `.turbo/`:

```bash
# First run—compiles everything
pnpm build            # 30 seconds

# Second run—all cached
pnpm build            # 1 second (cache hit)

# Change one file in API
pnpm build            # Rebuilds API + dependents only
```

## Dependency management

### Workspace protocol

Shared packages are linked via `workspace:*` protocol in `package.json`:

```json
{
  "dependencies": {
    "@nexo/env": "workspace:*",
    "@nexo/shared": "workspace:*"
  }
}
```

This ensures:
- No npm publish needed during development
- Changes to shared packages immediately available
- Version consistency (all 0.5.48)

### External dependencies

Versions are managed at root `package.json` and inherited by workspaces (via pnpm hoisting).

**Key constraints:**
- React Query / TanStack Query: Vue adapter for Dashboard
- Drizzle ORM: Node.js + PostgreSQL
- Hono: Only in API
- Nuxt: Only in Dashboard

### Dependency resolution

pnpm uses strict hoisting:

```
node_modules/
  .pnpm/                # Flat store
  @nexo/
    api/
    dashboard/
    landing/
    env/
    shared/
    otel/
    typescript-config/
```

This prevents "phantom dependencies" (accidentally using sibling packages).

## Development workflow

### Local setup

```bash
# Clone repo
git clone https://github.com/psousaj/nexo-ai.git
cd nexo-ai

# Install dependencies
pnpm install

# Create .env from root
cp .env.example .env
# Fill in: DATABASE_URL, REDIS_HOST, API keys, etc.

# Run database migrations
pnpm db:push

# Start all dev servers
pnpm dev

# Services now running:
# - API: http://localhost:3001
# - Dashboard: http://localhost:5173
# - Landing: http://localhost:5174
```

### Making changes

**To the API:**
```bash
pnpm --filter @nexo/api run dev
# Changes auto-reload via tsx watch
```

**To the Dashboard:**
```bash
pnpm --filter @nexo/dashboard run dev
# Changes auto-reload via Nuxt HMR
```

**To shared packages:**
```bash
# Edit src files in packages/shared/
# Changes immediately available to consumers (workspace protocol)
pnpm build  # Rebuild when ready to verify
```

## Deployment

### API

**Docker:** Builds via `apps/api/Dockerfile` (multi-stage)

```dockerfile
FROM node:20-alpine AS builder
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm run build:api

FROM node:20-alpine
COPY --from=builder /app/apps/api/dist ./
CMD ["node", "index.js"]
```

**Platforms:** Railway, Heroku, AWS ECS

### Dashboard

**Static:** Deployed as SPA to Vercel or Netlify

```bash
pnpm run build  # Outputs to apps/dashboard/.output/public
```

### Landing

**Static:** Deployed to Vercel

```bash
pnpm run build  # Outputs to apps/landing/dist
```

## Environment management

### Local (.env at root)

```bash
NODE_ENV=development
PORT=3001

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/nexo

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=...

# AI APIs
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_GATEWAY_ID=nexo-ai-gateway

# Third-party
TMDB_API_KEY=...
YOUTUBE_API_KEY=...

# Auth
OAUTH_GOOGLE_ID=...
OAUTH_GOOGLE_SECRET=...
```

### Validation

All environment variables are validated via Zod schemas:

- `packages/env/src/index.ts` — Monolithic schema
- Each app calls `getApiEnv()`, `getDashboardEnv()`, etc.
- Validation happens at startup; missing vars = immediate failure

## Cross-cutting concerns

### Version management

Single version across all workspaces:

```json
{
  "version": "0.5.48"
}
```

**Bumping versions:**
```bash
pnpm run version:patch   # 0.5.48 → 0.5.49
pnpm run version:minor   # 0.5.48 → 0.6.0
pnpm run version:major   # 0.5.48 → 1.0.0
```

### Linting & formatting

All workspaces use Biome:

```bash
pnpm lint            # Check (Biome)
pnpm format          # Fix (Biome)
pnpm typecheck       # TypeScript
```

### Testing

Each workspace has its own test suite (Vitest, Playwright):

```bash
pnpm test            # Run all tests
pnpm test:watch      # Watch mode
```

## CI/CD (GitHub Actions)

```yaml
# .github/workflows/test.yml
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'
      
      - run: pnpm install
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
```

---

**See also:** [TECH_STACK.md](./TECH_STACK.md), [apps/api/ARCHITECTURE.md](./apps/api/ARCHITECTURE.md)
