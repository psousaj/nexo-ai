# AGENTS.md — Nexo AI Agent Onboarding Guide

> Lê este arquivo antes de escrever qualquer código.
> Monorepo v0.5.48 — atualizado: 2026-03-11

---

## 1. ARQUITETURA

**Nexo AI** é um assistente pessoal via Telegram / WhatsApp (Baileys + Meta Cloud API) / Discord que salva, organiza e busca conteúdo (filmes, séries, vídeos, links, notas, livros, músicas, imagens).

### Princípio Fundador — ADR-011: Deterministic Runtime Control

```
CÓDIGO controla:               LLM controla:
✓ Estado da conversação        ✓ Análise da mensagem
✓ Fluxo de execução            ✓ Escolha da tool (lista fixa)
✓ Chamada de tools             ✓ Redação de respostas
✓ Transições de estado         ✗ Nada mais
✓ Orquestração
```

### Fluxo End-to-End

```
Webhook → responde 200 OK imediatamente
    ↓
Bull messageQueue (job)
    ↓
messageProcessor worker
    ├─ IntentClassifier (Neural NLP.js ≥85%) → ação determinística
    └─ LLM fallback → AgentOrchestrator → parseAgentDecisionV2FromLLM()
         ↓
    ToolExecutor → validação → dedup → persistência → enrichmentQueue (async)
         ↓
    responseQueue → envia ao usuário
```

### Monorepo

```
nexo-ai/
├── apps/
│   ├── api/            # Hono + Drizzle + PostgreSQL (porta 3002)
│   ├── dashboard/      # Nuxt 4 + Vue 3 (porta 5173)
│   ├── intake-worker/  # Microserviço multimodal (áudio, imagem)
│   └── landing/        # Vite (porta 3005)
├── packages/
│   ├── env/            # @nexo/env — Zod env validation
│   ├── shared/         # @nexo/shared — tipos compartilhados
│   ├── otel/           # @nexo/otel — OpenTelemetry + Langfuse
│   └── auth/           # @nexo/auth — Better Auth client
└── docs/adr/           # 21 Architecture Decision Records
```

---

## 2. STACK

| Categoria | Tecnologia | Versão |
|-----------|-----------|--------|
| Runtime | Node.js + tsx | ^4.21.0 |
| Package Manager | pnpm + Turbo | 9.15.4 / ^2.5.4 |
| API Framework | Hono + @hono/node-server | ^4.11.5 |
| Database | PostgreSQL (Supabase) + Drizzle ORM | ^0.45.1 |
| Frontend | Nuxt 4 + Vue 3 + @nuxt/ui | ^4.3.0 |
| AI Gateway | Cloudflare AI Gateway | — |
| LLM | Google Gemini (primário) + Cloudflare Workers AI (fallback) | — |
| Embeddings | BGE Small 384-dim via Cloudflare | OpenAI compat. |
| Messaging | Telegram Bot API / Baileys WS / Meta Cloud API / Discord.js | — |
| Auth | Better Auth + Redis session | ^1.4.17 |
| Queue | Bull + ioredis | ^4.16.5 |
| Vector Search | pgvector HNSW cosine 384-dim | built-in PG |
| NLP | node-nlp 5.0.0-alpha.5 | local trained |
| Observability | OTEL + Jaeger 2.16.0 + Prometheus + Langfuse + Sentry | — |
| Testing | Vitest | ^2.1.9 |
| Build | tsup | — |
| Deploy API | Railway (Docker) | — |
| Deploy Dashboard | Vercel | — |

---

## 3. COMANDOS

```bash
# Monorepo
pnpm dev             # todos os apps via Turbo
pnpm dev:api         # API apenas
pnpm dev:dash        # Dashboard apenas
pnpm build           # build all
pnpm lint && pnpm typecheck && pnpm test

# Banco de dados
pnpm db:generate     # gera migrations Drizzle
pnpm db:push         # aplica ao banco
pnpm db:studio       # UI → http://localhost:4983

# API (apps/api/)
pnpm run train:nexo  # re-treina modelo NLP.js
pnpm run set-admin   # marca user como admin
pnpm test -- src/tests/intent-classifier.test.ts  # arquivo específico
pnpm test:watch      # modo watch

# ⚠️ Verificar antes de reiniciar
lsof -ti:3002 > /dev/null 2>&1 && echo "API já rodando" || pnpm dev:api
```

**Portas:** API `3002` | Dashboard `5173` | Landing `3005` | Drizzle Studio `4983` | Jaeger UI `16686` | Prometheus `9090`

