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

# Prune devDependencies — only production deps needed in runner
RUN pnpm prune --prod

# ============================================
# Stage 3: Runner (clean Alpine, no pnpm)
# ============================================
FROM node:22-alpine AS runner

RUN apk add --no-cache curl

RUN addgroup -g 1001 -S appgroup && adduser -S -D -H -u 1001 -G appgroup appuser

WORKDIR /app

COPY --from=builder /app/node_modules/ node_modules/
COPY --from=builder /app/apps/api/node_modules/ apps/api/node_modules/
COPY --from=builder /app/packages/env/node_modules/ packages/env/node_modules/
COPY --from=builder /app/packages/otel/node_modules/ packages/otel/node_modules/
COPY --from=builder /app/packages/shared/node_modules/ packages/shared/node_modules/

COPY --from=builder /app/apps/api/package.json apps/api/

COPY --from=builder /app/packages/shared/dist/ packages/shared/dist/
COPY --from=builder /app/packages/env/dist/ packages/env/dist/
COPY --from=builder /app/packages/otel/dist/ packages/otel/dist/

COPY --from=builder /app/apps/api/dist/ apps/api/dist/

# Copy YAML prompts (not compiled by tsup)
COPY --from=builder /app/apps/api/dist/config/prompts/ apps/api/dist/config/prompts/

ENV NODE_ENV=production
ENV NEXO_MODEL_PATH=/app/apps/api/dist/model/nexo-model.nlp

EXPOSE 3001

RUN chown -R appuser:appgroup /app
USER appuser

CMD ["node", "apps/api/dist/index.js"]