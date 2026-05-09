# Nexo Hermes Refactoring — Design Spec

## Meta

- **Status:** Aprovado
- **Data:** 2026-05-08
- **Branch:** `feat/nexo-0.7-hermes-engine-design`
- **Tags:** hermes-engine, refactoring, telegram, hono, core

---

## 1. Motivação

O commit `37af3c0` resetou a API do Nexo e introduziu o Hermes Engine v0.7 scaffold. O resultado foi:

- Hono com apenas 2 rotas (`/` e `/health`)
- Hermes Engine com 24 arquivos mas NENHUM importado ou usado fora do diretório `hermes/`
- Dashboard chamando 20+ endpoints que retornam 404
- Telegram referenciado em schemas/enums mas ZERO implementação
- `discord.js`, `@hono/swagger-ui`, `@scalar/hono-api-reference`, `@bull-board/hono` — dependências mortas

O usuário reportou: "tudo está dentro de uma pasta hermes (n tem sentido) e nada é efetivamente usado pela api hono".

## 2. Arquitetura Geral

### 2.1 Estrutura de Diretórios (pós-refatoração)

```
apps/api/src/
├── core/                        # Engine principal (ex-hermes/)
│   ├── index.ts
│   ├── contracts/               # IntakeEnvelope, ObservationEnvelope, HermesRuntimeError
│   ├── gateway/                 # IngestionGateway, OutgoingGateway, AttachmentIntake
│   ├── kernel/                  # HermesKernel (6-step bounded loop)
│   ├── model/                   # ModelTurnRunner (LLM interaction)
│   ├── memory/                  # SemanticWrapperPipeline, ProjectionStore, RelevanceDecay
│   ├── registries/              # SessionRegistry, MemoryRegistry, ToolRegistry (implementações reais)
│   ├── runtime/                 # createHermesRuntime(), HermesRuntime
│   ├── context/                 # ContextAssembler
│   ├── policies/                # ToolPolicy, FailureStrategy
│   ├── jobs/                    # SelfImprovementReview, ProactiveRefresh
│   ├── observability/           # TurnAudit
│   └── testing/                 # ShadowReplayRunner
├── routes/                      # Handlers Hono
│   ├── index.ts
│   ├── health.ts
│   ├── memories.ts
│   ├── preferences.ts
│   ├── accounts.ts
│   ├── conversations.ts
│   ├── whatsapp-settings.ts
│   ├── discord.ts
│   └── webhook/
│       ├── telegram.ts
│       └── whatsapp.ts
├── channels/                    # Adaptadores de canal
│   └── telegram/
│       ├── dispatcher.ts
│       ├── bot.ts
│       └── types.ts
├── config/
│   ├── env.ts
│   ├── feature-flag-definitions.ts  # ← remove hermes-engine-enabled
│   └── pivot-feature-flags.ts        # ← remove HERMES_ENGINE_ENABLED
├── db/
│   ├── index.ts
│   ├── schema/                  # (mantém 28 schemas)
│   └── seed/
├── types/
│   └── index.ts
├── utils/
│   ├── concurrency.ts
│   ├── logger.ts
│   ├── message-splitter.ts
│   └── retry.ts
├── index.ts                     # Bootstrap
├── server.ts                    # Hono app (expansão)
├── otel.ts
└── sentry.ts
```

### 2.2 Regras de Dependência

- `core/` → não importa nada de `routes/` ou `channels/`
- `channels/` → importa de `core/` (gateway, contracts)
- `routes/` → importa de `core/` e `channels/`
- `server.ts` → monta as rotas via `routes/index.ts`

### 2.3 Fluxo de Mensagem (Telegram)

```
Telegram Webhook
     │
     ▼
POST /webhook/telegram ──► routes/webhook/telegram.ts
     │
     ▼
channels/telegram/dispatcher.ts
  - grammy: verifica update, extrai texto/chatId
  - Converte para CanonicalMessageEnvelope
     │
     ▼
core/gateway/ingestion-gateway.ts (IngestionGateway.ingest)
  - toIntakeEnvelope() → IntakeEnvelope
  - resolveSessionKey() → "telegram:<chatId>"
     │
     ▼
core/runtime/hermes-runtime.ts (HermesRuntime.process)
  - context/context-assembler.ts → system prompt
  - kernel/hermes-kernel.ts (runTurn, 6-step loop)
  - model/model-turn-runner.ts → LLM (via MultiProviderService)
  - registries/tool-registry.ts → tool catalog
  - memory/memory-registry.ts → memory retrieval
     │
     ▼
core/gateway/outgoing-gateway.ts (OutgoingGateway.send)
  - dispatch() via channels/telegram/dispatcher.ts
     │
     ▼
Telegram API: sendMessage(chatId, text)
```

## 3. Core Engine (ex-hermes/)

### 3.1 Mudanças Estruturais

