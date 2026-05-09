# Conventions & Best Practices

> Generated: May 9, 2026 | Branch: development | Commit: 07478fe

## Code quality standards

### Linting & formatting

**Biome** is the single linter/formatter for the entire monorepo.

**Config:** Root `biome.json`

```bash
pnpm lint                # Check linter errors
pnpm format              # Auto-format code
pnpm format:check        # Check if formatting needed
```

**Standards enforced:**
- 2-space indentation
- Semicolons required
- Double quotes for strings
- Trailing commas in multiline
- No console.log in production code
- No debugger statements
- No unused variables

### TypeScript strictness

All code uses `strict: true`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

**No-escape clauses:**
- `@ts-expect-error` — Use with comment explaining why
- `@ts-ignore` — Forbidden (use @ts-expect-error instead)
- `any` — Only with explicit approval

### Import conventions

**Order of imports (enforced by Biome):**

```ts
// 1. Node built-ins
import fs from 'fs';
import path from 'path';

// 2. External packages
import { z } from 'zod';
import { hc } from 'hono/client';

// 3. Relative imports (workspace packages)
import { getApiEnv } from '@nexo/env';
import { MemoryItemSchema } from '@nexo/shared';

// 4. Local imports (from same workspace)
import { HermesKernel } from '@/core/kernel/hermes-kernel';
import { getToolRegistry } from '@/core/registries/tool-registry';

// 5. Side effects
import './telemetry';
```

**Absolute imports preferred:**
- ✓ `import { HermesKernel } from '@/core/kernel/hermes-kernel';`
- ✗ `import { HermesKernel } from '../../../core/kernel/hermes-kernel';`

---

## API conventions

### Endpoint design

**URI design:**
- Resources are plural nouns: `/memories`, `/conversations`
- Avoid action verbs: ✗ `/create-memory`, ✓ `POST /memories`
- Max 2 levels deep: `/conversations/:id/messages` ✓, `/users/:id/conversations/:id/messages/:id/drafts` ✗

**Request/response format:**

```ts
// POST /memories (Create)
Request body:
{
  "title": "Inception",
  "type": "movie",
  "metadata": { ... }
}

Response (201 Created):
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Inception",
  "type": "movie",
  "createdAt": "2025-05-09T10:30:00Z"
}

// GET /memories?query=scifi&limit=10 (Search)
Response (200 OK):
{
  "results": [
    { "id": "...", "title": "...", "score": 0.95 },
    { ... }
  ],
  "total": 42
}

// DELETE /memories/:id (Delete)
Response (204 No Content):
{ }
```

**Error responses:**

```ts
// 400 Bad Request
{
  "error": "VALIDATION_ERROR",
  "message": "Field 'title' is required",
  "details": { "field": "title" }
}

// 404 Not Found
{
  "error": "NOT_FOUND",
  "message": "Memory item not found"
}

// 401 Unauthorized
{
  "error": "UNAUTHORIZED",
  "message": "Valid session required"
}

// 500 Internal Server Error
{
  "error": "INTERNAL_ERROR",
  "message": "Unexpected error occurred"
}
```

### Authentication

**Session cookie (preferred for browser clients):**
```ts
// After login, server sets:
Set-Cookie: session=<jwt>; HttpOnly; Secure; SameSite=Strict

// Browser auto-includes in subsequent requests
// No additional headers needed
```

**Bearer token (for API clients):**
```ts
Authorization: Bearer <token>
```

**Implementation:**
```ts
// Middleware: Check session or bearer token
app.use(authMiddleware);

async function authMiddleware(c, next) {
  const session = await getSession(c.req.cookies.get('session'));
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  c.set('user', session.user);
  await next();
}

// Endpoint
app.get('/profile', async (c) => {
  const user = c.get('user');
  return c.json({ user });
});
```

---

## Database conventions

### Schema design

**Table naming:**
```sql
-- ✓ Good: Plural, descriptive, lowercase
CREATE TABLE memory_items (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  type TEXT NOT NULL, -- 'movie', 'tv', 'video', 'link', 'note'
  title TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  embedding vector(384) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ✗ Bad: Singular, ambiguous
CREATE TABLE memory (
  mem_id UUID PRIMARY KEY,
  ...
);
```

**Column conventions:**
- Use snake_case for names
- Foreign keys: `<table>_id` (e.g., `user_id`)
- Timestamps: `created_at`, `updated_at` (UTC, TIMESTAMP)
- Boolean flags: `is_*` prefix (e.g., `is_public`, `is_deleted`)
- No column prefix (e.g., ✗ `memory_id`, ✓ `id`)

