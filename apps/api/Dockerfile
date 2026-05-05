# ============================================
# Base
# ============================================
FROM node:22-alpine AS base

RUN npm install -g pnpm@9.15.4

WORKDIR /app

# ============================================
# Stage 1: Dependencies
# ============================================
FROM base AS deps

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/env/package.json packages/env/
COPY packages/otel/package.json packages/otel/
COPY packages/typescript-config/package.json packages/typescript-config/

RUN pnpm install --frozen-lockfile

# ============================================
# Stage 2: Build
# ============================================
FROM deps AS builder

COPY packages/ packages/
COPY apps/api/ apps/api/

RUN pnpm build --filter=@nexo/api
RUN pnpm deploy --filter=@nexo/api --prod /deploy

# ============================================
# Stage 3: Runner (minimal)
# ============================================
FROM node:22-alpine AS runner

RUN addgroup -g 1001 -S appgroup && adduser -S -D -H -u 1001 -G appgroup appuser

WORKDIR /app

COPY --chown=appuser:appgroup --from=builder /deploy .

ENV NODE_ENV=production
ENV NEXO_MODEL_PATH=/app/dist/model/nexo-model.nlp

EXPOSE 3001

USER appuser

CMD ["node", "dist/index.js"]