| Item | Antes (hermes/) | Depois (core/) |
|------|-----------------|----------------|
| Path | `src/hermes/` | `src/core/` |
| Imports | `@/hermes/...` | `@/core/...` |
| Feature flag | `nexo.pivot.hermes-engine-enabled: false` | **Removido** — runtime padrão |
| `createHermesRuntime()` | deps opcionais, `{} as Type` | Factory completa com todas as deps reais |

### 3.2 Implementações Stub → Real

1. **`model/model-turn-runner.ts`** (NOVO)
   - Implementa `ModelTurnRunner` interface
   - Chama `MultiProviderService` (já existente) com fallback entre provedores
   - Retorna `{ type: 'tool' | 'respond', toolName?, text?, input? }`

2. **`registries/session-registry.ts`** (NOVO — implementação real)
   - `resolveSessionKey(provider, externalId)` → string única
   - `getOrCreateSession(sessionKey)` → busca ou cria na tabela `agent_sessions`
   - Retorna sessionId + metadados

3. **`registries/memory-registry.ts`** (antes stub, agora real)
   - `PostgresMemoryRegistry.search(query, limit)` → consulta `memory_envelopes` via Drizzle
   - Ordena por `relevance_score DESC`
   - Aplica `applyRelevanceDecay()` pós-consulta

4. **`registries/tool-registry.ts`** (antes stub, agora real)
   - `PostgresToolRegistry.buildHermesToolCatalog()` → carrega de `global_tools` + `agent_skills`
   - Retorna array de `HermesToolDescriptor`

5. **`memory/semantic-wrapper-pipeline.ts`** (antes stub, agora real)
   - Recebe `IntakeEnvelope`, chama LLM via `MultiProviderService` para classificar
   - Extrai: confidence, importance, category, embedding
   - Salva via `PostgresProjectionStore`

### 3.3 Configuração

- `config/feature-flag-definitions.ts`:
  - Remove `nexo.pivot.hermes-engine-enabled` do array `pivotFlagDefinitions`
  - Remove `HERMES_ENGINE_ENABLED` do objeto `FLAG`
- `config/pivot-feature-flags.ts`:
  - Remove `HERMES_ENGINE_ENABLED` da interface `PivotFeatureFlags`
  - Remove da implementação `getPivotFeatureFlags()`

## 4. Routes (Hono)

### 4.1 Registro de Rotas

Cada módulo em `routes/` exporta uma função `register<Nome>Routes(app: Hono)`.

`routes/index.ts` faz:

```ts
import { Hono } from 'hono';
import { registerHealthRoutes } from './health';
import { registerMemoryRoutes } from './memories';
import { registerPreferencesRoutes } from './preferences';
import { registerAccountRoutes } from './accounts';
import { registerConversationRoutes } from './conversations';
import { registerWhatsAppSettingsRoutes } from './whatsapp-settings';
import { registerTelegramWebhook } from './webhook/telegram';
// ...etc

export function registerRoutes(app: Hono) {
  registerHealthRoutes(app);
  registerMemoryRoutes(app);
  registerPreferencesRoutes(app);
  registerAccountRoutes(app);
  registerConversationRoutes(app);
  registerWhatsAppSettingsRoutes(app);
  registerTelegramWebhook(app);
  // ...
}
```

### 4.2 Endpoints Completo

```
GET    /health
GET    /
GET    /memories                   → core/registries/memory-registry.search()
POST   /memories                   → core/registries/memory-registry.create()
PATCH  /memories/:id               → core/registries/memory-registry.update()
DELETE /memories/:id               → core/registries/memory-registry.delete()
GET    /user/preferences           → db/schema/user-preferences
PATCH  /user/preferences           → db/schema/user-preferences
GET    /user/accounts              → db/schema/integrations + auth
POST   /user/accounts/sync         → db/schema/integrations + auth
POST   /user/link/telegram         → gera linking token
GET    /user/link/discord          → redirect OAuth
POST   /user/link/discord-bot      → gera token bot
GET    /user/link/google           → redirect OAuth
POST   /user/link/consume          → valida linking token
DELETE /user/accounts/:provider    → remove integração
GET    /admin/conversations        → db/schema/conversations
GET    /admin/conversations/:id/messages → db/schema/messages
GET    /admin/whatsapp-settings    → db/schema/whatsapp-settings
POST   /admin/whatsapp-settings/cache/clear → invalida cache
GET    /admin/whatsapp-settings/qr-code → status Evolution API
POST   /admin/whatsapp-settings/evolution/connect → conecta Evolution
POST   /admin/whatsapp-settings/evolution/disconnect → desconecta
POST   /admin/whatsapp-settings/evolution/restart → reinicia
GET    /user/discord-bot-info      → info bot
GET    /user/discord-bot/status    → status vinculação
POST   /webhook/telegram           → channels/telegram/dispatcher → core
POST   /webhook/whatsapp/evolution → channels/whatsapp/dispatcher → core

**Nota:** As rotas de WhatsApp Settings e webhook WhatsApp serão restauradas do histórico do git (existiam antes do commit `37af3c0`). O foco principal desta refatoração é Telegram; WhatsApp mantém compatibilidade.

## 5. Channels — Telegram

### 5.1 Stack

- **Biblioteca:** `grammy` (TypeScript-first, webhook nativo, tipagem forte)
- **Modo:** Webhook (Hono serve o endpoint, Grammy processa o update)
- **Dependências:** Adicionar `grammy` ao `package.json`

### 5.2 Arquivos

**`channels/telegram/bot.ts`**
- Cria instância do `Bot` com token do env `BOT_TOKEN_TELEGRAM`
- Exporta função `getBot(): Bot`
- Configura webhook URL via `bot.api.setWebhook(url)` (chamado no setup)

**`channels/telegram/dispatcher.ts`**
- `telegramUpdateToEnvelope(update: Update): CanonicalMessageEnvelope`
- Extrai: chatId, messageId, text, timestamp, messageType
- Monta `CanonicalMessageEnvelope` no formato que `IngestionGateway.ingest()` espera
- `sendTelegramMessage(chatId: number, text: string): Promise<void>` — wrapper `bot.api.sendMessage()`

**`channels/telegram/types.ts`**
- Tipos auxiliares específicos do Telegram (não polui core/)

### 5.3 Fluxo

```
POST /webhook/telegram
  → routes/webhook/telegram.ts
    → getBot().handleUpdate(body)  // Grammy parseia
    → dispatcher.telegramUpdateToEnvelope(update)
    → ingestionGateway.ingest(envelope)
    → hermesRuntime.process(result)
    → outgoingGateway.send(result)
    → dispatcher.sendTelegramMessage(chatId, text)
