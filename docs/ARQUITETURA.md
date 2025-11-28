# Arquitetura do Personal AI Assistant (v2 – Conceitual + Detalhada)

Este documento combina a arquitetura antiga com a nova visão **serverless‑friendly**, **AI‑agnostic** (Gemini hoje, Claude MCP depois) e preserva **seus schemas, modelos mentais, fluxos, cenários e casos de uso**.

A ideia é: você ler isso daqui a meses e conseguir implementar sem se perder.

---

## 1. Visão Geral

Assistente pessoal que recebe mensagens via **WhatsApp (Evolution API)**, entende o conteúdo com ajuda de um LLM (Gemini no MVP, Claude via MCP no futuro), enriquece com APIs externas (TMDB, YouTube, OpenGraph), classifica e salva tudo em um banco Postgres (JSONB para metadados flexíveis).

Arquitetura em camadas:

```text
WhatsApp (Evolution)
    ↓ Webhook
Adapter REST (serverless-friendly)
    ↓
Services (conversation, items, enrichment, AI)
    ↓
PostgreSQL (Neon / Supabase / D1-like)
    ↑
LLM (Gemini hoje, Claude MCP depois)
```

Princípios:

- **Adapters são burros**: só traduzem entrada → services → resposta.
- **Services têm toda lógica**: contexto, enrichment, classificação, persistência.
- **Contexto é do backend**, não do modelo (para funcionar em qualquer LLM).
- **MCP é opcional**: pode ser plugado depois, como outro adapter.

---

## 2. Arquitetura de Dados (PostgreSQL – conceitual)

Mantendo exatamente o que você definiu, só organizando bonitinho.

### 2.1 Tabela `items`

```text
┌─────────────────────────────────────────────────────────────┐
│ items                                                      │
├─────────────────────────────────────────────────────────────┤
│ id: uuid (PK)                                              │
│ user_id: text (FK) - WhatsApp number ou Auth.js user_id    │
│ type: text - 'movie' | 'video' | 'link' | 'note' | etc     │
│ title: text                                                │
│ description: text?                                         │
│ metadata: jsonb - estrutura varia por tipo                 │
│ tags: jsonb (array) - ['terror', 'ação']                   │
│ status: text - 'pending' | 'watched' | 'completed'         │
│ created_at: timestamp                                      │
│ updated_at: timestamp                                      │
│                                                             │
│ Indexes:                                                    │
│ - GIN(metadata)   -- queries em JSONB                      │
│ - GIN(tags)       -- busca por tags                        │
│ - (user_id, type) -- filtros comuns                        │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Tabela `conversations`

```text
┌─────────────────────────────────────────────────────────────┐
│ conversations                                              │
├─────────────────────────────────────────────────────────────┤
│ id: uuid (PK)                                              │
│ user_id: text (FK)                                         │
│ whatsapp_chat_id: text - ID do chat no WhatsApp            │
│ state: text - estado atual da conversa                     │
│ context: jsonb - dados temporários da conversa             │
│ last_message_at: timestamp                                 │
│ created_at: timestamp                                      │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Tabela `messages`

```text
┌─────────────────────────────────────────────────────────────┐
│ messages                                                   │
├─────────────────────────────────────────────────────────────┤
│ id: uuid (PK)                                              │
│ conversation_id: uuid (FK)                                 │
│ role: text - 'user' | 'assistant'                          │
│ content: text                                              │
│ metadata: jsonb - tool_calls, attachments, etc             │
│ created_at: timestamp                                      │
└─────────────────────────────────────────────────────────────┘
```

### 2.4 Exemplos de `metadata` por tipo de item

