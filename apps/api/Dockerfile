FROM node:22-alpine AS base

RUN npm install -g pnpm@9.15.4

WORKDIR /app

# ============================================
# Stage 1: Dependencies
# ============================================
FROM base AS deps

# Copia configs do monorepo (pnpm workspace, lockfile, turbo)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./

# Copia package.json dos workspaces usados por API + Bots
COPY apps/api/package.json apps/api/
COPY apps/bots/package.json apps/bots/
COPY packages/api-core/package.json packages/api-core/
COPY packages/shared/package.json packages/shared/
COPY packages/env/package.json packages/env/
COPY packages/otel/package.json packages/otel/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/auth/package.json packages/auth/

# Instala dependências (incluindo dev) para build e runtime com tsx loader
RUN pnpm install --frozen-lockfile

# ============================================
# Stage 2: Build
# ============================================
FROM deps AS builder

# Copia código-fonte necessário para build
COPY packages/ packages/
COPY apps/api/ apps/api/
COPY apps/bots/ apps/bots/
COPY ecosystem.config.cjs ecosystem.config.cjs

# Build de API e Bots (Turbo resolve dependências de workspace)
RUN pnpm build --filter=@nexo/api --filter=@nexo/bots

# ============================================
# Stage 3: Runner
# ============================================
FROM base AS runner

# Create a group and user
RUN addgroup -g 1001 -S appgroup && adduser -S -D -H -u 1001 -G appgroup appuser

WORKDIR /app

RUN npm install -g pm2@5.4.3

# Reusa node_modules completos do stage deps para garantir tsx em runtime
COPY --from=deps /app/node_modules/ node_modules/
COPY --from=deps /app/apps/api/node_modules/ apps/api/node_modules/
COPY --from=deps /app/apps/bots/node_modules/ apps/bots/node_modules/
COPY --from=deps /app/packages/api-core/node_modules/ packages/api-core/node_modules/
COPY --from=deps /app/packages/env/node_modules/ packages/env/node_modules/
COPY --from=deps /app/packages/otel/node_modules/ packages/otel/node_modules/
COPY --from=deps /app/packages/shared/node_modules/ packages/shared/node_modules/
COPY --from=deps /app/packages/auth/node_modules/ packages/auth/node_modules/

# Metadados de workspace necessários para resolução de pacotes pnpm
COPY --from=deps /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/package.json /app/turbo.json ./
COPY --from=deps /app/apps/api/package.json apps/api/
COPY --from=deps /app/apps/bots/package.json apps/bots/
COPY --from=deps /app/packages/api-core/package.json packages/api-core/
COPY --from=deps /app/packages/shared/package.json packages/shared/
COPY --from=deps /app/packages/env/package.json packages/env/
COPY --from=deps /app/packages/otel/package.json packages/otel/
COPY --from=deps /app/packages/typescript-config/package.json packages/typescript-config/

# Dist de pacotes compilados
COPY --from=builder /app/packages/shared/dist/ packages/shared/dist/
COPY --from=builder /app/packages/env/dist/ packages/env/dist/
COPY --from=builder /app/packages/otel/dist/ packages/otel/dist/

# Dist da API e Bots
COPY --from=builder /app/apps/api/dist/ apps/api/dist/
COPY --from=builder /app/apps/bots/dist/ apps/bots/dist/

# O pacote api-core ainda exporta de src; mantém fontes + tsconfig para runtime
COPY --from=builder /app/packages/api-core/src/ packages/api-core/src/
COPY --from=builder /app/packages/api-core/tsconfig.json packages/api-core/tsconfig.json
COPY --from=builder /app/packages/typescript-config/ packages/typescript-config/

# PM2 ecosystem
COPY --from=builder /app/ecosystem.config.cjs ecosystem.config.cjs

ENV NODE_ENV=production
ENV PM2_HOME=/app/.pm2

# Runtime atual precisa do tsx loader para resolver imports TS de @nexo/api-core.
# Usa caminho absoluto para funcionar tanto no master process do PM2 quanto nos workers.
ENV NODE_OPTIONS=--import=/app/apps/api/node_modules/tsx/dist/loader.mjs
ENV TSX_TSCONFIG_PATH=/app/packages/api-core/tsconfig.json

# Garante caminho explícito do modelo NLP em produção
ENV NEXO_MODEL_PATH=/app/packages/api-core/src/services/message-analysis/training/model/nexo-model.nlp

EXPOSE 3001
EXPOSE 3030

RUN chown -R appuser:appgroup /app

# Switch to the non-root user
USER appuser

CMD ["pm2-runtime", "ecosystem.config.cjs", "--only", "nexo-api,nexo-bots"]

