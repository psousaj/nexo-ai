# Nexo AI - Changelog

## [0.1.0] - 2026-01-06

### ✨ Implementação Inicial

#### Infraestrutura

- Configuração Bun + Elysia + Drizzle ORM
- Setup PostgreSQL com Supabase
- Validação de environment variables com Zod
- TypeScript configurado com path aliases

#### Database Schema

- `users` - Usuários WhatsApp
- `items` - Conteúdo organizado (movies, videos, links, notes)
- `conversations` - State machine de conversação
- `messages` - Histórico de mensagens
- Indexes GIN em JSONB para performance

#### Services

- **UserService** - CRUD de usuários
- **ItemService** - CRUD de items com busca semântica
- **ConversationService** - State machine (idle → awaiting_confirmation → enriching → saving)
- **ClassifierService** - Detecção automática de tipo de conteúdo
- **AIService** - Interface com Claude (provider-agnostic)
- **WhatsAppService** - Cliente Meta WhatsApp Business API
- **EnrichmentService**:
  - TMDB para filmes
  - YouTube Data API para vídeos
  - OpenGraph scraper para links

#### Routes/Adapters

- `POST /webhook/meta` - Webhook WhatsApp
- `GET /webhook/meta` - Verificação webhook
- `GET /items` - Lista items
- `GET /items/:id` - Busca item
- `POST /items/search` - Busca semântica
- `DELETE /items/:id` - Deleta item
- `GET /health` - Health check

#### Features

- ✅ Classificação automática de conteúdo
- ✅ Enriquecimento com metadados (TMDB, YouTube, OpenGraph)
- ✅ State machine para conversas multi-turn
- ✅ JSONB flexível para metadata por tipo
- ✅ Swagger/OpenAPI docs
- ✅ Error handling estruturado

#### Documentação

- README.md com quick start
- ARQUITETURA.md com diagramas e fluxos
- REFERENCIA.md com schemas e endpoints
- SETUP.md com environment variables
- DEPLOYMENT.md com guia Cloudflare Workers
- ESTRUTURA.md com organização do código
- ADRs (Architecture Decision Records):
  - 001: Cloudflare Workers
  - 002: Supabase PostgreSQL
  - 003: JSONB metadata
  - 004: State machine
  - 005: AI-agnostic architecture
  - 006: Meta WhatsApp API

### 🚧 TODO (Próximas versões)

- [ ] Testes unitários e integração
- [ ] Validação HMAC webhook signature
- [ ] Cache de resultados TMDB/YouTube
- [ ] Vector search para busca semântica real
- [ ] Suporte a mais tipos de conteúdo (podcasts, documentos)
- [ ] Dashboard web
- [ ] MCP (Model Context Protocol) server
- [ ] Rate limiting
- [ ] Retry logic para APIs externas
- [ ] Timeout handling para conversas antigas
- [ ] Suporte a áudio/imagem do WhatsApp
- [ ] Comandos especiais (/buscar, /listar, /deletar)

### 📝 Notas

- Todos os tipos estão implementados mas precisam de teste end-to-end
- Erros de compilação TypeScript são esperados até `bun install`
- Database precisa ser criado manualmente antes de `db:push`
