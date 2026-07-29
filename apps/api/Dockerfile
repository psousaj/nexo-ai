# ============================================
# Base
# ============================================
FROM node:22-alpine AS base

RUN npm install -g pnpm@9.15.4

WORKDIR /app

# ============================================
# Whisper Builder — compila whisper.cpp pra Alpine
# ============================================
FROM alpine:3.19 AS whisper-builder

RUN apk add --no-cache git g++ make cmake

WORKDIR /whisper
RUN git clone --depth 1 --branch v1.9.1 https://github.com/ggerganov/whisper.cpp.git . \
	&& cmake -B build -DBUILD_SHARED_LIBS=OFF \
	&& cmake --build build -j$(nproc) \
	&& cp build/bin/whisper-cli /usr/local/bin/whisper-cpp

# ============================================
# Model Downloader — baixa modelo base do whisper
# ============================================
FROM alpine:3.19 AS model-downloader

RUN apk add --no-cache curl

RUN mkdir -p /models && curl -sLf --retry 3 -o /models/ggml-base.bin \
	https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin

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

RUN apk add --no-cache curl ca-certificates ffmpeg libgomp && \
	addgroup -g 1001 -S appgroup && adduser -S -D -H -u 1001 -G appgroup appuser

WORKDIR /app

COPY --chown=appuser:appgroup --from=builder /deploy .

# Whisper binary e modelo
COPY --from=whisper-builder /usr/local/bin/whisper-cpp /usr/local/bin/whisper-cpp
COPY --chown=appuser:appgroup --from=model-downloader /models/ggml-base.bin /app/models/ggml-base.bin

ENV NODE_ENV=production
ENV NEXO_MODEL_PATH=/app/dist/model/nexo-model.nlp
ENV LOCAL_WHISPER_BINARY=/usr/local/bin/whisper-cpp
ENV LOCAL_WHISPER_MODEL_PATH=/app/models/ggml-base.bin

EXPOSE 3001

USER appuser

CMD ["node", "dist/index.js"]
