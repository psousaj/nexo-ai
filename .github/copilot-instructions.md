# Copilot Instructions - Nexo AI

## Visão Geral do Sistema

Assistente pessoal via WhatsApp que classifica, enriquece e organiza conteúdo (filmes, vídeos, links, notas) usando IA. Stack: **Bun + Elysia + Drizzle ORM + PostgreSQL + Meta WhatsApp API + Claude**.

### Arquitetura em Camadas

```
WhatsApp (Meta API) → REST Adapter → Services → PostgreSQL (Supabase)
                                    ↓
                              AI Service (Claude)
                              Enrichment APIs (TMDB/YouTube)
```

**Princípio fundamental**: Adapters são simples (traduzem requisições), Services contêm toda lógica de negócio.

> **Decisões Arquiteturais**: Ver [ADRs](../docs/adr/README.md) para contexto detalhado das escolhas técnicas

## Estrutura de Código

```
src/
├── routes/          # Endpoints HTTP (adapters)
├── services/        # Lógica de negócio
│   ├── ai/         # Claude API integration
│   ├── whatsapp/   # Meta WhatsApp API client
│   ├── enrichment/ # TMDB, YouTube, OpenGraph
│   ├── conversation/ # State machine + context
│   └── items/      # CRUD + classifier
├── db/
│   └── schema/     # Drizzle schemas (users, items, conversations, messages)
├── config/         # env, database, swagger
└── types/          # TypeScript definitions
```

## Padrões Críticos

### 1. State Machine de Conversação

Toda conversa segue estados: `idle → awaiting_confirmation → enriching → saving → idle`

- Estado e contexto persistidos em `conversations.state` e `conversations.context`
- `conversation-service` gerencia transições
- Ver [docs/ARQUITETURA.md](../docs/ARQUITETURA.md) para fluxo completo
- **Decisão**: Ver [ADR-004](../docs/adr/004-state-machine.md) para contexto da escolha

### 2. Metadata Flexível (JSONB)

Campo `items.metadata` varia por tipo:

- `movie`: `{tmdb_id, year, genres, streaming: [...], poster_url}`
- `video`: `{video_id, channel_name, duration, views}`
- `link`: `{url, og_title, og_description, og_image}`
- `note`: `{category, related_topics, priority}`

Ver estruturas completas em [docs/METADA.md](../docs/METADA.md) e [ADR-003](../docs/adr/003-jsonb-metadata.md)

### 3. Services são Provider-Agnostic

`ai-service` funciona com qualquer LLM (ver [ADR-005](../docs/adr/005-ai-agnostic.md)):

```typescript
// Hoje: Claude
// Amanhã: trocar provider sem mudar conversation/items/enrichment services
ai - service.callLLMWithContext({ message, history, context });
```

### 4. Enrichment Pipeline

Fluxo típico:

1. `classifier-service.detectType(message)` → identifica tipo
2. `enrichment-service.enrichMovieByTitle(title)` → busca TMDB
3. Retorna múltiplos resultados se ambíguo
4. AI confirma com usuário
5. `item-service.createItem()` salva com metadata completo

## Comandos Essenciais

```bash
# Setup inicial
bun install
cp .env.example .env
docker compose up -d  # Postgres local (se não usar Supabase)

# Database
bun run db:generate   # Gera migrations
bun run db:push       # Aplica no banco

# Desenvolvimento
bun run dev           # Inicia servidor (porta 3000)

# Build & Deploy
bun run build
wrangler deploy       # Cloudflare Workers
```

## Convenções do Projeto

### Nomenclatura

- **Services**: `conversation-service.ts`, `item-service.ts`
- **Funções**: `camelCase` com prefixos semânticos (`get`, `create`, `update`, `delete`)
- **Rotas**: kebab-case `/webhook/meta`, `/items/search`

### Drizzle ORM

```typescript
// Sempre use relações tipadas
import { users, items } from "@/db/schema";
// GIN indexes para JSONB queries
WHERE metadata @> '{"genres": ["Terror"]}'
```

### Error Handling

```typescript
// Services lançam erros específicos
throw new AppError("User message", 500, originalError);
// Adapters capturam e mapeiam para HTTP
```

### Environment Variables

- Validação via Zod em `config/env.ts`
- Secrets em produção via `wrangler secret put`
- Ver [docs/ENV.md](../docs/ENV.md)

## Integrações Externas

### Meta WhatsApp API

- Webhook: `POST /webhook/meta` valida signature `X-Hub-Signature-256`
- Client: `services/whatsapp/meta.ts` → `sendMessage()`, `markAsRead()`

### Claude API

- Tools definidos em `services/ai/tools.ts`: `save_item`, `search_items`, `enrich_metadata`
- Contexto montado em `conversation-service.getHistory()`

### TMDB/YouTube

- Rate limits: TMDB 40req/10s, YouTube 10k units/dia
- Cache recomendado (não implementado ainda)

## AI-Specific Guidelines

Ao gerar código neste projeto:

1. **Antes de implementar**: Verifique se já existe em `services/` ou pode ser reutilizado
2. **State machine**: Sempre atualize `conversations.state` via `conversation-service.updateState()`
3. **JSONB queries**: Use GIN indexes, não full scans
4. **Type safety**: Aproveite Drizzle types, evite `any`
5. **Testes**: Coloque em `src/__tests__/unit|integration|e2e`

### Exemplo: Adicionar novo tipo de item

```typescript
// 1. Adicionar tipo em types/item.ts
export type ItemType = ... | "podcast";

// 2. Definir metadata em docs/METADA.md
type PodcastMetadata = { episode: string; duration: number; ... }

// 3. Criar enrichment em services/enrichment/podcast.ts
export async function enrichPodcast(url: string): Promise<PodcastMetadata>

// 4. Atualizar classifier em services/items/classifier.ts
if (url.includes('spotify.com/show')) return 'podcast';

// 5. Integrar em enrichment/index.ts
case 'podcast': return enrichPodcast(data.url);
```

## Deployment

**Target**: Cloudflare Workers (serverless)

Limitações:

- CPU: 50ms (free) / 30s (paid)
- Memory: 128MB
- Use `waitUntil()` para operações assíncronas não-bloqueantes

Ver checklist completo em [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md)

## Documentação de Referência

- [README.md](../README.md) - Visão geral e quick start
- [docs/ARQUITETURA.md](../docs/ARQUITETURA.md) - Fluxos e decisões arquiteturais
- [docs/SCHEMA.md](../docs/SCHEMA.md) - Estrutura do banco
- [docs/ENDPOINTS.md](../docs/ENDPOINTS.md) - API REST completa
- [docs/ROADMAP.md](../docs/ROADMAP.md) - Features planejadas
- [docs/adr/](../docs/adr/README.md) - Architecture Decision Records

## MCP Integration (Futuro)

Quando implementar Model Context Protocol:

- **Resources**: `items://user/{userId}` (read-only)
- **Tools**: mapeiam para services existentes (`save_item` → `item-service.createItem()`)
- **Prompts**: templates para classificação e enrichment

MCP é **opcional** - sistema funciona sem ele.
