# Visão Geral da Arquitetura - Nexo AI

Entenda como o Nexo AI funciona sob o capô.

## 🎯 Visão de Alto Nível

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENTES                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │  Telegram    │  │  WhatsApp    │  │  Discord            │
│  │  Bot API     │  │  Meta API    │  │  Bot.js             │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘ │
└─────────┼─────────────────┼─────────────────────┼──────────────┘
          │                 │                     │
          ▼                 ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                     ADAPTER LAYER                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐│
│  │ Telegram Adapter │  │ WhatsApp Adapter │  │Discord Adapter││
│  │ Webhook Handler  │  │ Webhook Handler  │  │Event Handler  ││
│  │ + Session Keys   │  │ + Session Keys   │  │+ Session Keys ││
│  └────────┬─────────┘  └────────┬─────────┘  └───────┬───────┘│
└───────────┼────────────────────┼─────────────────────┼─────────┘
            │                    │                     │
            └────────┬───────────┘                     │
                     ▼                                 │
┌─────────────────────────────────────────────────────────────────┐
│                   CONVERSATION MANAGER                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  State Machine (idle → awaiting_confirmation → saving)  │  │
│  │  - Context persistence (JSONB)                           │  │
│  │  - Multi-turn conversations                              │  │
│  └──────────────────────┬───────────────────────────────────┘  │
└─────────────────────────┼──────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     AGENT ORCHESTRATOR                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Intent Classifier → Action Router → Tool Executor       │  │
│  │  - Context Builder (OpenClaw)                            │  │
│  │  - Agent Profiles (AGENTS/SOUL/IDENTITY/USER.md)          │  │
│  └────────────┬─────────────────────────────┬───────────────┘  │
└───────────────┼─────────────────────────────┼──────────────────┘
                │                             │
        ┌───────▼──────────┐        ┌────────▼─────────┐
        │  AI Service      │        │  Tools Service   │
        │  (LLM Planner)   │        │  - save_movie    │
        │  - Gemini        │        │  - enrich_movie  │
        │  - Cloudflare    │        │  - memory_search ││
        │  - Context from  │        │  - memory_get    ││
        │    Agent Profiles│        │  - daily_log_    ││
        │                   │        │    search        ││
        └────────┬─────────┘        │  ... (14 tools)  │
                 │                  └────────┬──────────┘
                 └──────────┬───────┘         │
                            ▼                 │
            ┌───────────────────────────────┐ │
            │     ENRICHMENT SERVICES       │ │
            │  ┌────────┐  ┌────────┐       │ │
            │  │  TMDB  │  │YouTube │       │ │
            │  └────────┘  └────────┘       │ │
            │  ┌────────┐  ┌────────┐       │ │
            │  │OpenGraph│  │...     │       │ │
            │  └────────┘  └────────┘       │ │
            └──────────────┬────────────────┘ │
                           ▼                 │
            ┌───────────────────────────────┐ │
            │     HYBRID MEMORY SEARCH      │ │
            │  ┌────────┐  ┌────────┐       │ │
            │  │Vector  │  │Keyword │       │ │
            │  │(pgvector)│ │(PostgreSQL)│   │ │
            │  │  FTS    │  │  FTS    │       │ │
            │  └────────┘  └────────┘       │ │
            │        ↓            ↓          │ │
            │        └────────────┴───────┐  │ │
            │        Merge Strategies     │  │ │
            │  (weighted/avg/rrf)        │  │ │
            └──────────────┬────────────────┘ │
                           ▼                 │
            ┌───────────────────────────────┐ │
            │     CACHE + PERSISTENCE       │ │
            │  ┌───────────┐  ┌───────────┐ │ │
            │  │   Redis   │  │PostgreSQL │ │ │
            │  │ (Cache)   │  │  (Data)   │ │ │
            │  │           │  │ + Session │ │ │
            │  │           │  │   Keys    │ │ │
            │  │           │  │ + Agent   │ │ │
            │  │           │  │   Logs    │ │ │
            │  └───────────┘  └───────────┘ │ │
            └───────────────────────────────┘ │
                                              ▼
                                ┌───────────────────────┐
                                │   DASHBOARD UI         │
                                │  - Profile Editor     │
                                │  - Session Viewer     │
                                │  - Memory Search      │
                                │  - Daily Logs         │
                                └───────────────────────┘
