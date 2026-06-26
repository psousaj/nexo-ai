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
# Stage 3: faster-whisper Python environment
# ============================================
FROM python:3.11-slim AS faster-whisper-env

# System deps: ffmpeg para codecs de áudio, libsndfile pra soundfile, libgomp pra OpenMP
RUN apt-get update && apt-get install -y ffmpeg libsndfile1 libgomp1 && \
	rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir faster-whisper

# Pré-download do modelo base pra não pagar no primeiro áudio
RUN python3 -c "\
from faster_whisper import WhisperModel; \
WhisperModel('base', device='cpu', compute_type='int8')"

# ============================================
# Stage 4: Runner (Debian bookworm — glibc necessário pro faster-whisper)
# ============================================
FROM node:22-bookworm-slim AS runner

RUN apt-get update && apt-get install -y \
	curl ca-certificates \
	ffmpeg libsndfile1 libgomp1 \
	python3 python3-pip python3-venv \
	&& rm -rf /var/lib/apt/lists/*

# Cria venv e instala faster-whisper (mesmo Python 3.11 do builder)
ENV XDG_CACHE_HOME=/tmp/hf-cache
RUN mkdir -p /tmp/hf-cache && \
	python3 -m venv /opt/whisper-venv && \
	/opt/whisper-venv/bin/pip install --no-cache-dir faster-whisper && \
	# Pré-download do modelo no venv também
	/opt/whisper-venv/bin/python3 -c "\
from faster_whisper import WhisperModel; \
WhisperModel('base', device='cpu', compute_type='int8')"

# Coloca venv no PATH pra 'python3' resolver pro venv com faster-whisper
ENV PATH="/opt/whisper-venv/bin:$PATH"

RUN groupadd -g 1001 appgroup && \
	useradd -M -u 1001 -g appgroup -s /bin/false appuser && \
	chown -R appuser:appgroup /tmp/hf-cache

WORKDIR /app

COPY --chown=appuser:appgroup --from=builder /deploy .

# Script de transcrição faster-whisper
COPY --chown=appuser:appgroup apps/api/scripts/faster-transcribe.py /app/scripts/faster-transcribe.py

ENV NODE_ENV=production
ENV NEXO_MODEL_PATH=/app/dist/model/nexo-model.nlp
ENV LOCAL_WHISPER_BINARY=/app/scripts/faster-transcribe.py
ENV LOCAL_WHISPER_MODEL=base

EXPOSE 3001

USER appuser

CMD ["node", "dist/index.js"]