**Constraints:**
- Always add `NOT NULL` for required fields
- Use `DEFAULT` for standard values
- Add `UNIQUE` constraints where appropriate
- Use foreign keys with `ON DELETE CASCADE` or `ON DELETE SET NULL`

### Query patterns (Drizzle)

**Select:**
```ts
// Single record
const user = await db
  .select()
  .from(users)
  .where(eq(users.id, userId))
  .limit(1);

// Multiple records with filter
const memories = await db
  .select()
  .from(memoryItems)
  .where(eq(memoryItems.userId, userId))
  .orderBy(desc(memoryItems.createdAt))
  .limit(10);

// Join
const conversations = await db
  .select({
    id: conversations.id,
    title: conversations.title,
    userName: users.name,
  })
  .from(conversations)
  .innerJoin(users, eq(conversations.userId, users.id));
```

**Insert:**
```ts
// Single
const [id] = await db
  .insert(memoryItems)
  .values({ userId, type, title, ... })
  .returning({ id: memoryItems.id });

// Batch
await db.insert(memoryItems).values([
  { userId, type: 'movie', title: 'Inception', ... },
  { userId, type: 'tv', title: 'Breaking Bad', ... },
]);
```

**Update:**
```ts
await db
  .update(memoryItems)
  .set({ title: 'New Title', updatedAt: new Date() })
  .where(eq(memoryItems.id, itemId));
```

**Delete:**
```ts
await db
  .delete(memoryItems)
  .where(eq(memoryItems.id, itemId));
```

**JSONB operations:**
```ts
// Store complex metadata
await db.insert(memoryItems).values({
  metadata: {
    tmdb_id: 278,
    rating: 9.0,
    genres: ['Drama', 'Crime'],
  },
});

// Query JSONB field
const movies = await db
  .select()
  .from(memoryItems)
  .where(
    and(
      eq(memoryItems.type, 'movie'),
      gte(
        sql`CAST(${memoryItems.metadata}->'rating' AS FLOAT)`,
        8.0
      )
    )
  );
```

### Migrations

**Create new migration:**
```bash
pnpm db:generate  # Generates SQL file in drizzle/
```

**Migration file naming:**
```
drizzle/0010_add_user_preferences.sql
```

**Never edit migrations manually** — regenerate via Drizzle schema.ts

**Apply migrations:**
```bash
pnpm db:push  # Applies pending migrations to dev database
```

---

## Frontend conventions

### Vue component structure

**Single File Component (SFC) layout:**

```vue
<template>
  <!-- 1. Root container with data binding -->
  <div class="memory-card" :class="{ selected: isSelected }">
    <!-- 2. Content -->
    <h3>{{ memory.title }}</h3>
    <p>{{ memory.description }}</p>

    <!-- 3. Actions -->
    <button @click="handleEdit">Edit</button>
    <button @click="handleDelete">Delete</button>
  </div>
</template>

<script setup lang="ts">
// 1. Imports
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAbility } from '~/composables/useAbility';

// 2. Props
interface Props {
  memory: MemoryItem;
  editable?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  editable: false,
});

// 3. Emits
const emit = defineEmits<{
  update: [MemoryItem];
  delete: [string];
}>();

// 4. Local state
const isSelected = ref(false);

// 5. Composables
const { ability } = useAbility();
const router = useRouter();

// 6. Computed properties
const canEdit = computed(() => props.editable && ability.can('update', 'memory'));

// 7. Methods
const handleEdit = () => {
  router.push(`/memories/${props.memory.id}/edit`);
};

const handleDelete = async () => {
  emit('delete', props.memory.id);
};
</script>

<style scoped>
.memory-card {
  padding: 1rem;
  border: 1px solid #ccc;
  border-radius: 0.5rem;
}

.memory-card.selected {
  border-color: #0066cc;
  background-color: #f0f7ff;
}
</style>
```

### Composables

**Naming:** `use[Name].ts` pattern

**Structure:**
```ts
// ~/composables/useDashboard.ts
import { ref, computed } from 'vue';
import { useQuery } from '@tanstack/vue-query';

export function useDashboard() {
  // 1. State
  const selectedItemId = ref<string | null>(null);

  // 2. Queries
  const { data: memories } = useQuery({
    queryKey: ['memories', selectedItemId.value],
    queryFn: () => api.getMemories({ id: selectedItemId.value }),
  });

  // 3. Computed
  const selectedMemory = computed(
    () => memories.value?.find(m => m.id === selectedItemId.value)
  );

  // 4. Methods
  const selectMemory = (id: string) => {
    selectedItemId.value = id;
  };

  // 5. Return
  return { memories, selectedMemory, selectMemory };
}
```

