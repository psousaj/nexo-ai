# Build stage
FROM oven/bun AS build

WORKDIR /app

# Cache packages installation
COPY package.json bun.lockb* ./

RUN bun install --frozen-lockfile

# Copy source code
COPY ./src ./src
COPY ./drizzle.config.ts ./drizzle.config.ts
COPY ./tsconfig.json ./tsconfig.json

ENV NODE_ENV=production

# Compile to binary (não usa --minify completo por causa do OpenTelemetry)
# --minify-whitespace e --minify-syntax preservam nomes de funções
RUN bun build \
    --compile \
    --minify-whitespace \
    --minify-syntax \
    --target bun-linux-x64 \
    --outfile server \
    src/index.ts

# Production stage (Distroless - sem shell, menor superfície de ataque)
FROM gcr.io/distroless/base

WORKDIR /app

# Copy binary from build stage
COPY --from=build /app/server server

ENV NODE_ENV=production

# Railway atribui porta aleatória via PORT env var
# Elysia já lê process.env.PORT automaticamente no index.ts

# Distroless não tem shell, então não suporta HEALTHCHECK com CMD
# Railway faz health checks via HTTP automaticamente

# Expose port (Railway ignora isso e usa PORT env)
EXPOSE 3000

CMD ["./server"]
