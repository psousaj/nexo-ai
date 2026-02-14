# Visão Geral da Arquitetura - Nexo AI

Entenda como o Nexo AI funciona sob o capô.

## 🎯 Visão de Alto Nível

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENTES                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │  Telegram    │  │  WhatsApp    │  │  Dashboard Web      │ │
│  │  Bot API     │  │  Meta API    │  │  (Vue 3)             │ │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘ │
└─────────┼─────────────────┼─────────────────────┼──────────────┘
          │                 │                     │
          ▼                 ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                     ADAPTER LAYER                               │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │ Telegram Adapter │  │ WhatsApp Adapter │  (REST API)        │
│  │ Webhook Handler  │  │ Webhook Handler  │                    │
│  └────────┬─────────┘  └────────┬─────────┘                    │
└───────────┼────────────────────┼───────────────────────────────┘
            │                    │
            └────────┬───────────┘
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                   CONVERSATION MANAGER                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  State Machine (idle → awaiting_confirmation → saving)  │  │
│  │  - Context persistence                                   │  │
│  │  - Multi-turn conversations                              │  │
│  └──────────────────────┬───────────────────────────────────┘  │
└─────────────────────────┼──────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     AGENT ORCHESTRATOR                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Intent Classifier → Action Router → Tool Executor       │  │
│  │  - Deterministic actions (delete_all, list_all)          │  │
│  │  - LLM planner mode (save, search)                       │  │
│  └────────────┬─────────────────────────────┬───────────────┘  │
└───────────────┼─────────────────────────────┼──────────────────┘
                │                             │
        ┌───────▼──────────┐        ┌────────▼─────────┐
        │  AI Service      │        │  Tools Service   │
        │  (LLM Planner)   │        │  - save_movie    │
        │  - Gemini        │        │  - enrich_movie  │
        │  - Cloudflare    │        │  - search_items  │
        └────────┬─────────┘        │  - delete_items  │
                 │                  │  ... (11 tools)  │
                 └──────────┬───────┴──────────────────┘
                            ▼
            ┌───────────────────────────────┐
            │     ENRICHMENT SERVICES       │
            │  ┌────────┐  ┌────────┐       │
            │  │  TMDB  │  │YouTube │       │
            │  └────────┘  └────────┘       │
            │  ┌────────┐  ┌────────┐       │
            │  │OpenGraph│  │...     │       │
            │  └────────┘  └────────┘       │
            └──────────────┬────────────────┘
                           ▼
            ┌───────────────────────────────┐
            │     CACHE + PERSISTENCE       │
            │  ┌───────────┐  ┌───────────┐ │
            │  │   Redis   │  │PostgreSQL │ │
            │  │ (Cache)   │  │  (Data)   │ │
            │  └───────────┘  └───────────┘ │
            └───────────────────────────────┘
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

**11 Tools Disponíveis**:

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

#### Search Tool (1)
```typescript
search_items(query?: string, limit?: number)
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
users            // Usuários do bot
user_accounts    // Contas cross-provider
memory_items     // Itens salvos (filmes, notas, etc)
conversations    // Estado de conversas
messages         // Histórico de mensagens
```

**Schema Key**:

```typescript
// memory_items com embedding VECTOR(1024)
{
  id: uuid,
  type: 'movie' | 'tv_show' | 'video' | 'link' | 'note',
  title: string,
  metadata: JSONB,  // flexível por tipo
  embedding: VECTOR(1024),  // busca semântica
  user_id: uuid,
  created_at: timestamp
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
- [ADRs](../adr/README.md) - Decisões arquiteturais

---

**Última atualização**: 14 de fevereiro de 2026
