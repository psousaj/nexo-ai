# ============================================
# Stage 1: Build
# ============================================
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Monorepo metadata
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./

# Workspace manifests required for dependency graph
COPY apps/bots/package.json apps/bots/
COPY packages/api-core/package.json packages/api-core/
COPY packages/env/package.json packages/env/
COPY packages/shared/package.json packages/shared/
COPY packages/otel/package.json packages/otel/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY packages/prettier-config/package.json packages/prettier-config/

RUN pnpm install --frozen-lockfile

# Source code
COPY packages/ packages/
COPY apps/bots/ apps/bots/

# Build bots (and dependent workspaces via Turbo graph)
RUN pnpm build --filter=@nexo/bots

# ============================================
# Stage 2: Runner
# ============================================
FROM node:22-alpine AS runner

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Monorepo metadata
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Workspace manifests for production install
COPY apps/bots/package.json apps/bots/
COPY packages/api-core/package.json packages/api-core/
COPY packages/env/package.json packages/env/
COPY packages/shared/package.json packages/shared/
COPY packages/otel/package.json packages/otel/

RUN pnpm install --frozen-lockfile --prod

# Runtime artifacts
COPY --from=builder /app/apps/bots/dist/ apps/bots/dist/
COPY --from=builder /app/packages/api-core/dist/ packages/api-core/dist/
COPY --from=builder /app/packages/env/dist/ packages/env/dist/
COPY --from=builder /app/packages/shared/dist/ packages/shared/dist/
COPY --from=builder /app/packages/otel/dist/ packages/otel/dist/

ENV NODE_ENV=production
EXPOSE 3030

CMD ["node", "apps/bots/dist/index.js"]
