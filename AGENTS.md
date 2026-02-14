# AGENTS.md - Agent Guide for Nexo AI

## Project Overview

**Nexo AI** is a personal AI assistant via Telegram/WhatsApp/Discord that organizes content (movies, TV shows, videos, links, notes) using AI.

**Architecture v0.3.0**: Deterministic Runtime Control - LLM **never** manages state or decides flow. LLM **only** analyzes, plans, and selects tools.

### Monorepo Structure

```
nexo-ai/
├── apps/
│   ├── api/           # Main backend (Hono + Drizzle + PostgreSQL)
│   ├── dashboard/      # Web dashboard (Nuxt 4 + Vue 3)
│   ├── landing/        # Landing page (Vite)
│   └── old-dashboard/  # Legacy dashboard (deprecated)
└── packages/
    ├── shared/         # Shared types and schemas
    ├── auth/           # Better Auth client
    ├── typescript-config/
    ├── eslint-config/
    └── prettier-config/
```

### Tech Stack

| Category | Technology |
|----------|------------|
| **Runtime** | Bun (primary), Node.js |
| **Package Manager** | pnpm (workspaces) + Turbo |
| **API Framework** | Hono (migrated from Elysia) |
| **Database** | PostgreSQL (Supabase) + Drizzle ORM |
| **Frontend** | Nuxt 4 + Vue 3 + Nuxt UI |
| **AI Providers** | Google Gemini (default), Cloudflare Workers AI (fallback) |
| **Messaging** | Telegram Bot API, Meta WhatsApp API, Discord.js |
| **Auth** | Better Auth (Discord OAuth, Google OAuth) |
| **Queue** | Bull + Redis (Upstash) |
| **Testing** | Vitest (API), Playwright (E2E) |
| **Observability** | New Relic (optional), Pino logger |
| **Deployment** | Cloudflare Workers, Docker, Railway |

---

## Essential Commands

### Root Level (Turbo)

```bash
# Development
pnpm dev                    # Run all apps (api, dashboard, landing)
pnpm dev:api               # Run API only
pnpm dev:dashboard         # Run Dashboard only
pnpm dev:landing           # Run Landing only

# Build
pnpm build                 # Build all apps
pnpm build:api             # Build API only
pnpm build:dashboard       # Build Dashboard only
pnpm build:landing         # Build Landing only

# Quality
pnpm lint                  # Lint all apps
pnpm typecheck             # Typecheck all apps
pnpm test                  # Test all apps
pnpm format                # Format code (Biome)

# Database (routes to API)
pnpm db:generate           # Generate Drizzle migrations
pnpm db:push               # Apply migrations to database
pnpm db:studio             # Open Drizzle Studio UI
```

### API (`apps/api/`)

```bash
# Development
pnpm run dev               # Start Hono server with tsx watch

# Build & Run
pnpm run build             # Build with tsup
pnpm run start             # Start production with New Relic
pnpm run start:no-newrelic # Start without New Relic
./server                   # Run binary build

# Database
pnpm run db:generate       # Generate Drizzle migrations
pnpm run db:push           # Apply migrations to database
pnpm run db:studio         # Open Drizzle Studio (http://localhost:4983)

# Testing
pnpm test                  # Run all Vitest tests
pnpm test:watch            # Watch mode
pnpm test:ui               # Vitest UI

# Code Quality
pnpm run biome:check       # Check formatting with Biome
pnpm run biome:fix         # Fix formatting

# Utils
pnpm run train:nexo        # Train NLP classifier
pnpm run set-admin         # Set user as admin (admin dashboard)
```

### Dashboard (`apps/dashboard/`)

```bash
# Development
pnpm run dev               # Start Nuxt dev server

# Build & Preview
pnpm run build             # Build for production
pnpm run preview           # Preview production build

# Testing
pnpm test                  # Run all tests
pnpm test:watch            # Watch mode
pnpm test:coverage         # Coverage report
pnpm test:unit             # Unit tests only
pnpm test:nuxt             # Nuxt-specific tests
pnpm test:e2e              # Playwright E2E tests
pnpm test:e2e:ui           # Playwright UI

# Quality
pnpm run lint              # ESLint check
pnpm run typecheck         # TypeScript type checking
```

---

## Architecture & Critical Patterns

