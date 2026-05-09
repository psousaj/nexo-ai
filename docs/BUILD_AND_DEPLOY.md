# Build & Deploy

> Generated: May 9, 2026 | Branch: development | Commit: 07478fe

## Build system

### pnpm & Turbo

The monorepo uses pnpm workspaces + Turbo for:
- **Dependency linking:** `workspace:*` protocol links apps to packages
- **Task execution:** Turbo runs tasks in dependency order
- **Caching:** Builds are cached; only changed workspaces rebuild
- **Parallelization:** Tasks run in parallel when possible

### Root scripts

**Development:**
```bash
pnpm dev              # Start all dev servers (parallel)
pnpm dev:api          # Just API (http://localhost:3001)
pnpm dev:dash         # Just Dashboard (http://localhost:5173)
pnpm dev:landing      # Just Landing (http://localhost:5174)
```

**Building:**
```bash
pnpm build            # Build all workspaces (to dist/ or .output/)
pnpm build:api        # Just API
pnpm build:dashboard
pnpm build:landing
```

**Quality:**
```bash
pnpm lint             # Biome lint (checks all workspaces)
pnpm typecheck        # TypeScript (strict mode)
pnpm test             # Run all tests (Vitest)
pnpm format           # Auto-format (Biome)
pnpm clean            # Remove build artifacts
```

**Database:**
```bash
pnpm db:generate      # Generate Drizzle migrations (API only)
pnpm db:push          # Apply migrations to dev database
pnpm db:studio        # Open Drizzle Studio (UI for database)
pnpm db:seed:skills   # Populate initial skills data
```

### Workspace-specific scripts

Each app can be invoked via `--filter`:

```bash
# Long form
pnpm --filter @nexo/api run dev
pnpm --filter @nexo/dashboard run build
pnpm --filter @nexo/landing run preview

# Shorthand (if package.json name matches)
pnpm -F api run dev
```

## Build configurations

### API (`apps/api/`)

**Bundler:** tsup (generates `dist/index.js`)

**Config:** `apps/api/tsup.config.ts`

```ts
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  splitting: true,
  sourcemap: true,
  dts: true,
});
```

**Output:**
```
dist/
  ├── index.js         # Bundled code
  ├── index.js.map     # Sourcemap
  ├── index.d.ts       # Type definitions
  └── ...
```

**Dev mode:** `tsx watch` with nodemon (auto-restart)

### Dashboard (`apps/dashboard/`)

**Builder:** Vite (via Nuxt 3)

**Config:** `apps/dashboard/nuxt.config.ts`

```ts
export default defineNuxtConfig({
  ssr: false,  // SPA only
  nitro: { prerender: false },
  vite: { /* ... */ },
  css: ['~/assets/css/main.css'],
});
```

**Output:**
```
.output/
  ├── public/          # Static files
  │   ├── index.html
  │   └── _nuxt/       # Compiled Vue components
  └── server/          # (not used in SPA mode)
```

**Dev mode:** Nuxt dev server with HMR (hot module reload)

### Landing (`apps/landing/`)

**Builder:** Vite

**Config:** `apps/landing/vite.config.ts`

```ts
export default defineConfig({
  plugins: [vue()],
  build: { target: 'esnext' },
});
```

**Output:**
```
dist/
  ├── index.html
  ├── style.css
  └── main.js          # Bundled Vue app
```

## Testing

### Unit tests (Vitest)

```bash
pnpm test                    # Run all tests (all workspaces)
pnpm test:watch             # Watch mode (re-run on changes)
pnpm --filter @nexo/api run test
```

**Config:** `apps/api/vitest.config.ts`

```ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: [],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      exclude: ['node_modules/', 'dist/'],
    },
  },
});
```

**Test files:** `**/*.test.ts` or `**/*.spec.ts`

### E2E tests (Playwright)

```bash
pnpm test:e2e              # Run Playwright tests
pnpm test:e2e:ui           # Open Playwright UI
```

**Config:** `apps/dashboard/playwright.config.ts`

```ts
export default defineConfig({
  webServer: {
    command: 'pnpm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: false,
  },
  use: {
    baseURL: 'http://localhost:5173',
  },
});
```

**Test files:** `tests/**/*.spec.ts`

## Development workflow

### Local development

```bash
# 1. Setup
git clone https://github.com/psousaj/nexo-ai.git
cd nexo-ai
pnpm install
cp .env.example .env

# 2. Database setup
pnpm db:push

# 3. Start all services
pnpm dev

# 4. Open apps
# API: http://localhost:3001
# Dashboard: http://localhost:5173
# Landing: http://localhost:5174
```

### Making changes

