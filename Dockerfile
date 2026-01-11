# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar package files
COPY package.json pnpm-lock.yaml ./

# Instalar pnpm e dependências
RUN npm install -g pnpm && \
    pnpm install --frozen-lockfile

# Copiar código fonte
COPY . .

# Build TypeScript
RUN pnpm build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copiar package files
COPY package.json pnpm-lock.yaml ./

# Instalar apenas dependências de produção
RUN npm install -g pnpm && \
    pnpm install --prod --frozen-lockfile

# Copiar build do stage anterior (tsup resolveu os path aliases)
COPY --from=builder /app/dist ./dist

# Copiar configuração do New Relic
COPY newrelic.cjs ./

# Variáveis de ambiente padrão
ENV NODE_ENV=production
ENV NEW_RELIC_NO_CONFIG_FILE=false
ENV NEW_RELIC_DISTRIBUTED_TRACING_ENABLED=true
ENV NEW_RELIC_LOG=stdout

# ARGs para passar variáveis no build (Railway injeta automaticamente)
ARG DATABASE_URL
ARG TELEGRAM_BOT_TOKEN
ARG CLOUDFLARE_ACCOUNT_ID
ARG CLOUDFLARE_API_TOKEN
ARG GOOGLE_API_KEY
ARG TMDB_API_KEY
ARG YOUTUBE_API_KEY
ARG NEW_RELIC_LICENSE_KEY
ARG NEW_RELIC_APP_NAME
ARG APP_URL
ARG PORT

# Converter ARGs em ENVs
ENV DATABASE_URL=$DATABASE_URL
ENV TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN
ENV CLOUDFLARE_ACCOUNT_ID=$CLOUDFLARE_ACCOUNT_ID
ENV CLOUDFLARE_API_TOKEN=$CLOUDFLARE_API_TOKEN
ENV GOOGLE_API_KEY=$GOOGLE_API_KEY
ENV TMDB_API_KEY=$TMDB_API_KEY
ENV YOUTUBE_API_KEY=$YOUTUBE_API_KEY
ENV NEW_RELIC_LICENSE_KEY=$NEW_RELIC_LICENSE_KEY
ENV NEW_RELIC_APP_NAME=$NEW_RELIC_APP_NAME
ENV APP_URL=$APP_URL
ENV PORT=$PORT


# Expor porta
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Rodar aplicação
CMD ["node", "dist/index.js"]
