Personal AI Assistant
Sistema de assistente pessoal via WhatsApp que salva, categoriza e enriquece automaticamente diferentes tipos de conteúdo usando Claude AI e MCP.
Stack

Runtime: Bun
Framework: Fastify + OpenAPI (via @fastify/swagger)
UI Docs: Scalar
ORM: Drizzle + PostgreSQL (JSONB para metadados flexíveis)
Auth: Auth.js
WhatsApp: Evolution API (self-hosted)
AI: Claude API + MCP Server
Enrichment APIs: TMDB, YouTube Data API, OpenGraph

Estrutura do Projeto
personal-assistant/
├── src/
│ ├── index.ts # Entry point do Fastify
│ │
│ ├── config/
│ │ ├── env.ts # Validação de env vars (zod)
│ │ ├── swagger.ts # Config OpenAPI/Scalar
│ │ └── database.ts # Drizzle client
│ │
│ ├── db/
│ │ ├── schema/
│ │ │ ├── items.ts # Schema principal de itens
│ │ │ ├── users.ts # Usuários (Auth.js)
│ │ │ ├── conversations.ts # Histórico de conversas WhatsApp
│ │ │ └── index.ts # Export all schemas
│ │ ├── migrations/ # SQL migrations geradas
│ │ └── seed.ts # Dados iniciais
│ │
│ ├── routes/
│ │ ├── webhook/
│ │ │ ├── evolution.ts # POST /webhook/evolution - recebe mensagens
│ │ │ └── schema.ts # Schemas OpenAPI do webhook
│ │ ├── items/
│ │ │ ├── index.ts # CRUD de itens
│ │ │ │ # GET /items - lista com filtros
│ │ │ │ # GET /items/:id - detalhes
│ │ │ │ # POST /items - criar manual
│ │ │ │ # PATCH /items/:id - atualizar
│ │ │ │ # DELETE /items/:id - deletar
│ │ │ └── schema.ts # Schemas OpenAPI
│ │ ├── auth/
│ │ │ └── index.ts # Auth.js routes
│ │ └── health.ts # GET /health
│ │
│ ├── services/
│ │ ├── ai/
│ │ │ ├── claude.ts # Cliente Claude API
│ │ │ │ # - sendMessage()
│ │ │ │ # - processWithTools()
│ │ │ └── tools.ts # Definição das Tools pro Claude
│ │ │ # - save_item
│ │ │ # - search_items
│ │ │ # - get_item_details
│ │ │ # - enrich_metadata
│ │ │
│ │ ├── mcp/
│ │ │ ├── server.ts # MCP Server implementation
│ │ │ ├── resources.ts # MCP Resources (leitura de items)
│ │ │ ├── tools.ts # MCP Tools (ações)
│ │ │ └── prompts.ts # MCP Prompts (templates)
│ │ │
│ │ ├── whatsapp/
│ │ │ ├── evolution.ts # Cliente Evolution API
│ │ │ │ # - sendMessage()
│ │ │ │ # - sendTyping()
│ │ │ └── message-handler.ts # Processa mensagens recebidas
│ │ │ # - Detecta tipo de conteúdo
│ │ │ # - Mantém contexto da conversa
│ │ │ # - Orquestra Claude + enrichment
│ │ │
│ │ ├── enrichment/
│ │ │ ├── index.ts # Facade pattern - detecta tipo e enriquece
│ │ │ ├── tmdb.ts # TMDB API
│ │ │ │ # - searchMovie()
│ │ │ │ # - getMovieDetails()
│ │ │ │ # - getStreamingProviders()
│ │ │ ├── youtube.ts # YouTube Data API
│ │ │ │ # - getVideoDetails()
│ │ │ │ # - extractVideoId()
│ │ │ └── opengraph.ts # OpenGraph parser
│ │ │ # - fetchMetadata()
│ │ │ # - parseOGTags()
│ │ │
│ │ ├── conversation/
│ │ │ ├── manager.ts # Gerencia contexto de conversas
│ │ │ │ # - getOrCreateConversation()
│ │ │ │ # - addMessage()
│ │ │ │ # - getHistory()
│ │ │ └── state.ts # State machine para fluxos
│ │ │ # Estados: idle, awaiting_confirmation,
│ │ │ # enriching, saving
│ │ │
│ │ └── items/
│ │ ├── repository.ts # Data access layer
│ │ │ # - create()
│ │ │ # - findById()
│ │ │ # - search() - queries complexas
│ │ │ # - update()
│ │ └── classifier.ts # Classifica tipo de item
│ │ # - detectType()
│ │ # - extractEntities()
│ │
│ ├── lib/
│ │ ├── logger.ts # Pino logger
│ │ ├── errors.ts # Custom error classes
│ │ └── validators.ts # Zod schemas reutilizáveis
│ │
│ └── types/
│ ├── item.ts # Tipos de items e metadata
│ ├── conversation.ts # Tipos de conversação
│ └── api.ts # Tipos das APIs externas
│
├── docker/
│ └── docker-compose.yml # Postgres + Evolution API
│
├── drizzle.config.ts # Configuração Drizzle Kit
├── .env.example
├── .env
├── package.json
├── tsconfig.json
├── bun.lockb
└── README.md

## Testing Strategy

```
src/
├── __tests__/
│   ├── unit/
│   │   ├── services/
│   │   │   ├── tmdb.test.ts
│   │   │   ├── youtube.test.ts
│   │   │   └── classifier.test.ts
│   │   └── lib/
│   │       └── validators.test.ts
│   │
│   ├── integration/
│   │   ├── routes/
│   │   │   ├── items.test.ts
│   │   │   └── webhook.test.ts
│   │   └── services/
│   │       └── claude.test.ts
│   │
│   └── e2e/
│       └── whatsapp-flow.test.ts

Unit: Services isolados (mock APIs externas)
Integration: Rotas + DB (testcontainers Postgres)
E2E: Fluxo completo WhatsApp → Salvar item

Observações Importantes
PostgreSQL JSONB Queries
sql-- Buscar filmes de terror
SELECT * FROM items
WHERE type = 'movie'
  AND metadata @> '{"genres": ["Terror"]}';

-- Buscar items com tag específica
SELECT * FROM items
WHERE tags @> '["react"]';

-- Full-text search em metadata
SELECT * FROM items
WHERE to_tsvector(metadata::text) @@ to_tsquery('netflix');
```

### Rate Limiting APIs

- **TMDB**: 40 req/10s (grátis)
- **YouTube**: 10k units/day (quota system)
- **Claude**: Varia por tier

Implementar cache Redis (futuro) para reduzir chamadas.

### State Machine de Conversação

```
idle → awaiting_confirmation → enriching → saving → idle
  ↓                               ↓
  └─────────── error ─────────────┘
```
