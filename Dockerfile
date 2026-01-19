# Build stage
FROM oven/bun AS build

WORKDIR /app

# Cache packages installation
COPY package.json pnpm-lock.yaml* ./

RUN bun install

# Copy source code
COPY . .

ENV NODE_ENV=production

# Compile to binary
# --minify-whitespace e --minify-syntax preservam nomes de funções para OpenTelemetry se necessário
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
# Hono ja lê process.env.PORT no index.ts via @hono/node-server ou env config

# Expose port
EXPOSE 3000

CMD ["./server"]