```ts
// movie
{
  tmdb_id: 550,
  year: 1999,
  genres: ['Drama', 'Thriller'],
  director: 'David Fincher',
  rating: 8.8,
  runtime: 139,
  poster_url: 'https://...',
  streaming: [
    { provider: 'Netflix', url: 'https://...', type: 'subscription' },
    { provider: 'Amazon', url: 'https://...', type: 'rent', price: 3.99 }
  ],
  download_available: false
}

// video (YouTube)
{
  video_id: 'dQw4w9WgXcQ',
  channel: 'Rick Astley',
  channel_id: 'UC...',
  duration: 212,
  views: 1000000000,
  published_at: '2009-10-25',
  thumbnail_url: 'https://...',
  category: 'Music'
}

// link
{
  url: 'https://react.dev',
  domain: 'react.dev',
  og_title: 'React',
  og_description: 'The library for web and native user interfaces',
  og_image: 'https://...',
  og_type: 'website'
}

// note (texto puro, sem enrichment)
{
  content: 'Lembrar de estudar hooks do React',
  category: 'study' // inferido pelo modelo
}
```

---

## 3. Camadas Lógicas (Adapters + Services)

### 3.1 Adapters

Responsáveis por **falar com o mundo externo**, sem lógica de negócio.

- `rest-adapter` (MVP)
  - recebe webhooks do WhatsApp (Evolution API)
  - expõe API REST para UI futura / integração
- `mcp-adapter` (futuro)
  - expõe tools/resources MCP mapeando para os mesmos services

Papel deles:

- validar payloads de entrada
- chamar os services certos
- mapear output dos services para o formato esperado (WhatsApp / HTTP / MCP)

### 3.2 Services (core da aplicação)

Sugestão de serviços:

- `conversation-service`

  - `getOrCreateConversation(userId, whatsappChatId)`
  - `addMessage(conversationId, role, content, metadata?)`
  - `getHistory(conversationId, limit)`
  - `updateState(conversationId, state, context?)`

- `item-service`

  - `createItem(userId, payload)`
  - `updateItem(id, patch)`
  - `deleteItem(id)`
  - `getItemById(id)`
  - `searchItems(filters)`

- `classifier-service`

  - `detectType(message | url)` → `"movie" | "video" | "link | "note"`
  - `extractEntities(message)` → título, ano, etc.

- `enrichment-service`

  - `enrichMovieByTitle(title)` → `metadata.movie`
  - `enrichMovieById(tmdbId)`
  - `enrichYoutubeVideo(urlOuId)`
  - `enrichLink(url)` (OpenGraph)

- `ai-service`
  - `callLLMWithContext({ userMessage, history, context })`
  - Provider‑agnostic: hoje usa Gemini, amanhã pode usar Claude.

---

## 4. State Machine de Conversação

Mantém a experiência previsível e facilita testes.

```text
idle → awaiting_confirmation → enriching → saving → idle
  ↓                               ↓
  └────────────── error ──────────┘
```

- `idle`: nenhuma operação pendente
- `awaiting_confirmation`: modelo sugeriu algo, espera o "sim / não" do usuário
- `enriching`: buscando metadata externo (TMDB, YouTube, OG)
- `saving`: gravando `item` no banco
- `error`: algo quebrou ou ficou inconsistente → volta para `idle` com mensagem amigável

O `conversation-service` persiste `state` e `context` na tabela `conversations`.

---

## 5. Fluxo de Funcionamento (atualizado)

### 5.1. Recepção de Mensagem (WhatsApp → Backend)

```text
┌─────────────┐     ┌──────────────────────┐     ┌──────────────────────┐
│ WhatsApp    │ --> │ REST Adapter/Worker │ --> │ Conversation Service │
│ Evolution   │     │  /webhook/evolution │     │  getOrCreate()       │
└─────────────┘     └──────────────────────┘     └──────────────────────┘
```

- Evolution API envia `POST /webhook/evolution` para seu **endpoint serverless** (Cloudflare Worker / Lambda / etc).
- Adapter valida payload e chama `conversation-service`.

### 5.2. Processamento com LLM (Gemini no MVP, Claude depois)

Conceito antigo preservado, mas AI‑agnostic e via services.

