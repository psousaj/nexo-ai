# Nexo API — Hermes Engine

API do Nexo AI com Hermes Engine. Servidor Hono + multi-provider AI + Telegram.

## Stack
- **Runtime:** Node.js 20+, TypeScript
- **HTTP:** Hono + @hono/node-server
- **ORM:** Drizzle ORM + PostgreSQL
- **AI:** Transport layer (OpenAI, DeepSeek, OpenRouter) + CredentialPool
- **Telegram:** grammy
- **Observabilidade:** Sentry + OpenTelemetry

## Dev Mode

### Pré-requisitos
- Node.js 20+, pnpm 9+, PostgreSQL, (opcional) ngrok

### Setup
```bash
pnpm install
cp .env.example .env
# Editar: DATABASE_URL, BOT_TOKEN_TELEGRAM, OPENAI_API_KEY
pnpm db:push
pnpm dev:api
# → http://localhost:3001/health
```

### Telegram Webhook
```bash
ngrok http 3001
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<ngrok>/webhook/telegram"
```

### Comandos
| Comando | Descrição |
|---------|-----------|
| `pnpm dev:api` | API dev mode (watch) |
| `pnpm dev:dash` | Dashboard dev mode |
| `pnpm dev` | Tudo (API + Dashboard + Landing) |
| `pnpm test` | Rodar testes |
| `pnpm db:push` | Aplicar migrations |
| `pnpm build` | Build produção (tsup) |

## Arquitetura

```
src/
├── core/                # Hermes Engine
│   ├── kernel/          # Loop principal (6-step bounded loop)
│   ├── model/           # Transports + CredentialPool
│   │   └── transports/  # ProviderTransport, ChatCompletions
│   ├── gateway/         # Entrada/saída de mensagens
│   ├── memory/          # Gerenciamento de memória
│   ├── registries/      # Session, Memory, Tool
│   ├── runtime/         # Factory do runtime
│   ├── context/         # System prompt builder
│   └── policies/        # Políticas de tools
├── routes/              # Handlers Hono
│   └── webhook/         # Telegram, WhatsApp
├── channels/            # Adaptadores de canal
│   └── telegram/        # grammy bot
├── config/              # Env + feature flags
├── db/                  # Drizzle client + schemas
└── utils/               # Logger, retry
```

### Fluxo (Telegram)
```
Telegram → POST /webhook/telegram
  → dispatcher.ts → CanonicalMessageEnvelope
  → IngestionGateway → IntakeEnvelope
  → HermesKernel.runTurn()
  → ModelTurnRunner (CredentialPool.resolve → getTransport → OpenAI SDK)
  → OutgoingGateway → sendTelegramMessage()
```

## Endpoints Principais
- `GET /health` → Health check
- `GET/POST /memories` → CRUD memórias
- `GET/PATCH /user/preferences` → Preferências
- `POST /user/link/telegram` → Link Telegram
- `GET /admin/conversations` → Conversas (admin)
- `POST /webhook/telegram` → Webhook Telegram