**API changes:**
```bash
# Changes auto-reload via tsx watch
# Check logs in terminal
```

**Dashboard changes:**
```bash
# Changes auto-reload via Nuxt HMR
# Preserved state on reload
```

**Shared package changes:**
```bash
# Changes immediately available (workspace protocol)
# No rebuild needed for consumers
# Restart dev server if TypeScript types change
```

### Testing locally

```bash
# Before committing
pnpm lint        # Check linter
pnpm typecheck   # Type errors
pnpm test        # Unit tests
pnpm build       # Verify build succeeds
```

## CI/CD pipeline

### GitHub Actions

**Trigger:** Commits to `main`, `development`, or pull requests

**Workflow file:** `.github/workflows/test.yml`

**Steps:**
1. Checkout code
2. Setup Node.js 20 + pnpm
3. Install dependencies (cached)
4. Run `pnpm lint`
5. Run `pnpm typecheck`
6. Run `pnpm test`
7. Run `pnpm build`
8. (Optional) Deploy to Vercel/Railway

**Duration:** ~3-5 minutes

**Caching:** Dependencies cached via `pnpm/action-setup`

### Deployment

#### API Deployment (Railway/Heroku)

**Dockerfile:** `apps/api/Dockerfile`

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY package.json ./
COPY apps/api ./apps/api
COPY packages ./packages
RUN pnpm install --frozen-lockfile
RUN pnpm run build:api

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/apps/api/dist ./
EXPOSE 3001
CMD ["node", "index.js"]
```

**Environment variables:** Set in Railway/Heroku console
- `DATABASE_URL`
- `REDIS_HOST`, `REDIS_PASSWORD`
- `CLOUDFLARE_API_TOKEN`
- All third-party API keys

**Health check:** `GET /health` returns 200 (database responsive)

#### Dashboard Deployment (Vercel)

**Config:** `apps/dashboard/vercel.json`

```json
{
  "buildCommand": "cd ../.. && pnpm run build:dashboard",
  "outputDirectory": "apps/dashboard/.output/public",
  "env": {
    "VITE_API_URL": "@vite-api-url"
  }
}
```

**Steps:**
1. Connect GitHub repo to Vercel
2. Set environment variables (VITE_API_URL)
3. Deploy: `pnpm build` → `.output/public`

**Auto-deploy:** Every push to `main` branch

#### Landing Deployment (Vercel)

**Config:** `apps/landing/vercel.json`

```json
{
  "buildCommand": "cd ../.. && pnpm run build:landing",
  "outputDirectory": "apps/landing/dist"
}
```

## Docker Compose (local dev)

**File:** `docker/docker-compose.yml`

**Services:**
- **evolution-api** — WhatsApp gateway (atendai/evolution-api:v2.1.1)
- **nexo-app** — API server (built from Dockerfile)
- **postgres** — Database
- **redis** — Cache + queue

**Usage:**
```bash
cd docker
docker-compose up -d

# Services running:
# - Nexo API: http://localhost:3001
# - Evolution API: http://localhost:8082
# - PostgreSQL: localhost:5432
# - Redis: localhost:6379
```

## Troubleshooting builds

### Cache invalidation

If Turbo cache is stale:

```bash
pnpm run clean        # Remove all artifacts
rm -rf .turbo         # Remove Turbo cache
pnpm install          # Reinstall
pnpm build            # Rebuild from scratch
```

### Build failures

**API build fails:**
```bash
pnpm --filter @nexo/api run build  # Get detailed error
```

**Dashboard build fails:**
```bash
pnpm --filter @nexo/dashboard run build
# Check for TypeScript errors: pnpm typecheck
```

### Lock file conflicts

If `pnpm-lock.yaml` has conflicts:

```bash
git checkout --theirs pnpm-lock.yaml  # Keep remote version
pnpm install                          # Regenerate lock file
```

## Performance optimization

### Reducing build time

1. **Don't rebuild everything:**
   ```bash
   pnpm build:api     # Only build API
   ```

2. **Use Turbo cache:**
   ```bash
   pnpm build         # Automatically caches; second run is instant
   ```

3. **Parallel tasks:**
   ```bash
   pnpm dev           # Runs all dev servers in parallel
   ```

### Optimizing bundle size

**API:**
- Code splitting: tsup `splitting: true`
- Treeshaking: Ensure ESM exports

**Dashboard:**
- Lazy-load routes: Nuxt auto-code-splitting
- Dynamic imports: `defineAsyncComponent()`

**Landing:**
- Minimize CSS: Tailwind `purge` config

---

**See also:** [ARCHITECTURE.md](./ARCHITECTURE.md), [SHARED_PACKAGES.md](./SHARED_PACKAGES.md)
