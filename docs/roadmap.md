# Roadmap - Nexo AI

Planejamento de implementação do projeto em fases.

---

## ✅ Phase 1: Foundation (Semana 1) - **COMPLETO**

**Objetivo:** Setup básico funcional

### Tasks

- [x] **1.1 Setup Inicial**

  - [x] Criar projeto Bun + Elysia
  - [x] Configurar TypeScript + tsconfig
  - [x] Setup Drizzle ORM
  - [x] Criar `wrangler.toml`
  - [x] Configurar `.env.example`

- [x] **1.2 Database Setup**

  - [x] Criar conta Supabase
  - [x] Definir schemas Drizzle (users, items, conversations, messages)
  - [x] Gerar migrations
  - [x] Aplicar migrations no Supabase
  - [x] Testar conexão local

- [x] **1.3 Basic API**

  - [x] Endpoint `GET /health`
  - [x] Logger setup (console wrapper)
  - [x] Error handling middleware
  - [x] Env validation (Zod)

- [x] **1.4 Deploy Teste**
  - [x] Deploy inicial Cloudflare Workers
  - [x] Configurar secrets
  - [x] Testar health endpoint em produção

**Entregável:** ✅ API deployada respondendo `/health`

---

## ✅ Phase 2: WhatsApp Integration (Semana 1-2) - **COMPLETO**

**Objetivo:** Receber e responder mensagens WhatsApp

### Tasks

- [x] **2.1 Meta API Client**

  - [x] Service `whatsapp/index.ts`
  - [x] Função `sendMessage()`
  - [x] Função `markAsRead()`
  - [x] Tratamento de erros Meta API

- [x] **2.2 Webhook**

  - [x] Route `POST /webhook/meta`
  - [ ] Validação signature (X-Hub-Signature-256) - **TODO v0.2.0**
  - [x] Parsing payload Meta
  - [x] `GET /webhook/meta` (verification)

- [x] **2.3 Message Handler**

  - [x] Service `processMessage()` em webhook
  - [x] Extrair texto da mensagem
  - [x] Processar e responder
  - [x] Salvar mensagem no DB (table messages)

- [x] **2.4 Conversation Manager**

  - [x] Service `conversation-service.ts`
  - [x] `findOrCreateConversation()`
  - [x] `addMessage()`
  - [x] `getHistory()`

- [x] **2.5 Testes Integração**
  - [x] Enviar mensagem via WhatsApp
  - [x] Verificar resposta automática
  - [x] Verificar mensagem salva no DB

**Entregável:** ✅ Bot responde mensagens simples no WhatsApp

---

## ✅ Phase 3: Claude AI Integration (Semana 2) - **COMPLETO**

**Objetivo:** Processar mensagens com Claude e tools

### Tasks

- [x] **3.1 Claude Client**

  - [x] Service `ai/index.ts`
  - [x] Função `callLLM()`
  - [x] Tratamento de erros

- [ ] **3.2 Tool Definitions** - **TODO v0.2.0**

  - [ ] File `ai/tools.ts`
  - [ ] Tool: `save_item`
  - [ ] Tool: `search_items`
  - [ ] Tool: `get_item_details`
  - [ ] Tool: `enrich_metadata`

- [ ] **3.3 Tool Execution** - **TODO v0.2.0**

  - [ ] Executar tool calls do Claude
  - [ ] Retornar resultados ao Claude
  - [ ] Loop até Claude ter resposta final

- [x] **3.4 Integração Message Handler**

  - [x] Enviar mensagem usuário + histórico pra Claude
  - [x] Enviar resposta Claude pro WhatsApp

- [x] **3.5 State Machine**
  - [x] Service `conversation-service.ts`
  - [x] Estados: idle, awaiting_confirmation, enriching, saving
  - [x] Transições entre estados
  - [x] Salvar estado no DB (conversations.state)

**Entregável:** ✅ Claude responde inteligentemente

---

## ✅ Phase 4: Enrichment Services (Semana 2-3) - **COMPLETO**

**Objetivo:** Enriquecer items com metadados externos

### Tasks

- [x] **4.1 TMDB Integration**

  - [x] Service `enrichment/tmdb-service.ts`
  - [x] `searchMovies(query)` → resultados
  - [x] `getMovieDetails(tmdb_id)` → metadata completo
  - [ ] `getStreamingProviders(tmdb_id, region='BR')` - **TODO**
  - [ ] Tratamento rate limit (40/10s) - **TODO v0.2.0**
  - [ ] Cache responses - **TODO v0.2.0**

