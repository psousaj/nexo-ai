# Shared Packages

> Generated: May 9, 2026 | Branch: development | Commit: 07478fe

## Overview

Four shared packages are located in `packages/` and linked to apps via pnpm's `workspace:*` protocol. They provide configuration, types, schemas, and utilities used across the monorepo.

## Package inventory

### 1. @nexo/env

**Purpose:** Centralized environment variable validation.

**Location:** `packages/env/src/index.ts`

**Exports:**
```ts
export function getApiEnv(): ApiEnv
export function getDashboardEnv(): DashboardEnv
export function getLandingEnv(): LandingEnv
```

**Usage:**
```ts
// In API
import { getApiEnv } from '@nexo/env';
const env = getApiEnv();
console.log(env.DATABASE_URL);

// In Dashboard
import { getApiEnv } from '@nexo/env';
const env = getDashboardEnv();
console.log(env.VITE_API_URL);
```

**Key variables validated:**

| Category | Variables |
|----------|-----------|
| **Node** | NODE_ENV, LOG_LEVEL |
| **Database** | DATABASE_URL |
| **Redis** | REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_TLS |
| **API** | PORT, CORS_ORIGINS |
| **Cloudflare** | CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_GATEWAY_ID |
| **AI Models** | GOOGLE_API_KEY, ANTHROPIC_API_KEY, LM_STUDIO_URL |
| **Third-party APIs** | TMDB_API_KEY, YOUTUBE_API_KEY, SPOTIFY_*, BRAVE_SEARCH_API_KEY |
| **Auth** | OAUTH_GOOGLE_ID, OAUTH_GOOGLE_SECRET, OAUTH_GITHUB_* |
| **Sentry** | SENTRY_DSN |
| **Dashboard** | VITE_API_URL, VITE_AUTH_DOMAIN |

**Schema validation:** Zod schema with strict constraints (required fields, URL validation, etc.)

**Error handling:** Invalid env → `process.exit(1)` (fail fast)

---

### 2. @nexo/shared

**Purpose:** Shared types, schemas, and utilities.

**Location:** `packages/shared/src/`

**Exports:**

```ts
// schemas/item.ts
export const MemoryItemSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['movie', 'tv', 'video', 'note', 'link']),
  title: z.string().min(1),
  description: z.string(),
  metadata: z.record(z.unknown()),
  tags: z.array(z.string()),
  createdAt: z.date(),
});

// types/metadata.ts
export interface MovieMetadata {
  imdb_id?: string;
  tmdb_id?: number;
  rating: number;
  year: number;
  genres: string[];
}

export interface VideoMetadata {
  youtube_id: string;
  duration: number; // seconds
  channel: string;
  url: string;
}

// utils/multimodal-normalizer.ts
export function normalizeInput(input: MessageInput): NormalizedMessage { ... }
```

**Key types:**

| Type | Purpose |
|------|---------|
| `MemoryItem` | User-saved content reference |
| `Conversation` | Chat session |
| `Message` | Single message in conversation |
| `User` | User account |
| `MovieMetadata` | Movie-specific data |
| `VideoMetadata` | Video-specific data |

**Validators:**
- `MemoryItemSchema` — Validate saved memories
- `ConversationSchema` — Validate conversation structure
- Metadata schemas per type

**Utilities:**
- `normalizeInput()` — Convert platform-specific message format to common format
- `serializeMetadata()` — JSON serialization with safe handling
- `extractMetadata()` — Parse metadata from enrichment responses

---

### 3. @nexo/otel

**Purpose:** OpenTelemetry instrumentation setup.

**Location:** `packages/otel/src/`

**Exports:**

```ts
export interface InitializeOtelConfig {
  serviceName?: string;  // defaults to OTEL_SERVICE_NAME env
  serviceVersion?: string;
  deploymentEnvironment?: string;
}

export function initializeOtel(config?: InitializeOtelConfig): void { ... }
export function shutdownOtel(): Promise<void> { ... }
```

**Usage in API:**

```ts
// apps/api/src/otel.ts (imported in index.ts)
import './otel';
import { initializeOtel } from '@nexo/otel';

initializeOtel({
  serviceName: 'nexo-api',
  serviceVersion: pkg.version,
  deploymentEnvironment: process.env.NODE_ENV,
});
```

**Instruments:**
- HTTP requests (incoming/outgoing)
- Database queries (PostgreSQL)
- Redis operations
- gRPC calls
- DNS lookups

**Exporters:**
- **Dev:** Console exporter (logs to stdout)
- **Prod:** Jaeger/Datadog exporter (configurable via env)

**Configuration:**
```ts
// environment variables
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317  // Jaeger
OTEL_SERVICE_NAME=nexo-api
OTEL_ENABLED=true  // can disable for testing
```

---

### 4. @nexo/typescript-config

**Purpose:** Shared TypeScript configurations.

**Location:** `packages/typescript-config/`

**Exports (as NPM package):**

```json
{
  "exports": {
    "./base": "./base.json",
    "./node": "./node.json",
    "./nuxt": "./nuxt.json"
  }
}
```

**Usage:**

```json
{
  "extends": "@nexo/typescript-config/node",
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

**Configurations:**

#### base.json
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

#### node.json (extends base)
```json
{
  "extends": "./base",
  "compilerOptions": {
    "module": "CommonJS",
    "lib": ["ES2020"],
    "moduleResolution": "node"
  }
}
```

#### nuxt.json (extends base)
```json
{
  "extends": "./base",
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "vue",
    "moduleResolution": "bundler"
  }
}
```

---

## Dependency graph

```
Apps
  ├─ @nexo/env (configuration)
  ├─ @nexo/shared (types + schemas)
  ├─ @nexo/otel (instrumentation)
  └─ @nexo/typescript-config (tsconfig)

Shared packages
  └─ No inter-dependencies (leaf nodes)
```

## Publishing

Shared packages are published to npm as part of release process:

```bash
pnpm run release  # Bumps version, publishes all packages
```

**NPM registry:** Published under `@nexo/` scope

**Version:** All packages share monorepo version (0.5.48)

---

**See also:** [ARCHITECTURE.md](./ARCHITECTURE.md)