---

## 4. VARIÁVEIS DE AMBIENTE

> Fonte canônica: `packages/env/src/index.ts`. Após alterar, rebuild: `cd packages/env && npx tsup`.

### Obrigatórias

| Var | Descrição |
|-----|-----------|
| `DATABASE_URL` | PostgreSQL connection string |
| `TELEGRAM_BOT_TOKEN` | Token do bot |
| `TELEGRAM_WEBHOOK_SECRET` | Secret do webhook |
| `TMDB_API_KEY` | TMDB API key |
| `YOUTUBE_API_KEY` | YouTube Data API key |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID |
| `CLOUDFLARE_API_TOKEN` | API token |
| `REDIS_HOST` / `REDIS_USER` / `REDIS_PASSWORD` | Redis (Bull) |
| `BETTER_AUTH_SECRET` | Min 32 chars |
| `APP_URL` / `DASHBOARD_URL` | URLs públicas |

### Opcionais Relevantes

| Var | Default | Descrição |
|-----|---------|-----------|
| `SPOTIFY_CLIENT_ID/SECRET` | — | Para save_music |
| `BRAVE_SEARCH_API_KEY` | — | Para web_search |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4317` | Jaeger gRPC |
| `LANGFUSE_PUBLIC_KEY/SECRET_KEY` | — | AI tracing |
| `LANGFUSE_BASE_URL` | `https://cloud.langfuse.com` | URL do Langfuse |
| `SENTRY_DSN` | — | Error tracking |
| `PORT` | `3002` | Porta da API |
| `LOG_LEVEL` | `info` | Pino log level |
| `CORS_ORIGINS` | — | CSV de origens permitidas |
| `JAEGER_UI_URL` | — | Logado no boot se configurado |

### Feature Flags

| Var | Default | Descrição |
|-----|---------|-----------|
| `CONVERSATION_FREE` | `true` | Fluxo conversacional livre |
| `TOOL_SCHEMA_V2` | `false` | AgentDecisionV2 schema |
| `MULTIMODAL_AUDIO` | `false` | Áudio via intake-worker |
| `MULTIMODAL_IMAGE` | `false` | Imagem via intake-worker |

---

## 5. ESTRUTURA DE ARQUIVOS CHAVE

```
apps/api/src/
├── adapters/messaging/         # telegram, baileys, whatsapp, discord adapters
│   ├── telegram-adapter.ts     # Bot API + inline keyboards
│   ├── baileys-adapter.ts      # WebSocket WA (Baileys)
│   ├── whatsapp-adapter.ts     # Meta Cloud API
│   └── discord-adapter.ts      # Discord.js
├── config/
│   ├── env.ts                  # Re-exporta @nexo/env
│   └── prompts.ts              # ⭐ TODOS os prompts centralizados (2000+ linhas)
├── db/
│   └── schema/                 # 21 tabelas Drizzle (index.ts exporta tudo)
├── services/
│   ├── agent-orchestrator.ts   # ⭐ Orquestrador principal
│   ├── intent-classifier.ts    # ⭐ Neural NLP.js + LLM fallback
│   ├── conversation-service.ts # ⭐ State machine
│   ├── item-service.ts         # CRUD + dedup + embeddings
│   ├── queue-service.ts        # 4 filas Bull + cron jobs
│   ├── memory-search.ts        # Hybrid search (70% vector + 30% FTS)
│   ├── langfuse.ts             # Langfuse SDK (complementar ao OTEL)
│   ├── ai/
│   │   ├── ai-service.ts       # Gemini + Cloudflare WA fallback
│   │   ├── embedding-service.ts # BGE Small 384-dim
│   │   └── tool-executor.ts    # Executa tools validadas
│   ├── enrichment/
│   │   ├── tmdb-service.ts     # Filmes e séries
│   │   ├── youtube-service.ts  # Vídeos
│   │   ├── opengraph-service.ts # Links/URLs
│   │   ├── books-service.ts    # Google Books
│   │   └── spotify-service.ts  # Músicas
│   └── tools/index.ts          # ⭐ 20+ tools implementadas
├── types/index.ts              # AgentDecisionV2, ConversationState, etc
├── otel.ts                     # Bootstrap OTEL (importado primeiro em index.ts)
└── utils/
    ├── json-parser.ts          # parseAgentDecisionV2FromLLM
    └── logger.ts               # Pino loggers por categoria
```

---

## 6. DATABASE (21 Tabelas)

