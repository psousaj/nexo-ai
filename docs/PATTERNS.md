# Patterns & Conventions

> Generated: May 9, 2026 | Branch: development | Commit: 07478fe

## Code patterns

### Singleton pattern

Services and registries are instantiated once and reused.

**Example:**
```ts
// core/registries/tool-registry.ts
let toolRegistry: PostgresToolRegistry | null = null;

export function getToolRegistry(): HermesToolRegistry {
  if (!toolRegistry) {
    toolRegistry = new PostgresToolRegistry();
  }
  return toolRegistry;
}
```

**Usage:**
```ts
const registry = getToolRegistry();
const catalog = await registry.buildHermesToolCatalog();
```

**Why:** Avoid recreating expensive objects; simplifies dependency injection.

---

### Repository pattern

Data access is abstracted behind a repository interface.

**Example:**
```ts
interface MemoryRegistry {
  search(query: string, userId: string): Promise<MemoryItem[]>;
  save(item: MemoryItem): Promise<void>;
  delete(id: string): Promise<void>;
}

class PostgresMemoryRegistry implements MemoryRegistry {
  async search(query, userId) {
    // Query implementation
  }
}
```

**Why:** Swap implementations (PostgreSQL → MongoDB) without changing call sites.

---

### Strategy pattern

Different behaviors encapsulated as interchangeable strategies.

**Example (Tool policies):**
```ts
interface ToolExecutionPolicy {
  validate(tool: ToolDefinition): boolean;
  execute(tool: ToolDefinition, input: unknown): Promise<unknown>;
}

class RateLimitPolicy implements ToolExecutionPolicy {
  validate(tool: ToolDefinition): boolean {
    return !isRateLimited(tool.name);
  }
}
```

---

### Registry pattern

Dynamic lookup of objects by key.

**Example:**
```ts
class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  register(name: string, tool: ToolDefinition) {
    this.tools.set(name, tool);
  }

  get(name: string): ToolDefinition {
    return this.tools.get(name) ?? throw new Error(`Tool not found: ${name}`);
  }
}
```

---

### Factory pattern

Encapsulate object creation logic.

**Example:**
```ts
export function createHermesRuntime(deps?: {
  modelTurnRunner?: ModelTurnRunner;
  toolRegistry?: HermesToolRegistry;
}): HermesRuntime {
  const modelTurnRunner = deps?.modelTurnRunner ?? new DefaultModelTurnRunner();
  const toolRegistry = deps?.toolRegistry ?? new PostgresToolRegistry();
  
  return {
    sessionRegistry: new PostgresSessionRegistry(),
    memoryRegistry: new PostgresMemoryRegistry(),
    toolRegistry,
    kernel: new HermesKernel({ modelTurnRunner, toolRegistry }),
  };
}
```

---

### Error boundary pattern

Catch and transform errors at boundary layers.

**Example:**
```ts
// routes/memories.ts
app.get('/memories', async (c) => {
  try {
    const results = await memoryRegistry.search(query);
    return c.json({ results });
  } catch (error) {
    if (error instanceof ValidationError) {
      return c.json({ error: error.message }, 400);
    }
    throw error;  // Re-throw to global handler
  }
});
```

---

### Result type pattern

Return success/failure in a single type.

**Example (from Rust-like patterns):**
```ts
type Result<T> = 
  | { ok: true; value: T }
  | { ok: false; error: string };

async function saveMemory(item: MemoryItem): Promise<Result<string>> {
  try {
    const id = await db.insert(memoryItems).values(item);
    return { ok: true, value: id };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}
```

---

### Composition over inheritance

Favor object composition over class inheritance.

**Example:**
```ts
// ✗ Bad: Deep inheritance
class Agent extends Entity {}
class ConversationalAgent extends Agent {}
class MemoryAgent extends ConversationalAgent {}

// ✓ Good: Composition
class Agent {
  constructor(
    private conversationHandler: ConversationHandler,
    private memoryHandler: MemoryHandler,
  ) {}
}
```

---

## Naming conventions

### File names

- **Files:** kebab-case (e.g., `intent-classifier.ts`)
- **Classes:** PascalCase (e.g., `class HermesKernel`)
- **Interfaces:** PascalCase, often prefixed with `I` or descriptive (e.g., `interface ToolRegistry`)
- **Types:** PascalCase (e.g., `type AgentLLMResponse`)
- **Constants:** UPPER_SNAKE_CASE (e.g., `const MAX_TURNS = 6`)
- **Functions:** camelCase (e.g., `const executeToolWithPolicy`)
- **Variables:** camelCase (e.g., `let isProcessing = false`)

### Database objects

- **Tables:** snake_case, plural (e.g., `memory_items`, `conversations`)
- **Columns:** snake_case, not prefixed (e.g., `user_id` not `memory_items_user_id`)
- **Constraints:** descriptive, prefixed (e.g., `pk_memory_items`, `fk_memory_items_user_id`)

### API endpoints

- **Verbs:** HTTP methods (GET, POST, DELETE)
- **Nouns:** Plural resource names (e.g., `/memories`, not `/memory`)
- **Nesting:** Max 2 levels (e.g., `/conversations/:id/messages`, avoid deeper)

---

## Project structure conventions

### Module organization