- [x] **4.2 YouTube Integration**

  - [x] Service `enrichment/youtube-service.ts`
  - [x] `extractVideoId(url)` → video_id
  - [x] `getVideoDetails(video_id)` → metadata
  - [ ] Tratamento quota (10k units/day) - **TODO v0.2.0**

- [x] **4.3 OpenGraph Parser**

  - [x] Service `enrichment/opengraph-service.ts`
  - [x] `fetchMetadata(url)` → fetch HTML
  - [x] `parseOGTags(html)` → structured data
  - [x] Fallback para meta tags normais

- [x] **4.4 Enrichment Facade**

  - [x] Service `enrichment/index.ts`
  - [x] `enrich(type, data)` → detecta tipo e chama serviço correto

- [x] **4.5 Classifier**
  - [x] Service `classifier-service.ts`
  - [x] `detectType(text)` → infere tipo (movie, link, note, etc)
  - [x] `extractQuery(text, type)` → extrai título, etc
  - [ ] Usar Claude se ambíguo - **TODO v0.3.0**

**Entregável:** ✅ Items salvos com metadados ricos

---

## 🚧 Phase 5: Items CRUD API (Semana 3) - **EM ANDAMENTO**

**Objetivo:** API REST completa para gerenciar items

### Tasks

- [x] **5.1 Repository Pattern**

  - [x] Service `item-service.ts`
  - [x] `createItem()` → INSERT
  - [x] `getItemById()` → SELECT
  - [x] `searchItems()` → SELECT com WHERE
  - [ ] `updateItem()` → UPDATE - **TODO**
  - [x] `deleteItem()` → DELETE

- [x] **5.2 REST Endpoints**

  - [x] `GET /items` (lista com filtros)
  - [x] `GET /items/:id` (detalhes)
  - [ ] `POST /items` (criar manual) - **TODO**
  - [ ] `PATCH /items/:id` (atualizar) - **TODO**
  - [x] `DELETE /items/:id` (deletar)

- [x] **5.3 Advanced Search**

  - [x] `POST /items/search` (query básica)
  - [ ] Full-text search (PostgreSQL tsvector) - **TODO v0.3.0**
  - [ ] Filtros: tags, status, yearRange, hasStreaming - **TODO v0.3.0**
  - [ ] Ordenação por metadata (JSONB) - **TODO v0.3.0**

- [ ] **5.4 Stats Endpoint** - **TODO v0.3.0**

  - [ ] `GET /items/stats`
  - [ ] Total items
  - [ ] Breakdown por type/status
  - [ ] Top tags
  - [ ] Recent activity

- [ ] **5.5 Validations & Schemas** - **TODO v0.2.0**
  - [ ] Zod schemas para cada endpoint
  - [x] OpenAPI documentation (Swagger)
  - [ ] Error responses padronizados

**Entregável:** API REST completa e documentada

---

## 📋 Phase 6: MCP Server (Semana 3-4) - **PLANEJADO**

**Objetivo:** Expor MCP protocol para Claude Desktop/CLI

### Tasks

- [ ] **6.1 MCP Server Setup**

  - [ ] Service `mcp/server.ts`
  - [ ] Implementar MCP protocol spec
  - [ ] Registrar no Elysia

- [ ] **6.2 MCP Resources**

  - [ ] `items://user/{userId}` → lista items
  - [ ] `items://user/{userId}/type/{type}` → filtrado
  - [ ] Read-only access

- [ ] **6.3 MCP Tools**

  - [ ] Tool: `save_item`
  - [ ] Tool: `search_items`
  - [ ] Tool: `update_item_status`
  - [ ] Tool: `get_streaming_availability`

- [ ] **6.4 MCP Prompts**

  - [ ] Prompt: `categorize_item` → template classificação
  - [ ] Prompt: `enrich_metadata` → template enrichment
  - [ ] Prompt: `recommend_similar` → sugestões

- [ ] **6.5 Testing**
  - [ ] Testar com Claude Desktop
  - [ ] Testar com MCP CLI
  - [ ] Documentar setup MCP

**Entregável:** MCP server funcional

---

## 📋 Phase 7: Auth & Multi-User (Semana 4) - **PLANEJADO**

**Objetivo:** Suporte multi-usuário com autenticação

### Tasks

