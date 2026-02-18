# Copilot Instructions - Nexo AI

Assistente pessoal via Telegram/WhatsApp que organiza conteúdo (filmes, séries, vídeos, links, notas) usando IA.
**Stack**: Node.js + Hono + Drizzle ORM + PostgreSQL (Supabase) + Gemini/Cloudflare Workers AI

## Arquitetura v0.3.0 - Controle Determinístico

```
Telegram/WhatsApp → Webhook → IntentClassifier (determinístico)
                                    ↓
                              AgentOrchestrator → decide ação
                                    ↓
                              LLM (planner) → seleciona tool
                                    ↓
                              Tools (execução) → enrich + save
```

**Princípio crítico** ([ADR-011](../docs/adr/011-deterministic-runtime-control.md)): LLM **nunca** gerencia estado, decide fluxo ou executa lógica. LLM **apenas** analisa, planeja e escolhe tools.

## Fluxo de Processamento

1. `intent-classifier.ts` → classifica intenção via regex ou LLM leve (Cloudflare)
2. `agent-orchestrator.ts` → `decideAction()` baseado em intent + state
3. Ações determinísticas (delete_all, list_all) → execução direta
4. Ações complexas → `handleWithLLM()` → LLM retorna `AgentLLMResponse` JSON
5. Runtime processa resposta, executa tools, atualiza estado

## Schema Obrigatório - AgentLLMResponse

```typescript
// src/types/index.ts - TODA resposta LLM deve seguir este formato
interface AgentLLMResponse {
  schema_version: "1.0";
  action: "CALL_TOOL" | "RESPOND" | "NOOP";
  tool?: ToolName;     // obrigatório se action=CALL_TOOL
  args?: Record<string, any>;
  message?: string;    // máx 200 chars se action=RESPOND
}
```

## Tools Específicas (contratos fortes)

```typescript
// src/services/tools/index.ts - 11 tools, cada uma faz UMA coisa
save_note(content)
save_movie(title, year?, tmdb_id?)
save_tv_show(title, year?, tmdb_id?)
save_video(url)
save_link(url, description?)
search_items(query?, type?)
enrich_movie(title)      // busca TMDB
enrich_tv_show(title)    // busca TMDB
enrich_video(url)        // busca YouTube
```

## Database Schema (Drizzle ORM + Supabase)

```
src/db/schema/
├── users.ts           # Usuário único (name, email, assistantName, timeoutUntil)
├── user-accounts.ts   # Multi-provider: telegram | whatsapp | discord (externalId único por provider)
├── user-preferences.ts # Preferências one-to-one (assistantName customizado)
├── conversations.ts   # State machine (state, context JSONB, closeAt, isActive)
├── messages.ts        # Histórico (role: user|assistant, conversationId)
├── items.ts           # memory_items: filmes, séries, vídeos, links, notas
                       # (type, metadata JSONB, embedding vector 1024d, externalId único)
```

**Relações**: `users` 1:N `userAccounts`, `users` 1:N `conversations`, `conversations` 1:N `messages`, `users` 1:N `memoryItems`

## State Machine

Estados em `conversations.state`: `idle → processing → awaiting_confirmation → waiting_close → closed`

- `conversation-service.ts` gerencia transições e histórico
- Contexto (candidates, batch_queue) persiste em `conversations.context` (JSONB)
- Auto-fechamento: `closeAt` + Bull queue (3min inatividade)

## Estrutura de Código

```
src/
├── adapters/messaging/    # Telegram + WhatsApp adapters
│   ├── telegram-adapter.ts  # Bot API, webhook secret
│   └── whatsapp-adapter.ts  # Meta Cloud API
├── services/
│   ├── agent-orchestrator.ts  # ⭐ Orquestrador principal
│   ├── intent-classifier.ts   # ⭐ Classificação determinística
│   ├── conversation-service.ts
│   ├── item-service.ts
│   ├── queue-service.ts       # Bull + Redis (Upstash)
│   ├── ai/                    # Multi-provider (Gemini default, Cloudflare fallback)
│   ├── tools/                 # ⭐ Tools com contratos fortes
│   └── enrichment/            # TMDB, YouTube, OpenGraph
├── config/prompts.ts          # ⭐ Todos os prompts centralizados
├── db/schema/                 # Drizzle schemas (6 tabelas)
└── types/index.ts             # ⭐ AgentLLMResponse, ItemMetadata, ConversationState
```

## Comandos