### Styling

**Tailwind CSS only** — No inline styles or CSS-in-JS

```vue
<!-- ✓ Good: Tailwind classes -->
<div class="flex items-center gap-4 p-4 rounded-lg border border-gray-200">
  <img :src="avatar" class="w-10 h-10 rounded-full" />
  <h3 class="text-lg font-semibold">{{ name }}</h3>
</div>

<!-- ✗ Bad: Inline styles -->
<div style="display: flex; gap: 16px; padding: 16px;">
  <h3 style="font-size: 18px;">{{ name }}</h3>
</div>
```

---

## Documentation conventions

### Code comments

**Document the "why", not the "what":**

```ts
// ✓ Good: Explains intent and context
// Rate limit per user to prevent API abuse (per ADR-012)
// Max 100 searches per hour per user
if (searchCount > 100) {
  throw new RateLimitError('Too many searches');
}

// ✗ Bad: Obvious from code
const x = 100;  // Set x to 100
if (searchCount > x) {  // If search count > x
  throw new Error();  // Throw error
}
```

**Complex algorithms get JSDoc:**

```ts
/**
 * Hybrid search combining keyword and semantic search.
 *
 * Algorithm:
 * 1. Execute keyword search (PostgreSQL full-text search)
 * 2. Execute semantic search (pgvector similarity)
 * 3. Merge results, dedup by ID
 * 4. Re-rank by hybrid score
 *
 * @param query - Search terms
 * @param embedding - Vector embedding of query
 * @param limit - Max results
 * @returns Array of matching items sorted by relevance
 */
async function hybridSearch(
  query: string,
  embedding: number[],
  limit: number = 10
): Promise<MemoryItem[]> {
  // ...
}
```

### README structure

Each workspace has a `README.md` with:

```markdown
# @nexo/api

> Description of what this workspace does

## Quick start

Steps to get running locally.

## Scripts

Table of available npm scripts.

## Architecture

High-level overview (link to docs if detailed).

## Contributing

Notes specific to this workspace.

## Troubleshooting

Common issues and solutions.
```

---

## Testing conventions

### Test file location

```
src/
  ├── core/
  │   ├── kernel.ts
  │   └── kernel.test.ts    ← Test co-located
  ├── services/
  │   ├── agent.ts
  │   └── agent.test.ts
  └── types.ts
```

**Not in separate `__tests__` folder** — Keep tests with code.

### Test structure (AAA)

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryService } from './memory-service';

describe('MemoryService', () => {
  let service: MemoryService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { insert: vi.fn(), select: vi.fn() };
    service = new MemoryService(mockDb);
  });

  it('saves memory with embedding', async () => {
    // Arrange
    const input = { title: 'Inception', type: 'movie' };
    const expected = { id: 'uuid', embedding: [0.1, 0.2, ...] };
    mockDb.insert.mockResolvedValue(expected);

    // Act
    const result = await service.save(input);

    // Assert
    expect(result).toEqual(expected);
    expect(mockDb.insert).toHaveBeenCalled();
  });
});
```

### Naming

- Test suite: `describe('ComponentName', () => { ... })`
- Test case: `it('should [expected behavior]', () => { ... })`

---

## ADR (Architecture Decision Records)

**File:** `apps/api/docs/adr/ADR-NNN-title.md`

**Format:**

```markdown
# ADR-NNN: [Title]

**Date:** 2025-05-09
**Status:** Accepted | Proposed | Superseded

## Context

Why is this decision needed?

## Problem

What problem are we solving?

## Options considered

### Option A: [Name]
Pros: ...
Cons: ...

### Option B: [Name]
Pros: ...
Cons: ...

## Decision

We choose **Option B** because [reasons].

## Consequences

### Positive
- ...

### Negative
- ...

### Risks
- ...

## Alternatives considered

Why not Option A? [explanation]

## Related

Links to related ADRs or documentation.
```

---

**See also:** [GLOSSARY.md](./GLOSSARY.md), [PATTERNS.md](./PATTERNS.md), [BUILD_AND_DEPLOY.md](./BUILD_AND_DEPLOY.md)