| Tabela | Descrição |
|--------|-----------|
| `users` | Usuários. Campos OpenClaw: `assistantName`, `assistantEmoji`, `assistantTone`. Status: `trial/pending_signup/active` |
| `user_channels` | Vínculo `(channel, channelUserId) → userId`. UNIQUE(channel, channelUserId) |
| `conversations` | State machine + `context JSONB`. `closeAt`, `closeJobId`, `isActive` |
| `messages` | Histórico. `metadata JSONB` com `_trace: OrchestratorTrace` |
| `memory_items` | `type`, `metadata JSONB`, `embedding vector(384)`, `contentHash SHA-256`. HNSW index |
| `semantic_external_items` | Cache global TMDB/YouTube. UNIQUE `(type, externalId)` |
| `global_tools` | Feature flags por tool. UNIQUE `toolName` |
| `agent_memory_profiles` | SOUL/IDENTITY/USER/TOOLS/MEMORY content (OpenClaw ADR-017) |
| `auth_providers` / `sessions` / `accounts` | Better Auth tables |

**ItemType:** `movie` | `tv_show` | `video` | `link` | `note` | `memo` | `book` | `music` | `image`

**Padrão de dedup:** `contentHash = SHA-256(userId + type + title/url + externalId)` como UNIQUE constraint.

---

## 7. SERVIÇOS, FILAS E TOOLS

### Bull Queues (4 filas)

| Fila | Job | Retry |
|------|-----|-------|
| `messageQueue` | Processa mensagens recebidas | 3x exp. backoff |
| `responseQueue` | Envia respostas ao usuário | auto |
| `enrichmentQueue` | Enriquecimento async em batch (TMDB, YouTube, etc) | auto |
| `closeConversationQueue` | Fecha conversas inativas | — |

**Cron:** `* * * * *` — fecha conversas idle 15min | `*/5 * * * *` — timeout `awaiting_confirmation`

**Bull Board:** `http://localhost:3002/admin/queues` — monitoramento das filas em tempo real.

### Tools (20+)

**Save:** `save_note`, `save_memo`, `save_movie`, `save_tv_show`, `save_video`, `save_link`, `save_book`, `save_music`, `save_image`

**Search:** `search_items`, `memory_search`, `memory_get`

**Enriquecimento:** `enrich_movie`, `enrich_tv_show`, `enrich_video`

**Delete:** `delete_memory`, `delete_all_memories`

**Sistema:** `get_assistant_name`, `update_user_settings`, `collect_context`, `resolve_context_reference`

**Web:** `web_search` (Brave), `analyze_url`

### CASL Tools Gate

LLM só recebe a **lista de tools ativas** para aquele usuário (filtrado via `global_tools` + CASL). Tools desativadas na tabela `global_tools` não aparecem no prompt.

---

## 8. TIPOS PRINCIPAIS

```typescript
// LLM DEVE retornar este schema (OBRIGATÓRIO)
interface AgentLLMResponse {
  schema_version: '1.0' | '2.0';
  action: 'CALL_TOOL' | 'RESPOND' | 'NOOP';
  tool?: ToolName | null;
  args?: Record<string, any> | null;
  message?: string | null; // max 700 chars, required se action=RESPOND
}

// Parse sempre com esta função — trata markdown fences, trailing text, JSON com comentários
import { parseAgentDecisionV2FromLLM } from '@/utils/json-parser';
const decision = parseAgentDecisionV2FromLLM(llmOutput);
```

```typescript
// Conversation State Machine (11 estados)
type ConversationState =
  | 'idle'                      // pronto para novos comandos
  | 'processing'                // ação em andamento
  | 'awaiting_context'          // aguardando clarificação do usuário
  | 'off_topic_chat'            // fora do escopo (chat paralelo)
  | 'awaiting_confirmation'     // aguardando seleção de botão
  | 'awaiting_final_confirmation' // confirmação final com imagem
  | 'enriching'                 // buscando metadados externos
  | 'saving'                    // persistindo no banco
  | 'error'                     // estado de erro
  | 'waiting_close'             // timer de 15min rodando
  | 'closed';                   // conversa fechada, contexto limpo
```

```typescript
// OpenClaw Session Key — identifica inequivocamente usuário + canal + peer
// formato: agent:<agentId>:<channel>:<peerKind>:<peerId>
// exemplo: "agent:main:telegram:direct:+5511999999999"

// OrchestratorTrace (persistido em messages.metadata._trace)
interface OrchestratorTrace {
  intent: string;
  confidence: number;
  action: string;
  tools_used?: string[];
  durations?: { intent_ms: number; llm_ms?: number; action_ms: number; total_ms: number };
}
```