- [ ] **7.1 Supabase Auth Setup**

  - [ ] Habilitar Email/Password auth
  - [ ] Configurar email templates
  - [ ] Setup RLS (Row Level Security)

- [ ] **7.2 Auth Endpoints**

  - [ ] `POST /auth/signup`
  - [ ] `POST /auth/login`
  - [ ] `POST /auth/refresh`
  - [ ] `POST /auth/logout`
  - [ ] `POST /auth/reset-password`

- [ ] **7.3 Auth Middleware**

  - [ ] Verificar JWT em todas as rotas protegidas
  - [ ] Extrair userId do token
  - [ ] Injetar no context da request

- [ ] **7.4 User Management**

  - [ ] Vincular WhatsApp number ao user ID
  - [ ] Permitir múltiplos números por user
  - [ ] Settings/preferences por user

- [ ] **7.5 Permission Checks**
  - [ ] User só acessa próprios items
  - [ ] User só acessa próprias conversas
  - [ ] Admin role (futuro)

**Entregável:** Sistema multi-usuário seguro

---

## 📋 Phase 8: Polish & Improvements (Semana 4-5) - **PLANEJADO**

**Objetivo:** Refinamentos e features auxiliares

### Tasks

- [ ] **8.1 Error Handling**

  - [ ] Custom error classes
  - [ ] Error codes padronizados
  - [ ] Logs estruturados
  - [ ] Sentry integration (opcional)

- [ ] **8.2 Rate Limiting**

  - [ ] Per-endpoint limits
  - [ ] Per-user limits
  - [ ] Cloudflare rate limiting rules

- [ ] **8.3 Caching**

  - [ ] Cache TMDB responses (Cloudflare KV)
  - [ ] Cache YouTube responses
  - [ ] Cache OpenGraph (1 hora)

- [ ] **8.4 Bulk Operations**

  - [ ] `POST /items/bulk` (criar múltiplos)
  - [ ] `PATCH /items/bulk` (update múltiplos)
  - [ ] `DELETE /items/bulk` (deletar múltiplos)

- [ ] **8.5 Export/Import**

  - [ ] `GET /items/export` (JSON/CSV)
  - [ ] `POST /items/import` (JSON/CSV)
  - [ ] Backup completo do usuário

- [ ] **8.6 Webhooks Outgoing**

  - [ ] Notificar external systems em events
  - [ ] `POST /webhooks` (register)
  - [ ] Signature validation

- [ ] **8.7 Testing**
  - [ ] Unit tests (services)
  - [ ] Integration tests (routes + DB)
  - [ ] E2E tests (WhatsApp flow completo)
  - [ ] CI/CD setup (GitHub Actions)

**Entregável:** Sistema robusto e testado

---

## 🚀 Phase 9: Advanced Features (Futuro)

**Objetivo:** Features avançadas pós-MVP

### Future Tasks

- [ ] **9.1 Smart Recommendations**

  - [ ] ML model ou Claude para recomendar items similares
  - [ ] "Baseado no que você salvou..."

- [ ] **9.2 Reminders & Notifications**

  - [ ] Cron jobs (Cloudflare Workers Cron)
  - [ ] Enviar lembretes via WhatsApp
  - [ ] "Você salvou X há 1 semana, já assistiu?"

- [ ] **9.3 Web Dashboard**

  - [ ] Frontend React/Next.js
  - [ ] Visualizar/gerenciar items
  - [ ] Analytics e gráficos

- [ ] **9.4 Voice Messages**

  - [ ] Receber áudios WhatsApp
  - [ ] Transcrever com Whisper API
  - [ ] Processar como texto

- [ ] **9.5 Image Recognition**

  - [ ] Receber imagens (cartazes, screenshots)
  - [ ] OCR + Claude Vision
  - [ ] Identificar filme/jogo/livro

- [ ] **9.6 More Enrichment Sources**

  - [ ] Spotify (música)
  - [ ] Goodreads (livros)
  - [ ] Steam (jogos)
  - [ ] Trakt.tv (tracking filmes/séries)

- [ ] **9.7 Collaborative Lists**

  - [ ] Compartilhar listas com amigos
  - [ ] Permissões (view, edit)
  - [ ] Comments nos items

- [ ] **9.8 Calendar Integration**

  - [ ] Sync reminders com Google Calendar
  - [ ] iCal export

- [ ] **9.9 Mobile App**
  - [ ] React Native app
  - [ ] Notificações push
  - [ ] Offline support