```

## 6. Dev Mode e Documentação

### 6.1 `.env.example` Atualizado

```env
# Obrigatórias
DATABASE_URL=postgres://user:pass@localhost:5432/nexo
BOT_TOKEN_TELEGRAM=123456:ABC-DEF...

# Core
NODE_ENV=development
PORT=3001
LOG_LEVEL=debug
CORS_ORIGINS=http://localhost:5173

# AI Providers (pelo menos um)
OPENAI_API_KEY=sk-...
# DEEPSEEK_API_KEY=...
# CLOUDFLARE_API_TOKEN=...
# CLOUDFLARE_ACCOUNT_ID=...

# Serviços (opcional)
SENTRY_DSN=
SENTRY_ENABLED=false
OTEL_EXPORTER_OTLP_ENDPOINT=

# Dashboard
NUXT_PUBLIC_API_URL=http://localhost:3001
NUXT_PUBLIC_AUTH_BASE_URL=http://localhost:3001
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3001
```

### 6.2 Comandos

```bash
# Setup
pnpm install
cp .env.example .env   # editar com seus valores

# Dev API
pnpm dev:api            # tsx watch src/index.ts na porta 3001

# Dev Dashboard
pnpm dev:dash           # Nuxt dev server

# Dev tudo
pnpm dev                # turbo: api + dashboard + landing

# Telegram webhook (túnel)
ngrok http 3001
# configurar webhook: curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<ngrok>/webhook/telegram"

# Testes
pnpm test               # vitest
pnpm test:watch         # vitest --watch

# DB
pnpm db:generate        # drizzle-kit generate
pnpm db:push            # drizzle-kit push
pnpm db:studio          # drizzle-kit studio
```

### 6.3 README.md

Criar `apps/api/README.md` com:
- Pré-requisitos (Node 20+, pnpm 9+, PostgreSQL, ngrok opcional)
- Setup passo-a-passo
- Arquitetura (core/routes/channels)
- Como testar o Telegram com ngrok
- Comandos disponíveis

## 7. Cleanup de Dependências

### Remover do `package.json`:

| Dependência | Arquivo |
|-------------|---------|
| `discord.js` | apps/api |
| `@hono/swagger-ui` | apps/api |
| `@scalar/hono-api-reference` | apps/api |
| `@bull-board/hono` | apps/api |
| `@bull-board/api` | apps/api |
| `@bull-board/ui` | apps/api |

### Adicionar ao `package.json`:

| Dependência | Arquivo |
|-------------|---------|
| `grammy` | apps/api |

## 8. Ordem de Implementação

1. **Estrutura:** Renomear `hermes/` → `core/`, atualizar todos os imports, criar diretórios `routes/` e `channels/`
2. **Feature flag:** Remover `hermes-engine-enabled` das definições
3. **Core stubs reais:** Implementar `model-turn-runner`, `session-registry`, `memory-registry` real, `tool-registry` real, `semantic-wrapper-pipeline` real
4. **Rotas Hono:** Adicionar todos os endpoints do dashboard
5. **Telegram:** Adicionar `grammy`, criar dispatcher, registrar webhook route
6. **Cleanup:** Remover deps mortas, atualizar `.env.example`, remover `discord.js`
7. **Documentação:** `apps/api/README.md` com setup e dev mode
8. **Validação:** Testar health, memórias CRUD, Telegram webhook