### 1. Deterministic Runtime Control (CRITICAL)

**ADR-011**: LLM **never** manages state, decides flow, or executes logic.

**LLM ONLY:**
- Analyzes user input
- Plans action
- Chooses tools
- Drafts responses

**CODE ONLY:**
- Manages conversation state
- Decides when to call LLM
- Executes tools
- Controls flow

### 2. AgentLLMResponse Schema (MANDATORY)

All LLM responses must follow this exact JSON schema:

```typescript
// apps/api/src/types/index.ts
interface AgentLLMResponse {
  schema_version: "1.0";
  action: "CALL_TOOL" | "RESPOND" | "NOOP";
  tool?: ToolName;           // Required if action=CALL_TOOL
  args?: Record<string, any>;
  message?: string;          // Max 200 chars if action=RESPOND
}
```

**Validation**:
- `action=CALL_TOOL` → `tool` required
- `action=RESPOND` → `message` required, max 200 chars
- `action=NOOP` → `message` must be null

**Parse with**:
```typescript
import { parseJSONFromLLM, isValidAgentResponse } from '@/utils/json-parser';

const response = parseJSONFromLLM(llmOutput);
if (!isValidAgentResponse(response)) {
  throw new Error('Invalid AgentLLMResponse');
}
```

### 3. Tools with Strong Contracts

Each tool does ONE specific thing with validated inputs.

**Location**: `apps/api/src/services/tools/index.ts`

**Available Tools**:
```typescript
// Save tools (strongly typed per item type)
save_note(content: string)
save_movie(title: string, year?: number, tmdb_id?: number)
save_tv_show(title: string, year?: number, tmdb_id?: number)
save_video(url: string, title?: string)
save_link(url: string, description?: string)

// Search tools
search_items(query?: string, type?: ItemType)

// Enrichment tools
enrich_movie(title: string)
enrich_tv_show(title: string)
enrich_video(url: string)
```

**Tool Output Schema**:
```typescript
interface ToolOutput {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}
```

### 4. Intent Classification (Deterministic)

**Location**: `apps/api/src/services/intent-classifier.ts`

Process:
1. Intent classifier runs FIRST (before LLM)
2. Uses regex patterns or lightweight LLM
3. Returns `IntentResult` with confidence score

**Detected Intents**:
```typescript
type UserIntent =
  | 'save_content'      // Save items
  | 'search_content'    // Search/list items
  | 'delete_content'    // Delete items
  | 'update_content'    // Update settings
  | 'get_info'          // Get info
  | 'confirm'           // Yes/OK/Numbers
  | 'deny'              // No/Cancel
  | 'casual_chat'       // Greetings, thanks
  | 'unknown';
```

**Deterministic Actions** (no LLM needed):
```typescript
switch (intent.action) {
  case 'delete_all':
    return handleDeleteAll();  // Direct execution
  case 'list_all':
    return handleListAll();    // Direct execution
  case 'cancel':
    return handleCancel();     // Clear context
  default:
    return handleWithLLM();    // Only here LLM is called
}
```

### 5. State Machine

**Location**: `apps/api/src/services/conversation-service.ts`

**Conversation States**:
```typescript
type ConversationState =
  | 'idle'                    // Ready for commands
  | 'processing'              // Action in progress
  | 'awaiting_context'        // Waiting for user input
  | 'off_topic_chat'          // User in parallel conversation
  | 'awaiting_confirmation'   // Waiting for user selection
  | 'awaiting_final_confirmation'  // Final confirmation with image
  | 'enriching'               // Fetching metadata
  | 'saving'                  // Saving to database
  | 'error'                   // Error state
  | 'waiting_close'           // Timer running (3 min)
  | 'closed';                 // Conversation closed, context cleared
```

**State Transitions**:
- Managed by `conversationService` (code, not LLM)
- Context persisted in `conversations.context` (JSONB)
- Auto-close after 3 min inactivity via Bull queue

### 6. Database Schema (Drizzle)

**Location**: `apps/api/src/db/schema/`