```text
┌─────────────────┐   ┌──────────────────────┐   ┌─────────────────────┐
│ MessageHandler  │-->| AI Service           │-->| (Opcional) MCP Tools│
│ (usa Services)  │   │ (Gemini / Claude)    │   │ save_item, search…  │
│ - contexto      │   │ - monta prompt       │   │ (fase Claude/MCP)   │
│ - histórico     │   │ - injeta histórico   │   └─────────────────────┘
└─────────────────┘   └──────────────────────┘
```

MVP com Gemini:

- Adapter chama `ai-service.callLLMWithContext()`
- Você monta o prompt descrevendo:
  - quem é o sistema
  - o que fazer com a mensagem do usuário
  - quais ações ele pode pedir (salvar item, sugerir título, etc.)

Futuro com Claude MCP:

- Claude descobre e chama tools como:
  - `search_items`
  - `save_item`
  - `enrich_metadata`

### 5.3. Enrichment de Metadados

Mesma lógica que você já tinha, só explicitando services:

```text
┌──────────────┐      ┌─────────────────────────────┐
│ Classifier   │ ---> │ Enrichment Service         │
│ detectType() │      │                             │
└──────────────┘      │ ┌─────────┐   ┌─────────┐  │
                      │ │ TMDB    │   │ YouTube │  │
                      │ └─────────┘   └─────────┘  │
                      │      ┌───────────┐         │
                      │      │ OpenGraph │         │
                      │      └───────────┘         │
                      └─────────────────────────────┘
```

### 5.4. Salvamento e Resposta

```text
┌───────────────┐   ┌───────────┐   ┌──────────────────┐
│ Item Service  │-->| Postgres  │   │ Evolution API     │
│ create()      │   │ (Neon etc)│   │ sendMessage()     │
└───────────────┘   └───────────┘   └──────────────────┘
                         │
                         ▼
                     ┌──────────┐
                     │ WhatsApp │
                     └──────────┘
```

---

## 6. Exemplo de Fluxo Completo (Salvar Filme)

Mantendo seu cenário, só adaptando wording para AI‑agnostic.

```text
[Usuário no WhatsApp]
"os sete escolhidos"

[Webhook recebe]
POST /webhook/evolution
{
  "from": "5585999999999",
  "body": "os sete escolhidos",
  "messageId": "..."
}

[REST Adapter]

1. Chama ConversationService.getOrCreate(userId, chatId)
2. Adiciona mensagem do usuário em messages
3. Chama MessageHandler.processIncomingMessage(conversation, message)
```

Dentro do `MessageHandler`:

1. Recupera histórico recente (`conversation-service.getHistory()`)
2. Chama `ai-service.callLLMWithContext()` passando:
   - mensagem do usuário
   - histórico
   - instruções do sistema (ex: "Você é um assistente pessoal que classifica e salva itens (filmes, vídeos, links, notas)")
3. O modelo detecta que provavelmente é um filme.

### Caso com LLM + enrichment (conceito):

- AI responde (ou via tool/mensagem estruturada):  
  "Acho que você está falando de um filme, vou procurar 'os sete escolhidos'."

- `classifier-service.detectType()` → `"movie"`
- `enrichment-service.enrichMovieByTitle("os sete escolhidos")`
  - chama `TMDBService.searchMovie("os sete escolhidos")`
  - retorna múltiplos resultados

AI responde:

```text
"Achei 2 filmes:

1. Seven Samurai (1954) - Akira Kurosawa
2. The Magnificent Seven (2016) - Antoine Fuqua

Qual deles você quer salvar?"
```

Evolution envia essa resposta ao usuário.

Usuário responde:

```text
"o de 2016"
```

Novo ciclo:

- Conversa está em `state = awaiting_confirmation`
- Handler entende que a resposta resolve a escolha
- `enrichment-service.enrichMovieById(333484)`:
  1. `TMDBService.getMovieDetails(333484)`
  2. `TMDBService.getStreamingProviders(333484)`
