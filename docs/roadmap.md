## Roadmap de Implementação

### Phase 1: Foundation (Semana 1)

- [ ] Setup inicial Bun + Fastify + Drizzle
- [ ] Schema do banco + migrations
- [ ] Configuração OpenAPI/Scalar
- [ ] Docker Compose (Postgres + Evolution API)
- [ ] Endpoint /health
- [ ] Logger setup (Pino)

### Phase 2: WhatsApp Integration (Semana 1-2)

- [ ] Evolution API client (send/receive)
- [ ] Webhook /webhook/evolution
- [ ] Message handler básico
- [ ] Conversation manager (state machine)
- [ ] Resposta automática simples

### Phase 3: Claude AI Integration (Semana 2)

- [ ] Claude API client
- [ ] Definição das Tools
- [ ] Integration Claude + Conversation context
- [ ] Tratamento de respostas e tool calls
- [ ] Fluxo de confirmação (ambiguidade)

### Phase 4: Enrichment Services (Semana 2-3)

- [ ] TMDB integration
  - [ ] Search movies/series
  - [ ] Get details
  - [ ] Streaming providers (JustWatch via TMDB)
- [ ] YouTube integration
  - [ ] Extract video ID
  - [ ] Get video metadata
- [ ] OpenGraph parser
  - [ ] Fetch URL metadata
  - [ ] Extract OG tags

### Phase 5: Items CRUD (Semana 3)

- [ ] Item repository (Drizzle)
- [ ] REST endpoints (/items/\*)
- [ ] Advanced search (filters, full-text)
- [ ] Status management
- [ ] Stats endpoint

### Phase 6: MCP Server (Semana 3-4)

- [ ] MCP protocol implementation
- [ ] Resources (read items)
- [ ] Tools (save, search, update)
- [ ] Prompts (templates)
- [ ] Integration com Claude tools

### Phase 7: Auth & Multi-user (Semana 4)

- [ ] Auth.js setup
- [ ] GitHub/Google OAuth
- [ ] User management
- [ ] Permission checks
- [ ] Multi-user conversation isolation

### Phase 8: Improvements (Semana 4-5)

- [ ] Item classifier ML (opcional)
- [ ] Bulk operations
- [ ] Export/import data
- [ ] Webhook retry logic
- [ ] Rate limiting
- [ ] Monitoring/observability

### Phase 9: Advanced Features (Futuro)

- [ ] Smart recommendations
- [ ] Reminders via cron
- [ ] Web dashboard (frontend)
- [ ] Voice messages support
- [ ] Image recognition (cartazes, screenshots)
- [ ] More enrichment sources (Spotify, Goodreads, etc)