---

## 9. OBSERVABILIDADE

### Stack

```
API → OTLP gRPC :4317 → Jaeger 2.16.0
    ├─ traces → BadgerDB (TTL 72h)
    ├─ SpanMetrics Connector → :8889 → Prometheus :9090
    └─ Monitor/SPM UI → :16686
Langfuse (cloud) → spans com gen_ai.* attrs (chamadas LLM)
Sentry → erros de runtime não tratados
```

### Atributos para Langfuse (OTEL)

Para que apareçam input/output no Langfuse, os spans de AI devem ter:

| Campo Langfuse | Atributo OTEL usado |
|----------------|---------------------|
| `input` | `langfuse.trace.input` ou `input.value` ou `gen_ai.prompt` |
| `output` | `langfuse.trace.output` ou `output.value` ou `gen_ai.completion` |

O span raiz do orquestrador (`agent.orchestrator.process`) define `langfuse.trace.input` com a mensagem do usuário e `langfuse.trace.output` com a resposta gerada.

### Logger Categories (Pino)

```typescript
import { loggers } from '@/utils/logger';

loggers.app       // uso geral
loggers.ai        // orquestrador, LLM
loggers.webhook   // adapters de mensageria
loggers.enrichment // TMDB, YouTube, etc
loggers.tools     // execução de tools
loggers.queue     // Bull jobs e cron
```

**Nunca usar `console.log`.** Sempre um dos `loggers.*`.

### Docker local

```bash
docker compose up -d  # sobe Jaeger 2.16.0 + Prometheus
```

Configuração em `docker/jaeger/config.yaml` (OTel Collector format) e `docker/prometheus/prometheus.yml`.

---

## 10. PADRÕES CRÍTICOS

### 1. LLM nunca gerencia estado (ADR-011)

```typescript
// ✅ Correto — código executa ações determinísticas
if (intent.action === 'delete_all') return handleDeleteAll();

// ✅ Correto — LLM apenas planeja, código executa
const decision = parseAgentDecisionV2FromLLM(await llmService.call(...));
await toolExecutor.execute(decision.tool, decision.args);

// ❌ Errado — nunca deixar LLM chamar função ou gerenciar estado diretamente
```

### 2. Prompts centralizados

Nunca hardcode prompt fora de `config/prompts.ts`. Todos os prompts do sistema, incluindo system prompt, exemplos de few-shot e mensagens de erro, vivem nesse arquivo. Manutenção em um só lugar.

### 3. Path aliases

Sempre `@/` na API e no Dashboard. Nunca relative paths (`../../`). Configurado em `tsconfig.json` de cada app.

### 4. State via service

```typescript
// ✅ Correto
await conversationService.updateState(conversation.id, 'processing', { lastIntent: intent.intent });

// ❌ Errado — nunca update direto no DB
await db.update(conversations).set({ state: 'processing' }).where(...);
```

### 5. Webhooks assíncronos

Responda HTTP 200 imediatamente, processe via Bull `messageQueue`. Nunca processar mensagem dentro do handler do webhook — risco de timeout e re-delivery duplicado.

### 6. Singletons

```typescript
// ✅ Padrão do projeto
export const myService = new MyService();
// importar e reutilizar, nunca new MyService() no ponto de uso
```

### 7. Enriquecimento async

`save_*` tools persistem com metadata mínima e retornam ao usuário imediatamente. `enrichmentQueue` cuida de TMDB/YouTube/etc em background. Nunca bloquear o fluxo principal esperando API externa.

### 8. Fail-fast env

App falha no boot se variável obrigatória ausente (`packages/env/src/index.ts` com Zod). Nunca verificar env em runtime dentro de serviços.

### 9. Dedup automático

`contentHash = SHA-256(userId + type + title/url + externalId)` como UNIQUE constraint em `memory_items`. Evita duplicatas silenciosamente sem precisar checar antes do insert.

### 10. CASL Tools Gate

LLM só recebe lista das tools **ativas** para o usuário. Consulta `global_tools` antes de montar o prompt. Tools desativadas são invisíveis ao LLM.

---

## 11. PROBLEMAS COMUNS

