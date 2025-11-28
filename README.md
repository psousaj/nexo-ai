# Personal AI Assistant

Sistema de assistente pessoal via WhatsApp que salva, categoriza e enriquece automaticamente diferentes tipos de conteúdo usando modelos de IA (Claude, Gemini, etc.) e integração opcional via MCP, de forma desacoplada.

## 🚀 Stack

- **Runtime:** Bun
- **Framework:** Fastify + OpenAPI (via @fastify/swagger)
- **UI Docs:** Scalar
- **ORM:** Drizzle + PostgreSQL (JSONB para metadados flexíveis)
- **Auth:** Auth.js
- **WhatsApp:** Evolution API (self-hosted)
- **AI:** Claude / Gemini / OpenAI + MCP Server (opcional, plug-and-play)
- **Enrichment APIs:** TMDB, YouTube Data API, OpenGraph

---

# 📁 Estrutura do Projeto

```
personal-assistant/
├── src/
│   ├── index.ts
│   │
│   ├── config/
│   │   ├── env.ts
│   │   ├── swagger.ts
│   │   └── database.ts
│   │
│   ├── db/
│   │   ├── schema/
│   │   │   ├── items.ts
│   │   │   ├── users.ts
│   │   │   ├── conversations.ts
│   │   │   └── index.ts
│   │   ├── migrations/
│   │   └── seed.ts
│   │
│   ├── routes/
│   │   ├── webhook/
│   │   │   ├── evolution.ts
│   │   │   └── schema.ts
│   │   ├── items/
│   │   │   ├── index.ts
│   │   │   └── schema.ts
│   │   ├── auth/
│   │   │   └── index.ts
│   │   └── health.ts
│   │
│   ├── services/
│   │   ├── ai/
│   │   │   ├── claude.ts
│   │   │   └── tools.ts
│   │   │
│   │   ├── mcp/
│   │   │   ├── server.ts
│   │   │   ├── resources.ts
│   │   │   ├── tools.ts
│   │   │   └── prompts.ts
│   │   │
│   │   ├── whatsapp/
│   │   │   ├── evolution.ts
│   │   │   └── message-handler.ts
│   │   │
│   │   ├── enrichment/
│   │   │   ├── index.ts
│   │   │   ├── tmdb.ts
│   │   │   ├── youtube.ts
│   │   │   └── opengraph.ts
│   │   │
│   │   ├── conversation/
│   │   │   ├── manager.ts
│   │   │   └── state.ts
│   │   │
│   │   └── items/
│   │       ├── repository.ts
│   │       └── classifier.ts
│   │
│   ├── lib/
│   │   ├── logger.ts
│   │   ├── errors.ts
│   │   └── validators.ts
│   │
│   └── types/
│       ├── item.ts
│       ├── conversation.ts
│       └── api.ts
│
├── docker/
│   └── docker-compose.yml
│
├── drizzle.config.ts
├── .env.example
├── .env
├── package.json
├── tsconfig.json
├── bun.lockb
└── README.md
```

---

# 🧪 Testing Strategy

```
src/
├── __tests__/
│   ├── unit/
│   ├── integration/
│   └── e2e/
```

### Unit

- Testes isolados de serviços (mock de APIs externas)

### Integration

- Rotas + banco usando TestContainers

### E2E

- Fluxo completo WhatsApp → IA → Salvar item

---

# 📊 PostgreSQL JSONB Queries (Exemplos)

```sql
-- Buscar filmes de terror
SELECT * FROM items
WHERE type = 'movie'
  AND metadata @> '{"genres": ["Terror"]}';

-- Buscar por tag
SELECT * FROM items
WHERE tags @> '["react"]';

-- Full-text search
SELECT * FROM items
WHERE to_tsvector(metadata::text) @@ to_tsquery('netflix');
```

---

# 🔄 Conversational State Machine

```
idle → awaiting_confirmation → enriching → saving → idle
  ↓                               ↓
  └──────────── error ────────────┘
```

---

# 🔌 MCP (Opcional, Plug-and-Play)

- Resources:

  - `items://user/{userId}`
  - `items://user/{userId}/type/{type}`

- Tools:

  - `save_item`
  - `search_items`
  - `update_item_status`
  - `get_streaming_availability`

- Prompts:
  - `categorize_item`
  - `enrich_metadata`

---

# 📬 Webhook Flow (Resumido)

```
WhatsApp → Fastify → Conversation Manager → AI Model → Tools → Enrichment → DB → WhatsApp
```
