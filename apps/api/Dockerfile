# ============================================
# Stage 1: Build
# ============================================
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copia configs do monorepo (pnpm workspace, lockfile, turbo)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./

# Copia package.json de cada workspace necessário
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/env/package.json packages/env/
COPY packages/otel/package.json packages/otel/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY packages/prettier-config/package.json packages/prettier-config/

# Instala dependências (todas, incluindo dev para build)
RUN pnpm install --frozen-lockfile

# Garante que tsup está acessível para packages internos
RUN npm install -g tsup

# Copia source code dos packages e da API
COPY packages/ packages/
COPY apps/api/ apps/api/

# Build packages primeiro (shared, env, auth), depois API
RUN pnpm build --filter=@nexo/api

# Treina modelo NLP (necessário em runtime)
RUN cd apps/api && pnpm train:nexo

# ============================================
# Stage 2: Production
# ============================================
FROM node:20-alpine AS production

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copia configs do monorepo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Copia package.json de cada workspace
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/env/package.json packages/env/
COPY packages/otel/package.json packages/otel/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY packages/prettier-config/package.json packages/prettier-config/

# Instala apenas dependências de produção
RUN pnpm install --frozen-lockfile --prod

# Copia builds dos packages (dist/ de cada um)
COPY --from=builder /app/packages/shared/dist/ packages/shared/dist/
COPY --from=builder /app/packages/env/dist/ packages/env/dist/
COPY --from=builder /app/packages/otel/dist/ packages/otel/dist/

# Copia build da API + modelo treinado
COPY --from=builder /app/apps/api/dist/ apps/api/dist/
COPY --from=builder /app/apps/api/package.json apps/api/package.json
COPY --from=builder /app/apps/api/src/services/message-analysis/training/model/ apps/api/src/services/message-analysis/training/model/

ENV NODE_ENV=production
EXPOSE 3001

# Diretório para persistir credenciais do Baileys (montado como volume no Railway)
RUN mkdir -p /data/baileys-auth

CMD ["node", "apps/api/dist/index.js"]

