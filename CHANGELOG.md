# Nexo AI - Changelog

## [0.2.6] - 2026-01-11

### 🚀 Deploy & Production

#### Dockerfile Otimizado

- Compilação para binário usando `bun build --compile`
- Flags `--minify-whitespace` e `--minify-syntax` (preserva nomes de funções para OpenTelemetry)
- Base image `gcr.io/distroless/base` (20MB vs 100MB alpine)
- Target `bun-linux-x64` específico para Linux
- Suporte Railway via `PORT` env var dinâmico

#### Railway Support

- `PORT` agora é `z.coerce.number()` para aceitar env var do Railway
- Documentação completa em `docs/RAILWAY.md`
- Scripts `build:binary` e `start:binary` no package.json

### 🛡️ Error Handling

#### Robusto error handling no app.ts

- Handler específico para `VALIDATION`, `NOT_FOUND`, `PARSE` errors
- Stack traces apenas em development
- Logging estruturado com contexto completo
- Custom error responses seguindo patterns Elysia

### ✅ Testes Melhorados

#### Testes com app.handle()

- URLs completas (`http://localhost/path`) ao invés de paths relativos
- Teste adicional para 404 (rotas desconhecidas)
- Melhor cobertura de edge cases
- Segue patterns oficiais do Elysia

### 📚 Documentação

- `docs/RAILWAY.md` - Guia completo de deploy na Railway
- Troubleshooting de issues comuns
- Custos estimados e CI/CD setup

## [0.2.5] - 2026-01-10

### ✨ Novas Features

#### Observabilidade com OpenTelemetry + Uptrace

- Adicionado `@elysiajs/opentelemetry` para tracing distribuído
- Integração com Uptrace para visualização de traces
- Configuração condicional via `UPTRACE_DSN` env var
- BatchSpanProcessor para envio otimizado de spans
- Documentação completa em `docs/OPENTELEMETRY.md`

#### API Documentation com Scalar UI

- Migrado de `@elysiajs/swagger` para `@elysiajs/openapi`
- Interface Scalar UI moderna e interativa em `/reference`
- Melhor experiência de navegação na documentação

#### Gemini SDK Integration

- Migrado de API REST para SDK oficial `@google/generative-ai`
- Simplificação do código (216 → 86 linhas em gemini-provider.ts)
- Melhor suporte a function calling
- Manutenção do fallback automático para Cloudflare Workers AI

#### Testes

- Criados testes básicos com Bun Test
- Testes de endpoints (health, items)
- Testes de fallback AI (Gemini → Cloudflare)
- Coverage dos fluxos críticos

### 🔧 Melhorias

- Código mais limpo com SDK ao invés de fetch manual
- Redução de dependências (removido swagger)
- Melhor type safety com SDK oficial do Gemini

## [0.1.1] - 2026-01-06

### 🔧 Melhorias

#### Validação com Zod

- Migração completa de TypeBox para Zod schemas
- Criado arquivo centralizado de schemas (`src/schemas/index.ts`)
- Schemas validados para todas as rotas:
  - Webhook Meta (verificação e payload)
  - Items (listagem, busca, criação, deleção)
- Type inference automática com `z.infer`
- Validação robusta com coerção de tipos (ex: `z.coerce.number()`)
- Correção de bugs de tipagem no user-service e webhook

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
