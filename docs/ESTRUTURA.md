# Estrutura do Projeto

```
nexo-ai/
├── src/
│   ├── config/
│   │   ├── env.ts              # Validação de environment vars
│   │   └── database.ts         # Setup Drizzle + Postgres
│   │
│   ├── db/
│   │   └── schema/
│   │       ├── users.ts        # Schema de usuários
│   │       ├── items.ts        # Schema de items (conteúdo)
│   │       ├── conversations.ts # Schema de conversas
│   │       ├── messages.ts     # Schema de mensagens
│   │       └── index.ts        # Export all schemas
│   │
│   ├── types/
│   │   └── index.ts            # TypeScript types
│   │
│   ├── services/
│   │   ├── user-service.ts     # CRUD de usuários
│   │   ├── item-service.ts     # CRUD de items
│   │   ├── conversation-service.ts # State machine
│   │   ├── classifier-service.ts   # Detecção de tipo
│   │   ├── ai/
│   │   │   └── index.ts        # Cliente AI (Claude)
│   │   ├── whatsapp/
│   │   │   └── index.ts        # Cliente WhatsApp
│   │   └── enrichment/
│   │       ├── tmdb-service.ts    # API TMDB
│   │       ├── youtube-service.ts # API YouTube
│   │       ├── opengraph-service.ts # OpenGraph scraper
│   │       └── index.ts        # Serviço unificado
│   │
│   ├── routes/
│   │   ├── health.ts           # Health check
│   │   ├── webhook.ts          # Webhook WhatsApp
│   │   └── items.ts            # REST API items
│   │
│   └── index.ts                # Entry point Elysia
│
├── docs/                       # Documentação
├── drizzle/                    # Migrations geradas
├── .env.example
├── package.json
├── tsconfig.json
├── drizzle.config.ts
└── README.md
```

## Fluxo de Dados

### 1. Mensagem Recebida

```
WhatsApp → POST /webhook/meta → processMessage()
```

### 2. Processamento

```typescript
// 1. Identifica/cria usuário
userService.findOrCreateUser(phoneNumber);

// 2. Busca conversação
conversationService.findOrCreateConversation(userId);

// 3. Classifica tipo
classifierService.detectType(message);

// 4. Enriquece conteúdo
enrichmentService.enrich(type, data);

// 5. Salva item
itemService.createItem({ ... });

// 6. Responde
whatsappService.sendMessage(phoneNumber, response);
```

## Comandos Úteis

```bash
# Instalar dependências
bun install

# Gerar migrations
bun run db:generate

# Aplicar migrations
bun run db:push

# Rodar em desenvolvimento
bun run dev

# Build para produção
bun run build

# Rodar produção
bun run start

# Abrir Drizzle Studio
bun run db:studio
```

## Variáveis de Ambiente

Ver [docs/SETUP.md](docs/SETUP.md) para detalhes de como obter cada credencial.

## State Machine

```
idle → awaiting_confirmation → enriching → saving → idle
  ↓                               ↓
  └────────────── error ──────────┘
```

Estados persistidos em `conversations.state`.

## Metadata JSONB

Campo flexível por tipo:

- **movie**: tmdb_id, genres, rating, streaming, etc
- **video**: video_id, platform, channel_name, duration
- **link**: url, og_title, og_description, og_image
- **note**: category, related_topics, priority

Ver [docs/REFERENCIA.md](docs/REFERENCIA.md) para estruturas completas.