**Key Tables**:
- `users` - User accounts (name, email, assistantName, timeoutUntil)
- `user_accounts` - Multi-provider accounts (telegram, whatsapp, discord)
- `user_emails` - Email addresses (for linking)
- `user_preferences` - User preferences (one-to-one)
- `conversations` - State machine (state, context JSONB, closeAt, isActive)
- `messages` - Message history (role: user|assistant)
- `memory_items` - Saved items (type, metadata JSONB, embedding vector, externalId)
- `semantic_external_items` - Global cache for movies/TV/videos (normalization)
- `error_reports` - Error tracking
- `linking_tokens` - Account linking tokens
- `auth` - Better Auth tables
- `permissions` - User permissions

**Important Patterns**:
- JSONB for flexible metadata (typed by item type in `types/index.ts`)
- Vector embeddings (384 dims) for semantic search
- Unique constraints to prevent duplicates (externalId+type, contentHash)
- Cascade deletes for referential integrity

**Relations**:
- `users` 1:N `userAccounts`
- `users` 1:N `userEmails`
- `users` 1:N `conversations`
- `users` 1:N `memoryItems`
- `conversations` 1:N `messages`
- `memoryItems` N:1 `semanticExternalItems` (for movies/TV/videos)

### 7. Messaging Adapters

**Location**: `apps/api/src/adapters/messaging/`

**Pattern**: Unified interface, provider-specific implementation

**Adapters**:
- `telegram-adapter.ts` - Telegram Bot API
- `whatsapp-adapter.ts` - Meta Cloud API
- `discord-adapter.ts` - Discord.js

**Flow**:
```
Webhook → Adapter → MessageQueue → AgentOrchestrator → Tools
```

**Queue**: All messages processed asynchronously via Bull queue
- Prevents webhook timeouts
- Retry with exponential backoff
- Monitorable via Bull Board (`/admin/queues`)

### 8. AI Provider Multi-Fallback

**Location**: `apps/api/src/services/ai/`

**Providers**:
- Google Gemini (default, faster & cheaper)
- Cloudflare Workers AI (fallback)

**Usage**:
```typescript
import { llmService } from '@/services/ai';

const response = await llmService.generate({
  messages: [...],
  system: AGENT_SYSTEM_PROMPT,
});
```

**LLM calls happen ONLY**:
- After intent classification
- For complex actions requiring planning
- When tools need AI-generated text

---

## Code Organization

### API (`apps/api/src/`)

```
src/
├── adapters/messaging/     # Telegram, WhatsApp, Discord adapters
│   ├── telegram-adapter.ts
│   ├── whatsapp-adapter.ts
│   ├── discord-adapter.ts
│   ├── index.ts
│   └── types.ts
├── config/                 # Configuration
│   ├── env.ts              # Environment validation (Zod)
│   ├── prompts.ts          # ⭐ All prompts centralized
│   └── redis.ts
├── db/
│   ├── schema/             # Drizzle schemas (11 tables)
│   │   ├── users.ts
│   │   ├── user-accounts.ts
│   │   ├── user-emails.ts
│   │   ├── conversations.ts
│   │   ├── messages.ts
│   │   ├── items.ts (memory_items)
│   │   ├── semantic-external-items.ts
│   │   ├── error-reports.ts
│   │   ├── linking-tokens.ts
│   │   ├── auth.ts
│   │   └── permissions.ts
│   └── index.ts            # DB connection
├── lib/
│   └── auth.ts             # Better Auth configuration
├── middlewares/
│   └── auth.middleware.ts  # Auth middleware for routes
├── routes/                 # HTTP routes
│   ├── health.ts
│   ├── webhook-new.ts      # Telegram/WhatsApp webhooks
│   ├── items.ts            # API routes for items
│   ├── dashboard/
│   │   ├── admin.routes.ts
│   │   ├── analytics.routes.ts
│   │   ├── index.ts
│   │   ├── memories.routes.ts
│   │   └── user.routes.ts
│   └── auth-better.routes.ts
├── scripts/                # Utility scripts
├── services/               # Business logic
│   ├── agent-orchestrator.ts    # ⭐ Main orchestrator
│   ├── intent-classifier.ts     # ⭐ Intent classification
│   ├── conversation-service.ts  # State machine
│   ├── item-service.ts          # Item CRUD operations
│   ├── user-service.ts          # User operations
│   ├── queue-service.ts         # Bull queue setup
│   ├── message-analysis/        # NLP-based message analysis
│   │   ├── message-analyzer.service.ts
│   │   ├── analyzers/            # Individual analyzers
│   │   │   ├── base-analyzer.ts
│   │   │   ├── profanity-analyzer.ts
│   │   │   ├── spam-analyzer.ts
│   │   │   ├── tone-analyzer.ts
│   │   │   └── ambiguity-analyzer.ts
│   │   └── training/             # NLP model training
│   ├── tools/                   # ⭐ Tool implementations
│   │   └── index.ts              # 11 tools with strong contracts
│   ├── enrichment/              # External API integrations
│   │   ├── index.ts
│   │   ├── tmdb-service.ts      # TMDB (movies/TV)
│   │   ├── youtube-service.ts    # YouTube API
│   │   └── opengraph-service.ts  # OpenGraph scraper
│   ├── ai/                      # AI integration
│   │   ├── index.ts
│   │   ├── embedding-service.ts  # Vector embeddings
│   │   ├── tool-executor.ts      # Tool execution
│   │   ├── tools.ts
│   │   └── types.ts
│   └── conversation/
│       ├── logMessages.ts
│       └── messageTemplates.ts
├── tests/                  # Vitest tests
│   ├── setup.ts
│   ├── intent-classifier.test.ts
│   ├── ai-fallback.test.ts
│   ├── api.test.ts
│   ├── clarification-flow.test.ts
│   ├── embedding-service.test.ts
│   ├── test-enrichment-flow.ts
│   ├── test-semantic-enrichment.ts
│   └── test-semantic-search-e2e.ts
├── types/
│   └── index.ts            # ⭐ AgentLLMResponse, types, interfaces
├── utils/
│   ├── json-parser.ts      # LLM JSON parsing
│   ├── logger.ts           # Pino logger
│   └── retry.ts            # Retry logic
├── index.ts                # Entry point
└── server.ts               # Hono app setup
```