| Problema | Solução |
|---------|---------|
| LLM retorna JSON com markdown fences | `parseAgentDecisionV2FromLLM()` — trata fences, trailing text e JSON com comentários automaticamente |
| `@nexo/env` TypeScript error após adicionar var | `cd packages/env && npx tsup` |
| Baileys 405 do WhatsApp | `pnpm install` aplica patch automaticamente (ADR-020) |
| False positive em `search_content` | Guard: se msg >60 chars sem palavras de memória → `unknown` → LLM |
| Conversa não fecha | Checar Redis + Bull Board `http://localhost:3002/admin/queues` |
| Embedding dimensão errada | Manter BGE Small 384-dim. Trocar modelo exige rebuild do HNSW index |
| `EADDRINUSE :3002` | `kill -9 $(lsof -t -i:3002)` |
| Turbo cache stale | `pnpm turbo clean && pnpm install && pnpm build` |
| Tests falhando (vitest cache) | `rm -rf apps/api/node_modules/.vitest && pnpm test --run` |
| Schema desincronizado | `pnpm db:push` |
| CORS bloqueando Dashboard | Adicionar URL em `CORS_ORIGINS` no `.env` |
| Langfuse input/output vazio | Spans AI devem ter `langfuse.trace.input`/`langfuse.trace.output`. Ver seção 9. |
| `@nexo/otel` mudou mas dist está velha | `cd packages/otel && npx tsup && pnpm dev:api` |

---

## 12. ADRs

| # | ADR | Status |
|---|-----|--------|
| 011 | **Deterministic Runtime Control** | ⭐ CRÍTICO |
| 004/008 | State Machine conversacional (11 estados) | Ativo |
| 010 | Enrichment Assíncrono via Bull Queues | Ativo |
| 012 | Vitest como framework de testes | Ativo |
| 013 | Conversational Anamnesis | Em impl. |
| 014 | Query Expansion (hybrid search) | Em impl. |
| 015 | Railway como plataforma de deploy | Ativo |
| 016 | Session Key Architecture (OpenClaw) | Ativo |
| 017 | Agent Profile System (SOUL/IDENTITY) | Ativo |
| 018 | Hybrid Memory Search (70/30) | Ativo |
| 019 | Pluggable Tools + CASL | Ativo |
| 020 | Baileys 405 Platform Fix | Ativo |
| 021 | Canonical Auth Providers | Ativo |

ADRs completos em `docs/adr/`.

---

## 13. REGRAS ABSOLUTAS

1. LLM nunca gerencia estado, decide fluxo ou executa código (ADR-011)
2. Sempre usar `AgentDecisionV2` schema para output do LLM
3. Enfileirar TODO processamento de webhook via Bull
4. Centralizar todos os prompts em `config/prompts.ts`
5. Usar path aliases (`@/`) sempre — nunca `../../`
6. Exportar services como singletons
7. Rodar testes após mudanças: `pnpm test`
8. Verificar se servidor já está rodando antes de reiniciar
9. Workflow: **feature → testes verdes → commit → próxima feature**
10. Após mudar `packages/env/src/index.ts` → `cd packages/env && npx tsup`
11. Após mudar `packages/otel/src/` → `cd packages/otel && npx tsup`
12. Nunca usar `console.log` — use `loggers.*` (Pino)
13. Documentação primeiro: checar `docs/` antes de criar solução
14. Nunca bloquear o webhook handler — tudo via queues

---

## 14. LINKS

| URL | Serviço |
|-----|---------|
| http://localhost:3002 | API |
| http://localhost:3002/admin/queues | Bull Board |
| http://localhost:3002/reference | API Docs (Scalar) |
| http://localhost:4983 | Drizzle Studio |
| http://localhost:5173 | Dashboard |
| http://localhost:16686 | Jaeger UI (traces + SPM) |
| http://localhost:9090 | Prometheus |

**Arquivos chave:**
- `apps/api/src/services/agent-orchestrator.ts` — orquestração principal
- `apps/api/src/services/intent-classifier.ts` — detecção de intenção neural
- `apps/api/src/config/prompts.ts` — todos os prompts (2000+ linhas)
- `apps/api/src/services/tools/index.ts` — implementação das 20+ tools
- `apps/api/src/types/index.ts` — tipos core (AgentLLMResponse, ConversationState...)
- `apps/api/src/services/conversation-service.ts` — state machine
- `packages/otel/src/` — OTEL + Langfuse span processor
- `docs/adr/011-deterministic-runtime-control.md` — ADR mais crítico

---

**Golden Rule**: Código controla fluxo. LLM apenas planeja. Estado é gerenciado deterministicamente.