```
src/
  ├── domain/           # Business logic, types
  ├── application/      # Use cases, services
  ├── infrastructure/   # Database, external APIs
  ├── presentation/     # HTTP handlers, CLI
  └── shared/           # Utilities, helpers
```

### Path aliases

- **`@/`** — Absolute import from workspace root (API)
- **`~/`** — Absolute import from app root (Dashboard)

**Usage:**
```ts
// ✓ Good: Clear, no relative imports
import { MemoryRegistry } from '@/core/registries/memory-registry';
import { useAbility } from '~/composables/useAbility';

// ✗ Bad: Relative, hard to refactor
import { MemoryRegistry } from '../../../core/registries/memory-registry';
```

---

## TypeScript conventions

### Strict types

All files use strict mode:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

### Type annotations

Always annotate function parameters and return types:

```ts
// ✓ Good
async function saveMemory(item: MemoryItem): Promise<string> {
  return await db.insert(memoryItems).values(item);
}

// ✗ Bad: Type inference
async function saveMemory(item) {
  return await db.insert(memoryItems).values(item);
}
```

### Enums vs Union types

Prefer union types for simple cases:

```ts
// ✓ Good: Union type (simple)
type State = 'active' | 'closed' | 'archived';

// ✗ Bad: Enum (overkill)
enum State { Active = 'active', Closed = 'closed' }
```

Use enums for large sets or when adding methods:

```ts
// ✓ Good: Enum (many values, methods)
enum Permission {
  Read = 'read',
  Write = 'write',
  Delete = 'delete',
  Admin = 'admin',
}
```

---

## Testing patterns

### Arrange-Act-Assert (AAA)

All tests follow this structure:

```ts
it('saves memory with embedding', async () => {
  // Arrange: Set up data and mocks
  const item = { title: 'Test', type: 'movie' };
  vi.mock('@/core/gateway/cloudflare-gateway', () => ({
    generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, ...]),
  }));

  // Act: Execute the function
  const result = await memoryService.save(item);

  // Assert: Check the result
  expect(result.id).toBeDefined();
  expect(result.embedding).toHaveLength(384);
});
```

### Mocking third-party APIs

```ts
// Mock enrichment service
vi.mock('@/core/enrichment/tmdb-service', () => ({
  tmdbService: {
    enrich: vi.fn().mockResolvedValue({
      imdb_id: 'tt1234567',
      rating: 8.5,
    }),
  },
}));
```

---

## Git conventions

### Commit messages

Follow conventional commits:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:** `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`

**Examples:**
```
feat(kernel): add interrupt signal support
fix(memory): deduplicate search results
refactor(enrichment): extract tmdb service
docs(api): update endpoint documentation
```

**Scope:** Affected module or feature (optional but recommended)

### Branch names

- **Feature:** `feat/description` (e.g., `feat/multi-provider-support`)
- **Bug fix:** `fix/description` (e.g., `fix/webhook-idempotency`)
- **Refactor:** `refactor/description` (e.g., `refactor/context-builder`)

---

## Environment variable conventions

### Naming

- **Uppercase:** `DATABASE_URL`, `REDIS_PASSWORD`
- **Prefix by app:** `VITE_API_URL` (Dashboard only), no prefix for shared (API, both)
- **Suffix for sensitive:** `_SECRET`, `_TOKEN`, `_KEY` (e.g., `OAUTH_GOOGLE_SECRET`)

### Validation

All environment variables are validated via Zod at startup:

```ts
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.string().transform(Number).pipe(z.number().int().positive()),
  NODE_ENV: z.enum(['development', 'production']),
});

const env = envSchema.parse(process.env);  // Fails if invalid
```

---

## Documentation conventions

### Code comments

- **Why, not what:** Comment explains intent, not implementation
- **No obvious comments:** Don't comment self-explanatory code

```ts
// ✓ Good: Explains why
// Rate limit per user to prevent abuse (ADR-012)
const isRateLimited = await redis.get(`rate_limit:${userId}`);

// ✗ Bad: Obvious
const result = query.filter(x => x.active);  // Filter active items
```

### Function documentation

Use JSDoc for public APIs:

```ts
/**
 * Search user's memories using hybrid search (keyword + semantic).
 * 
 * @param query - User search query or semantic embedding
 * @param userId - Owner of the memories
 * @param limit - Max results (default: 10)
 * @returns Promise of matching memory items
 * 
 * @example
 * const results = await search('sci-fi movies', userId, 5);
 */
async function search(
  query: string,
  userId: string,
  limit: number = 10,
): Promise<MemoryItem[]> {
  // ...
}
```

---

## ADR-driven decisions

Major decisions are recorded in Architecture Decision Records (`apps/api/docs/adr/`).

**When to write an ADR:**
- Architectural decision (e.g., adopt Drizzle ORM instead of TypeORM)
- Policy decision (e.g., deterministic runtime control)
- Major refactor (e.g., conversation state machine redesign)

**Format:**
```markdown
# ADR-NNN: [Title]

## Context
Why is this decision needed?

## Options considered
1. Option A
2. Option B
3. Option C

## Decision
We choose Option B because...

## Consequences
- Positive: ...
- Negative: ...
- Risks: ...
```

---

**See also:** [TECH_DEBT.md](./apps/api/TECH_DEBT.md), [apps/api/docs/adr/](../apps/api/docs/adr/)