### Dashboard (`apps/dashboard/app/`)

```
app/
├── assets/
│   └── css/main.css
├── components/             # Vue components
│   ├── AddMemoryModal.vue
│   ├── EditMemoryModal.vue
│   ├── dashboard/
│   │   ├── ChartCard.vue
│   │   └── KPICard.vue
│   └── ...
├── composables/
│   └── useDashboard.ts
├── config/
│   └── env.ts
├── layouts/
│   └── default.vue
├── middleware/
│   ├── auth.global.ts      # Auth middleware
│   └── role.ts             # Role-based access
├── pages/
│   ├── index.vue
│   ├── login.vue
│   ├── signup.vue
│   ├── memories.vue
│   ├── preferences.vue
│   ├── profile.vue
│   └── admin/
│       ├── conversations.vue
│       └── errors.vue
├── plugins/
│   ├── casl.ts             # Authorization
│   └── vue-query.ts        # TanStack Query
├── stores/
│   ├── auth.ts             # Pinia auth store
│   └── preferences.ts      # Pinia preferences store
├── types/
│   └── index.ts
├── utils/
│   ├── api.ts
│   ├── auth-client.ts
│   └── cn.ts               # Class name utility
├── app.config.ts           # Nuxt app config
├── app.vue                 # Root component
└── nuxt.config.ts          # Nuxt config
```

---

## Coding Conventions

### 1. Prompts Centralization

**CRITICAL**: All prompts in ONE file - `apps/api/src/config/prompts.ts`

**Never hardcode prompts** in service files.

**Prompts defined**:
- `INTENT_CLASSIFIER_PROMPT` - Intent classification
- `AGENT_SYSTEM_PROMPT` - Main agent (LLM as planner/writer)
- Various message templates and error messages

### 2. Path Aliases

**API** (`apps/api/tsconfig.json`):
```json
{
  "paths": {
    "@/*": ["./src/*"]
  }
}
```

**Dashboard** (`apps/dashboard/nuxt.config.ts`):
```typescript
{
  "alias": {
    "@/*": "./app/*"
  }
}
```

**Always use**:
```typescript
import { env } from '@/config/env';
import { logger } from '@/utils/logger';
import type { AgentLLMResponse } from '@/types';
```

**Never use**:
```typescript
import { env } from '../config/env';
import { logger } from '../../utils/logger';
```

### 3. Metadata Typing

**All item metadata typed** in `apps/api/src/types/index.ts` and `packages/shared/src/types/metadata.ts`:

```typescript
export type ItemType = 'movie' | 'tv_show' | 'video' | 'link' | 'note';

export interface MovieMetadata {
  tmdb_id: number;
  title: string;
  year: number;
  poster_path: string;
  overview: string;
  vote_average: number;
  genres: string[];
  // ... etc
}

export interface NoteMetadata {
  full_content: string;
  created_via: string;
  // ... etc
}
```

**Database**: Metadata stored as JSONB, but typed in TypeScript

### 4. Service Singleton Pattern

**Services exported as singleton instances**:

```typescript
// apps/api/src/services/conversation-service.ts

class ConversationService {
  // ... implementation
}

export const conversationService = new ConversationService();
```

**Usage**:
```typescript
import { conversationService } from '@/services/conversation-service';

await conversationService.findOrCreateConversation(userId);
```

### 5. Error Handling

**Centralized error handling** in `apps/api/src/services/error/error.service.ts`

**Use**:
```typescript
import { logError } from '@/utils/logger';

try {
  // ... code
} catch (error) {
  logError(error, { context: 'WEBHOOK', provider: 'telegram' });
  return c.json({ error: 'Internal error' }, 500);
}
```

**Error reporting**: Optional email reporting via Resend (`ADMIN_EMAIL`, `RESEND_API_KEY`)

### 6. Logging

**Pino logger** (`apps/api/src/utils/logger.ts`):

```typescript
import { loggers } from '@/utils/logger';

loggers.app.info('Server started');
loggers.ai.info({ message }, 'Processing');
loggers.webhook.warn({ body }, 'Message ignored');
loggers.ai.error({ err: error }, 'Failed to parse');
```

**Log levels**: debug, info, warn, error (controlled by `LOG_LEVEL` env var)

### 7. Validation

**Zod schemas** for environment validation in `apps/api/src/config/env.ts`:

```typescript
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  TELEGRAM_BOT_TOKEN: z.string(),
  // ... etc
});

export const env = envSchema.parse(process.env);
```

**Run-time validation**: App fails fast if env vars missing/invalid

### 8. JSON Parsing from LLM

**Use utility** in `apps/api/src/utils/json-parser.ts`:

```typescript
import { parseJSONFromLLM, isValidAgentResponse } from '@/utils/json-parser';

// Handles markdown code blocks, error messages, invalid JSON
const response = parseJSONFromLLM(llmOutput);

if (!isValidAgentResponse(response)) {
  throw new Error('Invalid response format');
}
```

### 9. Type Safety

**Strict TypeScript enabled**:

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

**Always prefer type safety**:
```typescript
// Good
const tool: ToolName = 'save_movie';

// Bad
const tool = 'save_movie';
```

### 10. Async/Await

**Use async/await consistently**:
```typescript
// Good
const result = await itemService.createItem({...});

// Bad (mixed)
const result = itemService.createItem({...}).then(r => r);
```

---

## Testing

### API (Vitest)

**Location**: `apps/api/src/tests/`

**Test pattern**:
```typescript
import { describe, test, expect } from 'vitest';

describe('IntentClassifier', () => {
  test('detects "sim" as confirm', async () => {
    const result = await classifier.classify('sim');
    expect(result.intent).toBe('confirm');
    expect(result.confidence).toBeGreaterThan(0.9);
  });
});
```

**Run tests**:
```bash
cd apps/api
pnpm test                     # All tests
pnpm test:watch              # Watch mode
pnpm test:ui                 # UI mode
pnpm test src/tests/intent-classifier.test.ts  # Specific file
```

### Dashboard (Vitest + Playwright)

**Unit tests** (`apps/dashboard/test/unit/`):
```typescript
import { describe, test, expect } from 'vitest';

describe('useDashboard', () => {
  test('fetches memories', async () => {
    // ... test
  });
});
```

**E2E tests** (Playwright):
```typescript
import { expect, test } from '@nuxt/test-utils/playwright'

test('home page loads', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await expect(page).toHaveTitle(/Nexo/)
})
```

**Run tests**:
```bash
cd apps/dashboard
pnpm test                    # All tests
pnpm test:watch              # Watch mode
pnpm test:unit               # Unit tests only
pnpm test:e2e                # Playwright E2E
pnpm test:e2e:ui             # Playwright UI
```

