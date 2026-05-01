FROM node:22-alpine AS base

RUN npm install -g pnpm@9.15.4

WORKDIR /app

# ============================================
# Stage 1: Dependencies
# ============================================
FROM base AS deps

# Copia configs do monorepo (pnpm workspace, lockfile, turbo)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./

# Copia package.json dos workspaces usados pela API
COPY apps/api/package.json apps/api/
COPY packages/api-core/package.json packages/api-core/
COPY packages/shared/package.json packages/shared/
COPY packages/env/package.json packages/env/
COPY packages/otel/package.json packages/otel/
COPY packages/typescript-config/package.json packages/typescript-config/

# Instala dependências (incluindo dev) para build e runtime com tsx loader
RUN pnpm install --frozen-lockfile

# ============================================
# Stage 2: Build
# ============================================
FROM deps AS builder

# Copia código-fonte necessário para build
COPY packages/ packages/
COPY apps/api/ apps/api/

# Build da API (Turbo resolve dependências de workspace)
RUN pnpm build --filter=@nexo/api

# ============================================
# Stage 3: Runner
# ============================================
FROM base AS runner

# Create a group and user
RUN addgroup -g 1001 -S appgroup && adduser -S -D -H -u 1001 -G appgroup appuser

WORKDIR /app

# Reusa node_modules completos do stage deps para garantir tsx em runtime
COPY --from=deps /app/node_modules/ node_modules/
COPY --from=deps /app/apps/api/node_modules/ apps/api/node_modules/
COPY --from=deps /app/packages/api-core/node_modules/ packages/api-core/node_modules/
COPY --from=deps /app/packages/env/node_modules/ packages/env/node_modules/
COPY --from=deps /app/packages/otel/node_modules/ packages/otel/node_modules/
COPY --from=deps /app/packages/shared/node_modules/ packages/shared/node_modules/

# Metadados de workspace necessários para resolução de pacotes pnpm
COPY --from=deps /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/package.json /app/turbo.json ./
COPY --from=deps /app/apps/api/package.json apps/api/
COPY --from=deps /app/packages/api-core/package.json packages/api-core/
COPY --from=deps /app/packages/shared/package.json packages/shared/
COPY --from=deps /app/packages/env/package.json packages/env/
COPY --from=deps /app/packages/otel/package.json packages/otel/
COPY --from=deps /app/packages/typescript-config/package.json packages/typescript-config/

# Dist de pacotes compilados
COPY --from=builder /app/packages/shared/dist/ packages/shared/dist/
COPY --from=builder /app/packages/env/dist/ packages/env/dist/
COPY --from=builder /app/packages/otel/dist/ packages/otel/dist/

# Dist da API
COPY --from=builder /app/apps/api/dist/ apps/api/dist/

# O pacote api-core ainda exporta de src; mantém fontes + tsconfig para runtime
COPY --from=builder /app/packages/api-core/src/ packages/api-core/src/
COPY --from=builder /app/packages/api-core/tsconfig.json packages/api-core/tsconfig.json
COPY --from=builder /app/packages/typescript-config/ packages/typescript-config/

ENV NODE_ENV=production

# Runtime atual precisa do tsx loader para resolver imports TS de @nexo/api-core.
ENV NODE_OPTIONS=--import=/app/apps/api/node_modules/tsx/dist/loader.mjs
ENV TSX_TSCONFIG_PATH=/app/packages/api-core/tsconfig.json

# Garante caminho explícito do modelo NLP em produção
ENV NEXO_MODEL_PATH=/app/packages/api-core/src/services/message-analysis/training/model/nexo-model.nlp

EXPOSE 3001

RUN chown -R appuser:appgroup /app

# Switch to the non-root user
USER appuser

CMD ["node", "apps/api/dist/index.js"]
