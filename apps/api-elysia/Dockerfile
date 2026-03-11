# ============================================
# Stage 1: Build (monorepo com Bun)
# ============================================
FROM oven/bun:1 AS builder

WORKDIR /app

# Copia configs do monorepo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY bun.lockb* ./

# Copia package.json de cada workspace necessário
COPY apps/api-elysia/package.json apps/api-elysia/
COPY packages/api-core/package.json packages/api-core/
COPY packages/shared/package.json packages/shared/
COPY packages/env/package.json packages/env/
COPY packages/otel/package.json packages/otel/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY packages/prettier-config/package.json packages/prettier-config/

# Copia patches do pnpm (ex: Platform.MACOS fix do Baileys)
COPY patches/ patches/

# Instala dependências via Bun (reconhece pnpm-workspace.yaml)
RUN bun install --frozen-lockfile

# Copia source code
COPY packages/ packages/
COPY apps/api-elysia/ apps/api-elysia/

# Treina modelo NLP (necessário em runtime, antes de compilar)
RUN cd apps/api-elysia && bun run train:nexo 2>/dev/null || true

# Compila binário standalone (single executable, sem node_modules em runtime)
RUN bun build \
  --compile \
  --minify \
  --sourcemap \
  --outfile apps/api-elysia/server \
  apps/api-elysia/src/index.ts

# ============================================
# Stage 2: Runner (imagem mínima)
# ============================================
FROM oven/bun:1-slim AS runner

# Cria usuário sem privilégios
RUN addgroup --gid 1001 appgroup && adduser --uid 1001 --ingroup appgroup --disabled-password --no-create-home appuser

WORKDIR /app

# Copia apenas o binário compilado
COPY --from=builder --chown=appuser:appgroup /app/apps/api-elysia/server ./server

# Copia assets de runtime que podem ser necessários (modelo NLP, auth files dir)
COPY --from=builder --chown=appuser:appgroup /app/apps/api-elysia/train/ ./train/ 2>/dev/null || true

USER appuser

EXPOSE 3001

CMD ["./server"]