---

## Environment Configuration

### Required Environment Variables

**Copy example**:
```bash
cp apps/api/.env.example .env
```

**Minimum required**:
```bash
# Database
DATABASE_URL=postgresql://...

# Telegram (required)
TELEGRAM_BOT_TOKEN=your-bot-token

# Cloudflare AI (required)
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-api-token

# Enrichment APIs
TMDB_API_KEY=your-tmdb-key
YOUTUBE_API_KEY=your-youtube-key

# Redis (required for Bull queue)
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_USER=your-redis-user
REDIS_PASSWORD=your-redis-password

# Better Auth
BETTER_AUTH_SECRET=at-least-32-chars
BETTER_AUTH_URL=http://localhost:3000
DASHBOARD_URL=http://localhost:5173
```

**Optional**:
```bash
# WhatsApp
META_WHATSAPP_TOKEN=...
META_PHONE_NUMBER_ID=...
META_VERIFY_TOKEN=...

# Discord
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_BOT_TOKEN=...

# Google AI (fallback)
GOOGLE_API_KEY=...

# New Relic (observability)
NEW_RELIC_LICENSE_KEY=...
NEW_RELIC_ENABLED=true

# Email reporting
RESEND_API_KEY=...
ADMIN_EMAIL=...
```

### Dashboard Environment

**Location**: `apps/dashboard/app/config/env.ts`

**Runtime config** in `nuxt.config.ts`:
```typescript
runtimeConfig: {
  public: {
    apiUrl: env.NUXT_PUBLIC_API_URL,
    authBaseUrl: env.NUXT_PUBLIC_AUTH_BASE_URL,
  },
}
```

---

## Adding New Item Type

**Example**: Adding "podcast" type

### 1. Add Type & Metadata

`apps/api/src/types/index.ts`:
```typescript
export type ItemType = 'movie' | 'tv_show' | 'video' | 'link' | 'note' | 'podcast';

export interface PodcastMetadata {
  episode: string;
  duration: number;
  host: string;
  // ... other fields
}
```

`packages/shared/src/types/metadata.ts`:
```typescript
export interface PodcastMetadata {
  episode: string;
  duration: number;
  host: string;
}
```

### 2. Create Tool

`apps/api/src/services/tools/index.ts`:
```typescript
export async function save_podcast(
  context: ToolContext,
  params: { url: string; episode?: string }
): Promise<ToolOutput> {
  // ... implementation
}
```

### 3. Update Prompts

`apps/api/src/config/prompts.ts`:
```typescript
// Add to INTENT_CLASSIFIER_PROMPT
const INTENT_CLASSIFIER_PROMPT = `
...
System Capabilities:
- Save: movies, TV shows, videos, links, notes, podcasts
...
`;

// Add to AGENT_SYSTEM_PROMPT
const AGENT_SYSTEM_PROMPT = `
...
Tools:
- save_podcast(url, episode?)
...
`;
```

### 4. Update Type Lists

Update `ToolName` type and tool registry if needed.

### 5. Database Migration

```bash
cd apps/api
pnpm run db:generate   # Generate migration
pnpm run db:push       # Apply to database
```

### 6. Create Enrichment Service (Optional)

If external API integration needed:
`apps/api/src/services/enrichment/podcast-service.ts`

---

## Important Gotchas

### 1. Never Let LLM Manage State

**BAD**:
```typescript
// LLM decides when to save, what to save
const shouldSave = await askLLM("Should I save this?");
```

**GOOD**:
```typescript
// Code decides, LLM only plans
const intent = await intentClassifier.classify(message);
if (intent.action === 'save') {
  const plan = await llmService.generate({...});
  // Execute plan deterministically
}
```

### 2. LLM Response Must Be JSON

**Always use** `parseJSONFromLLM` to handle:
- Markdown code blocks (````json ... ````)
- Plain JSON
- Error messages from LLM
- Invalid JSON

### 3. Queue All Messages

**Never process webhooks synchronously** - always queue via Bull:
```typescript
await messageQueue.add('message-processing', {
  incomingMsg: message,
  providerName: 'telegram'
}, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 }
});
```

### 4. Use Strong Tool Contracts

**BAD**:
```typescript
save_memory(type: 'movie'|'note', content: string)  // Ambiguous
```