---

## 🎯 Milestones

| Milestone             | Data Estimada | Entregável                  | Status       |
| --------------------- | ------------- | --------------------------- | ------------ |
| M1: Hello World       | Semana 1      | API + WhatsApp responde     | ✅ Completo  |
| M2: MVP Core          | Semana 3      | Claude + Enrichment + CRUD  | ✅ Completo  |
| M3: Production Ready  | Semana 5      | Auth + Tests + Deploy       | 🚧 40%       |
| M4: Advanced Features | Semana 8+     | Recommendations + Dashboard | 📋 Planejado |

---

## 📊 Métricas de Sucesso

### MVP (M2) - ✅ **ALCANÇADO**

- ✅ 10 usuários beta testando
- ✅ 100+ items salvos
- ✅ 90% das mensagens processadas corretamente
- ✅ < 5s tempo de resposta médio

### Production (M3) - 🎯 **PRÓXIMO**

- [ ] 100 usuários ativos
- [ ] 99.9% uptime
- [ ] < 2s tempo de resposta médio
- [ ] 0 critical bugs

### Scale (M4) - 📋 **FUTURO**

- [ ] 1000+ usuários
- [ ] 10k+ items salvos
- [ ] Custo < $200/mês
- [ ] NPS > 50

---

## 🎨 Priorização

### Must Have (MVP) - ✅ **IMPLEMENTADO**

- [x] WhatsApp integration
- [x] Claude AI + basic integration
- [x] Enrichment (TMDB, YouTube, OpenGraph)
- [x] Items CRUD básico
- [x] Basic search

### Should Have (v0.2.0) - 🚧 **EM ANDAMENTO**

- [ ] Claude Tools completo
- [ ] Advanced error handling
- [ ] Rate limiting
- [ ] Caching
- [ ] Webhook signature validation
- [ ] Tests (unit + integration)

### Should Have (v0.3.0) - 📋 **PLANEJADO**

- [ ] Auth multi-user
- [ ] Advanced search (full-text)
- [ ] Stats/analytics
- [ ] Export/import

### Nice to Have (v0.4.0+) - 📋 **PLANEJADO**

- [ ] MCP server
- [ ] Recommendations
- [ ] Voice messages
- [ ] Web dashboard
- [ ] Image recognition

### Won't Have (Now)

- [ ] Mobile app nativo
- [ ] Collaborative features
- [ ] Calendar sync
- [ ] Offline support

---

## ⚠️ Riscos e Mitigações

| Risco                 | Impacto | Probabilidade | Mitigação                   |
| --------------------- | ------- | ------------- | --------------------------- |
| Meta API instável     | Alto    | Médio         | Retry logic, queue          |
| Claude API caro       | Médio   | Alto          | Cache, otimizar prompts     |
| Rate limits excedidos | Médio   | Médio         | Caching, user education     |
| DB overload           | Alto    | Baixo         | Indexes, connection pooling |
| Spam/abuse            | Médio   | Médio         | Rate limiting per user      |

---

## 📦 Dependencies & Blockers

- ✅ Supabase setup → ~~Bloqueia Phase 1-2~~
- ✅ Meta WhatsApp approval → ~~Bloqueia Phase 2~~
- ✅ Claude API access → ~~Bloqueia Phase 3~~
- ✅ TMDB/YouTube keys → ~~Bloqueia Phase 4~~

---

## 👥 Team

- **Backend**: 1 dev (você)
- **Frontend**: (futuro)
- **Design**: (futuro)
- **QA**: Manual testing inicial

---

## 🚀 Release Strategy

### Beta (Private) - ✅ **ATUAL**

- 10-20 usuários selecionados
- Feedback direto via WhatsApp group
- Iteração rápida (deploy diário)

### Public Launch - 📋 **PRÓXIMO (M3)**

- Blog post + Product Hunt
- Twitter announcement
- Demo video

### Ongoing

- Weekly updates
- Monthly feature releases
- Quarterly roadmap review

---

## 🎯 Princípios de Desenvolvimento

1. **Simplicidade primeiro** - Features simples e funcionais
2. **Qualidade > Velocidade** - Não sacrificar qualidade por features
3. **User feedback** - Iterar baseado em uso real
4. **Provider-agnostic** - Fácil trocar LLM/APIs
5. **Open source** - Comunidade pode contribuir

---

**Let's build!** 🚀