```

---

## 📚 Camadas da Arquitetura

### 1. Adapter Layer

**Responsabilidade**: Traduzir requisições externas para formato interno.

**Componentes**:

- `telegram-adapter.ts` - Webhook do Telegram
- `whatsapp-adapter.ts` - Webhook do WhatsApp (futuro)
- `routes/` - REST API endpoints

**Características**:
- ✅ **Simples** - apenas traduz, sem lógica de negócio
- ✅ **Validação** - headers, tokens, signatures
- ✅ **Provider-agnostic** - fácil adicionar novos providers

**Exemplo**:

```typescript
// src/adapters/telegram-adapter.ts

async handleWebhook(request: Request) {
  // 1. Validar webhook secret
  if (!verifyWebhook(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Parsear mensagem
  const message = parseTelegramMessage(await request.json());

  // 3. Delegar para Conversation Manager
  await conversationService.handleMessage(message);

  return Response.json({ ok: true });
}
```

---

### 2. Conversation Manager (State Machine)

**Responsabilidade**: Gerenciar estado de conversas multi-turn.

**Estados**:

```
idle → awaiting_confirmation → enriching → saving → idle
  ↓                               ↓
  └────────────── error ──────────┘
```

**Transições**:

| Estado         | Trigger                     | Próximo Estado          |
| -------------- | --------------------------- | ----------------------- |
| `idle`         | Mensagem recebida           | `enriching`             |
| `idle`         | `pendingAction` existe      | `awaiting_confirmation` |
| `enriching`    | Múltiplos resultados        | `awaiting_confirmation` |
| `enriching`    | Resultado único             | `saving`                |
| `saving`       | Salvo com sucesso           | `idle`                  |
| `*_confirmation` | Timeout ou cancel        | `idle`                  |

**Context Persistido**:

```typescript
interface ConversationContext {
  state: State;
  pendingAction?: {
    tool: ToolName;
    args: Record<string, any>;
    candidates?: any[];
  };
  lastInteraction: string;
  metadata?: Record<string, any>;
}
```

**Por quê State Machine?**

- ✅ **Previsível** - fluxo claro e testável
- ✅ **Resiliente** - estado persiste entre requests
- ✅ **Multi-turn** - suporta conversas longas
- ✅ **Debugável** - cada transição logada

> Ver [ADR-004: State Machine](../adr/004-state-machine.md)

---

### 3. Agent Orchestrator

**Responsabilidade**: Decidir **o que fazer** com cada mensagem.

**Fluxo**:

```
Message → Intent Classifier → Action Router
                                  ↓
                    ┌─────────────┴─────────────┐
                    │                           │
            Deterministic              LLM Planner
            Actions                    (JSON Only)
                    │                           │
            delete_all                  save_note
            list_all                    enrich_movie
            cancel                      search_items
                    │                           │
                    └─────────────┬─────────────┘
                                  ▼
                          Tool Executor
```

**Ações Determinísticas** (sem LLM):

- `delete_all` - executa diretamente
- `list_all` - executa diretamente
- `cancel` - limpa contexto

**Ações com LLM** (planner mode):

- `save` - LLM decide qual tool usar
- `search` - LLM decide parâmetros

> Ver [Controle Runtime Determinístico](deterministic-runtime.md)

---

### 4. AI Service (LLM Planner)

**Responsabilidade**: Planejar ações (apenas JSON, nunca texto livre).

**Schema Canônico**:

```typescript
interface AgentLLMResponse {
  schema_version: string;  // "1.0"
  action: 'CALL_TOOL' | 'RESPOND' | 'NOOP';
  tool?: ToolName;         // obrigatório se action=CALL_TOOL
  args?: Record<string, any>;
  message?: string | null; // null se action=NOOP
}
```

**Características**:

- ✅ **Apenas JSON** - nunca conversa livre
- ✅ **Validado** - schema checked em runtime
- ✅ **Retry** - se inválido, tenta com prompt reforçado
- ✅ **Provider-agnostic** - fácil trocar Gemini/Claude

> Ver [ADR-005: AI-Agnostic Architecture](../adr/005-ai-agnostic.md)

---

### 5. Tools Service

**Responsabilidade**: Executar ações específicas com contratos fortes.

**14 Tools Disponíveis**:

#### Save Tools (5)
```typescript
save_note(content: string)
save_movie(title: string, year?: number, tmdb_id?: number)
save_tv_show(title: string, year?: number, tmdb_id?: number)
save_video(url: string, title?: string)
save_link(url: string, description?: string)
```

#### Enrichment Tools (3)
```typescript
enrich_movie(title: string, year?: number)
enrich_tv_show(title: string, year?: number)
enrich_video(url: string)
```

#### Search Tools (2)
```typescript
search_items(query?: string, limit?: number)
memory_search(query: string, maxResults?: number, types?: string[])  // OpenClaw hybrid search
```

#### Memory Tools (2) - OpenClaw Pattern
```typescript
memory_get(id: string)  // Get specific memory item by ID
daily_log_search(date?: string, query?: string)  // Search daily logs
```

#### Delete Tools (2)
```typescript
delete_items(item_ids: string[])
delete_all_items()  // determinístico
```

**Características**:

- ✅ **Contratos fortes** - TypeScript types
- ✅ **Isoladas** - cada tool independente
- ✅ **Testáveis** - unit tests simples
- ✅ **Observáveis** - logs estruturados

> Ver [Tools Reference](../reference/tools-reference.md)
> Ver [ADR-018: Hybrid Memory Search](../adr/018-hybrid-memory-search.md)

---

### 6. Enrichment Services

**Responsabilidade**: Buscar metadados em APIs externas.

**Serviços**:

- `tmdb-service.ts` - The Movie Database (filmes/séries)
- `youtube-service.ts` - YouTube Data API (vídeos)
- `opengraph-service.ts` - OpenGraph scraping (links)

**Cache Strategy**:

```typescript
// TTL configurado por serviço
TMDB:        24h cache
YouTube:     12h cache
OpenGraph:   24h cache (ou 1h se erro)
```

**Características**:

- ✅ **Cached** - reduz custos de API
- ✅ **Fallback** - se falhar, continua sem metadata
- ✅ **Provider-agnostic** - fácil trocar APIs

> Ver [Busca Semântica](../how-to/semantic-search.md)

---

### 7. Persistence Layer

**Responsabilidade**: Armazenar dados e cache.

#### PostgreSQL (Dados)

```typescript
// Tabelas principais
users                  // Usuários do bot (com perfil OpenClaw)
auth_providers         // Contas vinculadas por provider (canônico)
user_emails            // Endereços de email
user_preferences       // Preferências do usuário
memory_items           // Itens salvos (filmes, notas, etc)
conversations          // Estado de conversas
messages               // Histórico de mensagens
agent_sessions         // Sessões OpenClaw (session keys)
agent_memory_profiles  // Perfis de memória por sessão
session_transcripts    // Transcrições de sessões
agent_daily_logs       // Logs diários do agente
semantic_external_items // Cache externo para normalização
```

**Schema Key**:

```typescript
// memory_items com embedding VECTOR(384)
{
  id: uuid,
  type: 'movie' | 'tv_show' | 'video' | 'link' | 'note',
  title: string,
  metadata: JSONB,  // flexível por tipo
  embedding: VECTOR(384),  // busca semântica
  user_id: uuid,
  created_at: timestamp
}

// agent_sessions (OpenClaw pattern)
{
  id: uuid,
  user_id: uuid,
  session_key: string,  // "main:telegram::direct:123456789:main"
  peer_kind: 'direct' | 'group' | 'channel',
  peer_id: string,
  metadata: JSONB,
  created_at: timestamp,
  updated_at: timestamp
}

// agent_daily_logs
{
  id: uuid,
  user_id: uuid,
  log_date: date,  // YYYY-MM-DD
  content: text,
  created_at: timestamp,
  updated_at: timestamp
}
```

#### Redis (Cache)

```typescript
// Chaves de cache
tmdb:movie:search:{title}          → 24h TTL
tmdb:tv:search:{title}             → 24h TTL
youtube:{videoId}                 → 12h TTL
opengraph:{url}                   → 24h TTL
```

**Características**:

- ✅ **Silencioso** - falhas não bloqueiam app
- ✅ **TTL inteligente** - dados estáveis duram mais
- ✅ **Fallback automático** - se cache miss, chama API

> Ver [ADR-002: Supabase Postgres](../adr/002-supabase-postgres.md)

---

### 8. OpenClaw Patterns

**Responsabilidade**: Sistema de memória persistente e personalização de agente.

**Componentes**:

#### Session Keys
Sistema de identificação única para contexto de conversação.

```typescript
// Formato: {agentId}:{channel}:{accountId}:{peerKind}:{peerId}:{dmScope}
"main:telegram::direct:123456789:main"
"main:discord:account1:channel:987654321:per-peer"
```

**Propósito**:
- Isolar contexto por peer (DMs, grupos, canais)
- Suportar múltiplas contas por provider
- Permitir diferentes agentes em mesmo bot

> Ver [ADR-016: Session Key Architecture](../adr/016-session-key-architecture.md)

#### Agent Profiles
Personalização de comportamento do agente via arquivos markdown.

```markdown
# AGENTS.md - Configuração geral
# SOUL.md - Personalidade e tom
# IDENTITY.md - Contexto e memória de longo prazo
# USER.md - Preferências específicas do usuário
```

**Campos no banco**:
```typescript
users: {
  assistant_emoji: string;        // Ex: "🤖"
  assistant_creature: string;     // Ex: "owl"
  assistant_tone: string;        // Ex: "friendly"
  assistant_vibe: string;        // Ex: "helpful"
}
```

> Ver [ADR-017: Agent Profile System](../adr/017-agent-profile-system.md)

#### Hybrid Memory Search
Combinação de busca vetorial semântica + busca por palavras-chave.

```typescript
memory_search({
  query: "filmes de ação",
  maxResults: 10,
  types: ['movie', 'tv_show']
})
```

**Merge Strategies**:
- `weighted` - ponderação configurável (70% vector + 30% keyword)
- `average` - média simples dos scores
- `reciprocal_rank_fusion` - fusão de rankings (RRF)

**Tecnologias**:
- pgvector para busca semântica (embeddings 384-dim)
- PostgreSQL FTS (Full-Text Search) para busca por palavras-chave
- HNSW index para aproximação rápida

> Ver [ADR-018: Hybrid Memory Search](../adr/018-hybrid-memory-search.md)
> Ver [OpenClaw Patterns Guide](../how-to/openclaw-patterns.md)

#### Context Builder
Constrói contexto rico para o LLM baseado em session key e perfis.

```typescript
const agentContext = await buildAgentContext(userId, sessionKey);
// Retorna: { systemPrompt, soulContent, identityContent, userContent }
```

**Processo**:
1. Parse session key
2. Buscar/agrupar arquivos de perfil (AGENTS.md, SOUL.md, IDENTITY.md, USER.md)
3. Montar system prompt personalizado
4. Injetar na chamada do LLM

#### Daily Logs
Registro diário de interações e insights do agente.

```typescript
// Tabela agent_daily_logs
{
  user_id: uuid,
  log_date: date,  // YYYY-MM-DD
  content: text,
  created_at: timestamp,
  updated_at: timestamp
}
```

**Integração**:
- Atualizado automaticamente após cada conversa significativa
- Buscável via `daily_log_search` tool
- Visualizável no dashboard

---

## 🔄 Fluxo Completo: "Salva Inception"

```
1. Usuário: "salva inception"
   ↓
2. Telegram Adapter: webhook recebido
   ↓
3. Conversation Manager: carrega estado (idle)
   ↓
4. Intent Classifier:
   { intent: 'save', action: 'save', entities: {content: 'inception'} }
   ↓
5. Agent Orchestrator: action='save' → chama LLM
   ↓
6. AI Service (Gemini):
   Retorna JSON: {"action": "CALL_TOOL", "tool": "enrich_movie", "args": {"title": "inception"}}
   ↓
7. Tool Executor: enrich_movie(title="inception")
   ↓
8. TMDB Service:
   8.1 Check cache: tmdb:movie:search:inception → MISS
   8.2 Chama API externa → [{id: 27205, title: "Inception", year: 2010}]
   8.3 Save cache (24h TTL)
   ↓
9. Agent Orchestrator: múltiplos resultados → pedir confirmação
   ↓
10. LLM: {"action": "RESPOND", "message": "Encontrei 2 filmes:\n1..."}
   ↓
11. Conversation Manager: salva pendingAction, estado → awaiting_confirmation
   ↓
12. Telegram Adapter: envia mensagem
   ↓
13. Usuário: "1"
   ↓
14. Conversation Manager: pendingAction existe + seleção válida
   ↓
15. Tool Executor: save_movie(title="Inception", year=2010, tmdb_id=27205)
   ↓
16. Item Service:
   16.1 Prepara texto rico: "Filme: Inception\nAno: 2010..."
   16.2 Gera embedding: [0.234, -0.512, ...] (1024 dims)
   16.3 Salva no PostgreSQL
   ↓
17. Conversation Manager: limpa pendingAction, estado → idle
   ↓
18. Telegram Adapter: "✅ Inception (2010) salvo!"
```

---

## 🎯 Princípios Arquiteturais

### 1. Adapters são Simples

**Regra**: Apenas traduzem requisições, sem lógica de negócio.

```typescript
// ❌ ERRADO - lógica no adapter
if (message.text === 'delete_all') {
  await db.delete(memoryItems);
}

// ✅ CERTO - delega para service
await conversationService.handleMessage(message);
```

### 2. Services são Provider-Agnostic

**Regra**: Fácil trocar LLM/APIs sem quebrar código.

```typescript
// ✅ CERTO - interface genérica
await aiService.callLLM({
  provider: 'gemini',  // pode trocar por 'claude'
  prompt: '...'
});

// ❌ ERRADO - hardcoded
await gemini.generateContent(prompt);
```

### 3. JSONB para Flexibilidade

**Regra**: Metadados diferentes por tipo de item.

```typescript
// ✅ CERTO - flexível
metadata: {
  tmdb_id: 27205,
  genres: ['Ação', 'Ficção Científica'],
  director: 'Christopher Nolan',
  // qualquer campo extra
}

// ❌ ERRADO - colunas fixas
ALTER TABLE memory_items ADD COLUMN director TEXT;
ALTER TABLE memory_items ADD COLUMN genres TEXT[];
```

### 4. State Persistido

**Regra**: Conversação sobrevive a cold starts.

```typescript
// ✅ CERTO - estado no banco
await db.update(conversations)
  .set({ state: 'awaiting_confirmation', context })
  .where(eq(conversations.id, conversationId));

// ❌ ERRADO - estado em memória
let state = 'idle';  // perde em cold start
```

---

## 📊 Performance e Custos

### Latência Típica

| Operação            | Latência (média) |
| ------------------- | ---------------- |
| Webhook → Response  | ~500ms           |
| "lista tudo"        | <100ms           |
| "salva filme"       | ~1.5s            |
| Busca semântica     | ~300ms           |

### Custos Estimados

| Recurso            | Custo mensal      |
| ------------------ | ----------------- |
| Cloudflare Workers | $0 (free tier)    |
| Supabase           | $0 (free tier)    |
| Gemini API         | ~$2-5            |
| Redis (Upstash)    | $0 (free tier)    |
| **Total**          | **~$2-5/mês**    |

> Ver [Roadmap](../reference/roadmap.md) para custos de paid tier

---

## 📚 Documentação Relacionada

- [Controle Runtime Determinístico](deterministic-runtime.md) - Pattern Hugging Face Agents
- [State Machine](state-machine.md) - Máquina de estados detalhada
- [Busca Semântica](../how-to/semantic-search.md) - Embeddings e cache
- [OpenClaw Patterns Guide](../how-to/openclaw-patterns.md) - Padrões OpenClaw no Nexo AI
- [ADRs](../adr/README.md) - Decisões arquiteturais
  - [ADR-011: Deterministic Runtime Control](../adr/011-deterministic-runtime-control.md) - Princípio crítico da arquitetura
  - [ADR-016: Session Key Architecture](../adr/016-session-key-architecture.md) - Sistema de chaves de sessão
  - [ADR-017: Agent Profile System](../adr/017-agent-profile-system.md) - Personalização de agentes
  - [ADR-018: Hybrid Memory Search](../adr/018-hybrid-memory-search.md) - Busca híbrida vetorial + keyword

---

**Última atualização**: 16 de fevereiro de 2026 (OpenClaw patterns integrados)