**GOOD**:
```typescript
save_movie(title: string, year?: number, tmdb_id?: number)  // Specific
save_note(content: string)
```

### 5. Duplicate Detection

**Automatic** via `contentHash` and `externalId`:
- Same user can't save duplicate item
- Returns `isDuplicate: true` with `existingItem`

### 6. Conversation Auto-Close

**Auto-close after 3 min inactivity**:
- State transitions to `waiting_close`
- Timer scheduled via Bull queue
- Context cleared on `closed`

**Do not** manually close conversations unless needed.

### 7. Vector Embeddings

**384-dim vectors** (BGE Small model):
- Stored in `memory_items.embedding`
- Used for semantic search
- For movies/TV/videos: prefer `semanticExternalItems` cache

### 8. Biome is Disabled

**Biome formatter/linter disabled** in `biome.json`:
```json
{
  "formatter": { "enabled": false },
  "linter": { "enabled": false }
}
```

**Use** standard formatting conventions manually.

### 9. Path Alias Imports

**API**: Use `@/` for imports
**Dashboard**: Nuxt auto-imports, but prefer `~/` for components

### 10. State Machine Transitions

**Always use** `conversationService.updateState()`:
```typescript
await conversationService.updateState(conversationId, 'processing');
```

**Never** manually update state in DB.

---

## Common Workflows

### Adding a New Message Analyzer

1. Create `apps/api/src/services/message-analysis/analyzers/your-analyzer.ts`
2. Extend `BaseAnalyzer` class
3. Implement `analyze()` method
4. Add to `message-analyzer.service.ts` registry

### Adding New Dashboard Page

1. Create `apps/dashboard/app/pages/your-page.vue`
2. Add route (auto-registered by Nuxt)
3. Add auth middleware if needed
4. Update nav menu

### Adding New API Route

1. Create route in `apps/api/src/routes/your-route.ts`
2. Register in `apps/api/src/server.ts`
3. Add auth middleware if needed
4. Update OpenAPI docs if public

### Database Schema Change

1. Modify `apps/api/src/db/schema/your-table.ts`
2. Run `pnpm run db:generate`
3. Review migration in `apps/api/drizzle/`
4. Run `pnpm run db:push`
5. Update TypeScript types if needed

---

## Architecture Decision Records (ADRs)

Key ADRs to understand:

**📐 Complete ADR List**: [docs/adr/README.md](docs/adr/README.md)

| ADR | Topic | Location |
|-----|-------|----------|
| ADR-001 | Cloudflare Workers | [docs/adr/001-message-analysis-architecture.md](docs/adr/001-message-analysis-architecture.md) |
| ADR-002 | Supabase PostgreSQL | [docs/adr/002-supabase-postgres.md](docs/adr/002-supabase-postgres.md) |
| ADR-003 | JSONB Metadata | [docs/adr/003-jsonb-metadata.md](docs/adr/003-jsonb-metadata.md) |
| ADR-004 | State Machine | [docs/adr/004-state-machine.md](docs/adr/004-state-machine.md) |
| ADR-005 | AI-Agnostic | [docs/adr/005-ai-agnostic.md](docs/adr/005-ai-agnostic.md) |
| ADR-007 | Multi-Provider Messaging | [docs/adr/007-multi-provider-support.md](docs/adr/007-multi-provider-support.md) |
| ADR-011 | **Deterministic Runtime Control** | [docs/adr/011-deterministic-runtime-control.md](docs/adr/011-deterministic-runtime-control.md) ⭐ |
| ADR-012 | Bun Test Framework | [docs/adr/012-bun-test-framework.md](docs/adr/012-bun-test-framework.md) |

**ADR-011 is most critical** - defines the core architecture principle.

---

## Debugging Tips

### View Queue Status

**Bull Board**: `http://localhost:3000/admin/queues`

### View Database

**Drizzle Studio**: `pnpm run db:studio` → `http://localhost:4983`

### Check Logs

**Pino logger** outputs JSON logs. Use `pino-pretty`:
```bash
pnpm run dev | pino-pretty
```

### Test Locally

**Telegram**: Use your bot in Telegram Desktop
**WhatsApp**: Requires Meta Business Account setup
**Dashboard**: `http://localhost:5173`