```bash
pnpm install && cp .env.example .env
pnpm run dev              # http://localhost:3001 (API)
pnpm run db:generate      # gera migrations Drizzle
pnpm run db:push          # aplica no Supabase
pnpm run db:studio        # UI visual do banco
pnpm test                 # roda testes
pnpm run lint             # TypeScript type check
```

## Testes (Vitest)

```bash
pnpm test                           # todos os testes
pnpm test src/tests/intent-classifier.test.ts  # arquivo específico
```

**Arquivos de teste** em `src/tests/`:
- `intent-classifier.test.ts` - classificação de intenções
- `ai-fallback.test.ts` - fallback entre providers AI
- `api.test.ts` - endpoints HTTP

**Padrão**: `describe/test` com `expect` do `vitest`
```typescript
import { describe, test, expect } from 'vitest';
```

## Convenções Críticas

1. **Prompts**: Todos em `config/prompts.ts` - nunca hardcode strings de prompt
2. **Metadata JSONB**: Tipado por item type em `types/index.ts` (MovieMetadata, VideoMetadata, etc)
3. **Validação**: Zod em `config/env.ts`, JSON parse em `utils/json-parser.ts`
4. **Path alias**: Use `@/` para imports (ex: `import { env } from '@/config/env'`)
5. **Services são singletons**: exportados como instância única no final do arquivo
6. **NUNCA mate o server sem verificar antes** - Veja seção Server Management abaixo

## ⚠️ Server Management (OBRIGATÓRIO)

**SEMPRE verifique se o server já está rodando ANTES de matar ou reiniciar.**
O dev server geralmente já está up. Matar sem necessidade quebra túneis (zrok/ngrok) e perde tempo.

```bash
# ✅ CERTO: Verifica primeiro, só inicia se não estiver rodando
lsof -ti:3001 > /dev/null 2>&1 && echo "API already running" || pnpm dev:api
lsof -ti:5173 > /dev/null 2>&1 && echo "Dashboard already running" || pnpm dev:dash

# ❌ ERRADO: Mata e reinicia sem verificar
pkill -f "turbo.*api" && pnpm dev:api
```

**Quando reiniciar**: Só se mudou código de startup (server.ts, index.ts, config de env).
Para mudanças normais de código, tsx watch recarrega sozinho.

## Adicionar Novo Tipo de Item

```typescript
// 1. types/index.ts - adicionar tipo e metadata
export type ItemType = ... | "podcast";
export interface PodcastMetadata { episode: string; duration: number; }

// 2. services/tools/index.ts - criar tool específica
export async function save_podcast(context, params: { url: string }) { ... }

// 3. services/enrichment/ - criar enricher se necessário
// 4. config/prompts.ts - atualizar INTENT_CLASSIFIER_PROMPT e AGENT_SYSTEM_PROMPT
// 5. Criar migration: pnpm run db:generate && pnpm run db:push
```

## AI Provider Multi-Fallback

```typescript
// src/services/ai/index.ts
// Ordem: Gemini (default) → Cloudflare Workers AI (fallback)
// Configurado via GOOGLE_API_KEY e CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN
```

## Messaging Providers

| Provider | Adapter | Config |
|----------|---------|--------|
| Telegram | `telegram-adapter.ts` | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` |
| WhatsApp | `whatsapp-adapter.ts` | `META_WHATSAPP_TOKEN`, `META_PHONE_NUMBER_ID`, `META_VERIFY_TOKEN` |

Ver [ADR-007](../docs/adr/007-multi-provider-support.md) para arquitetura multi-provider.

## ADRs Importantes

| ADR | Tema |
|-----|------|
| [ADR-002](../docs/adr/002-supabase-postgres.md) | Supabase como database |
| [ADR-003](../docs/adr/003-jsonb-metadata.md) | JSONB para metadados flexíveis |
| [ADR-004](../docs/adr/004-state-machine.md) | State machine de conversação |
| [ADR-005](../docs/adr/005-ai-agnostic.md) | Arquitetura AI-agnostic |
| [ADR-007](../docs/adr/007-multi-provider-support.md) | Multi-provider messaging |
| [ADR-011](../docs/adr/011-deterministic-runtime-control.md) | **Controle determinístico (crítico)** |

## Referências

- [docs/ARQUITETURA-v0.3.0.md](../docs/ARQUITETURA-v0.3.0.md) - Arquitetura atual
- [docs/adr/](../docs/adr/README.md) - Todas as ADRs