- `item-service.createItem()` grava o item com metadata completo.

Resposta final ao usuário:

```text
"✅ Salvei 'The Magnificent Seven' (2016).
Disponível na Netflix e Amazon Prime!"
```

Tudo isso funciona com:

- Gemini (MVP) usando lógicas via prompt + JSON output
- Claude (futuro) usando MCP tools `search_items` e `save_item`

---

## 7. MCP Server Integration (Futuro / Não obrigatório)

Quando você decidir usar Claude + MCP, **não muda nada nos services**. Só cria um adapter MCP.

### 7.1 Resources

- `items://user/{userId}`  
  → lista todos os items do usuário

- `items://user/{userId}/type/{type}`  
  → items filtrados por tipo (`movie`, `video`, `link`, `note`…)

### 7.2 Tools

- `save_item`  
  → chama `item-service.createItem()`

- `search_items`  
  → chama `item-service.searchItems()`

- `update_item_status`  
  → chama `item-service.updateItem(id, { status })`

- `get_streaming_availability`  
  → chama `enrichment-service.enrichMovieById()` ou um subset disso

### 7.3 Prompts (conceituais)

- `categorize_item`

  - template para classificar items ambíguos (livro/filme/vídeo/link/nota)

- `enrich_metadata`
  - template para decidir se vale a pena chamar TMDB/YouTube/OG ou não

No MVP com Gemini, isso vira somente **"prompt templates internos"** dentro do `ai-service`.  
No futuro com Claude, viram **prompts do MCP Server**.

---

## 8. API REST (OpenAPI) – atualizada / serverless-friendly

Rotas conceituais (podem ser expostas por Fastify, Hono, Cloudflare Workers, etc).

Documentação via Scalar ou outra UI em `/docs`.

### 8.1 Rotas principais

```text
GET  /health                  # health check
GET  /docs                    # Scalar / OpenAPI UI

# Webhook WhatsApp (Evolution API)
POST /webhook/evolution       # Recebe mensagens WhatsApp

# Itens
GET    /items                 # Lista items (filtros: type, tags, status, userId)
GET    /items/:id             # Detalhes do item
POST   /items                 # Cria item manualmente
PATCH  /items/:id             # Atualiza item (status, tags, etc)
DELETE /items/:id             # Deleta item

POST   /items/search          # Busca avançada (full-text, filtros em metadata)
GET    /items/stats           # Estatísticas (total por tipo, por status, etc)

# Auth (se tiver painel / dashboard web)
GET /auth/*                   # Rotas gerenciadas por Auth.js / provider escolhido
```

Essas rotas podem ser implementadas em:

- Fastify + Bun (serverful ou serverless adaptado)
- Hono + Cloudflare Workers
- Express‑like em Lambdas

---

## 9. Estratégia de Evolução

1. **MVP (hoje)**

   - Gemini como LLM principal
   - REST Adapter + Webhook WhatsApp em Cloudflare Worker (ou Lambda)
   - PostgreSQL serverless (Neon / Supabase)
   - Services e schema iguais aos descritos aqui

2. **Fase 2 – Dashboards / Web UI**

   - Reusar as rotas `/items`, `/items/search`, `/items/stats`
   - Auth.js para login
   - Front React/Vue/Next ou o que você quiser

3. **Fase 3 – Claude + MCP (opcional)**
   - Adicionar MCP Server como novo adapter
   - Expor tools/resources chamando os mesmos services
   - Não tocar em `item-service`, `conversation-service`, `enrichment-service`

---

## 10. Benefícios da Arquitetura

- Você **não perde nada** do que já pensou (schemas, fluxos, cenários).
- Fica **livre de fornecedor** (Gemini hoje, Claude amanhã, outro depois).
- Funciona **em serverless** (Workers) sem precisar servidor 24/7.
- MCP vira só mais uma camada por cima, não um acoplamento rígido.
- Leitura futura fácil: este arquivo é o “mapa mental” do sistema.