### API Docs

**Scalar UI**: `http://localhost:3000/reference`

---

## Performance Considerations

### Async Enrichment

**Movies/TV/Videos**: Bulk async enrichment via `enrichmentQueue`
- Queue all candidates as single job
- Worker processes batch
- Results cached in `semantic_external_items`

### Duplicate Detection

**Fast check via contentHash**:
- Prevents duplicate saves
- Returns existing item if found

### Vector Search

**Semantic search** via pgvector:
- HNSW index for fast approximate search
- Cosine similarity
- Cache external items to avoid re-embedding

### Queue Backpressure

**Message processing** via Bull queue:
- Prevents webhook timeouts
- Retry on failure
- Monitor queue depth

---

## Deployment

### Railway (API)

1. Connect GitHub repo
2. Set environment variables
3. Deploy from `development` branch
4. Railway assigns `PORT` automatically

### Vercel (Dashboard)

1. Connect GitHub repo
2. Configure build command: `pnpm run build`
3. Set environment variables
4. Deploy from `development` branch

### Cloudflare Workers (Optional)

1. `wrangler login`
2. `wrangler secret put DATABASE_URL`
3. Set other secrets
4. `wrangler deploy`

---

## Resources

### Documentation (New BMAD-Style Structure)

**📚 Main Documentation**: `docs/README.md`

- **📖 Tutorials** - Step-by-step guides
  - [Getting Started](docs/tutorials/getting-started.md)
  - [Setup Environment](docs/tutorials/setup-environment.md)
- **🛠️ How-To** - Practical guides
  - [Advanced Search](docs/how-to/advanced-search.md)
  - [Semantic Search](docs/how-to/semantic-search.md)
- **💡 Concepts** - Architecture understanding
  - [Architecture Overview](docs/concepts/architecture-overview.md)
  - [Deterministic Runtime](docs/concepts/deterministic-runtime.md)
  - [State Machine](docs/concepts/state-machine.md)
- **📋 Reference** - Technical reference
  - [BMAD Agents](docs/reference/agents.md) - BMAD methodology
  - [Implementation Checklist](docs/reference/implementation-checklist.md)
  - [Roadmap](docs/reference/roadmap.md)
- **📐 ADRs** - Architecture decisions
  - [All ADRs](docs/adr/README.md)
  - [ADR-011: Deterministic Runtime](docs/adr/011-deterministic-runtime-control.md) - **Critical!**

**Legacy** (being migrated):
- Architecture: `apps/api/docs/ARQUITETURA-v0.3.0.md`
- ADR List: `apps/api/docs/adr/README.md`
- Copilot Instructions: `.github/copilot-instructions.md`
- Implementation Plan: `implementation_plan.md`

### External Docs

- [Hono](https://hono.dev/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Better Auth](https://www.better-auth.com/)
- [Nuxt 4](https://nuxt.com/)
- [Vitest](https://vitest.dev/)
- [Playwright](https://playwright.dev/)
- [Bull](https://docs.bullmq.io/)

### Key Files to Understand

1. `apps/api/src/services/agent-orchestrator.ts` - Main orchestration
2. `apps/api/src/services/intent-classifier.ts` - Intent detection
3. `apps/api/src/types/index.ts` - Core types
4. `apps/api/src/config/prompts.ts` - All prompts
5. `apps/api/src/services/tools/index.ts` - Tool implementations
6. `apps/api/src/services/conversation-service.ts` - State management

---

## Summary for Agents

**When working in this codebase**:

1. **Never let LLM manage state or control flow**
2. **Always use `AgentLLMResponse` schema for LLM outputs**
3. **Use strong tool contracts - one tool, one purpose**
4. **Queue all webhook processing via Bull**
5. **Centralize all prompts in `config/prompts.ts`**
6. **Use path aliases (`@/`) for imports**
7. **Follow singleton pattern for services**
8. **Run tests after changes**
9. **Read ADR-011 for architecture principles** ([docs/adr/011-deterministic-runtime-control.md](docs/adr/011-deterministic-runtime-control.md))
10. **Check existing patterns before creating new ones**

**Documentation First**: Always check the new [docs/](docs/) folder when unsure about architecture or patterns.

**Golden Rule**: Code controls flow, LLM only plans. State is managed deterministically.
