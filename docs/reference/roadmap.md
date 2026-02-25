# Roadmap - Nexo AI

Planejamento simplificado de implementação em fases evolutivas.

---

## ✅ v0.1.0 - Foundation (Completo)

**Entregas:**

- Setup Bun + Elysia + Drizzle + PostgreSQL (Supabase)
- Deploy Cloudflare Workers funcional
- Multi-provider messaging (Telegram + WhatsApp preparado)
- Multi-AI (Gemini default, Claude fallback)
- Conversation service + state machine básica
- Enrichment services (TMDB, YouTube, OpenGraph)
- Items CRUD básico

**Estado:** ✅ Deployado e funcional

---

## ✅ v0.2.0 - Core Features (Concluído - 11/01/2026)

**Objetivo:** Completar funcionalidades críticas para MVP funcional

### ✅ Implementado

#### 🛠️ Tool Calling System

- 11 tools específicas com contratos fortes
- Integração com Gemini (SDK nativo)
- Fluxo completo: mensagem → tool call → execução → resposta

#### 🔒 Security - Telegram Webhook Validation

- Validação via `X-Telegram-Bot-Api-Secret-Token`

#### 💬 Conversa Única Cross-Provider

- `user-accounts` table para unificação
- Mesmo usuário em Telegram/WhatsApp = mesma biblioteca

#### 🎯 Intent Classification System

- 8 intents implementados (save_note, list_items, delete_items, etc)

#### 🗑️ Delete Operations

- Delete item específico com confirmação
- Delete múltiplos items
- Delete all com confirmação obrigatória

#### 📝 State Machine & Context Management

- State machine manual (idle, awaiting_confirmation)
- Contexto persistido no banco
- Confirmações para operações críticas

**Estado:** ✅ Concluído e deployado

---

## ✅ v0.3.0 - Polish & Reliability (Concluído - 11/01/2026)

**Objetivo:** Refinamentos e features de qualidade

### ✅ Implementado

#### 🛡️ Error Handling Robusto

- Retry logic com exponential backoff
- Logs estruturados com contexto
- Fallback gracioso em enrichment APIs

#### 💾 Cache Layer (Upstash Redis)

- Redis client configurado
- Cache em TMDB (24h TTL)
- Cache em YouTube (12h TTL)
- Cache em OpenGraph (24h TTL)
- Fallback silencioso se Redis não configurado

#### 🔍 Advanced Search

- Método `advancedSearch()` em `item-service`
- Filtros JSONB: yearRange, hasStreaming, minRating, genres
- Ordenação por: created, rating, year
- Full-text search em títulos

#### 📦 Batch Processing Melhorado

- Progresso visual: `[2/5]` em cada etapa
- Skip automático em erros de API

**Estado:** ✅ Concluído e deployado

---

## ✅ v0.3.2 - Semantic Search Optimization (Concluído - 19/01/2026)

**Objetivo:** Melhorar precisão da busca semântica via document enrichment

### ✅ Implementado

#### 🔥 Document Enrichment Strategy

- TMDB keywords incluídos no embedding
- Overview/sinopse completo no documento semântico
- Tagline, genres, director, cast (top 3)

#### 🔍 Query Expansion

- Serviço `query-expansion.ts` com mapa semântico PT-BR ↔ EN
- 15+ categorias (sonho, espacial, máfia, ação, terror, ficção)
- Expansão automática antes de gerar embedding

#### 📊 Resultados

- **+14.8% de melhoria** no similarity score
- Precision@1: 0% → 100%
- Gap 1º vs 2º: 0.7% → 6.2% (8.9x melhoria)

#### 🧪 Cosine Similarity com ai SDK

- Migrado de Drizzle `cosineDistance` para Vercel `ai.cosineSimilarity`
- Battle-tested (usado por milhares de projetos)
- Debugabilidade melhorada

**Estado:** ✅ Produção-ready

---

## ✅ v0.4.0 - OpenClaw Patterns (Concluído - 16/02/2026)

**Objetivo**: Implementar padrões OpenClaw para memória persistente e personalização de agente.

### ✅ Implementado

#### 🔑 Session Key Architecture

- Sistema de chaves de sessão para contexto de conversação
- Formato: `{agentId}:{channel}:{accountId}:{peerKind}:{peerId}:{dmScope}`
- Suporte a múltiplas contas por provider
- Isolamento de contexto por peer (DMs, grupos, canais)

> Ver [ADR-016: Session Key Architecture](../adr/016-session-key-architecture.md)

#### 🤖 Agent Profile System

- Personalização via arquivos markdown (AGENTS.md, SOUL.md, IDENTITY.md, USER.md)
- Campos de personalidade: emoji, creature, tone, vibe
- Context builder que agrupa perfis e injeta no LLM
- Dashboard UI para edição de perfis

> Ver [ADR-017: Agent Profile System](../adr/017-agent-profile-system.md)

#### 🔍 Hybrid Memory Search

- Combinação de busca vetorial (pgvector) + busca por palavras-chave (PostgreSQL FTS)
- Múltiplas estratégias de merge: weighted, average, reciprocal_rank_fusion
- Configuração de pesos: vectorWeight (0.7) + textWeight (0.3)
- Tools: memory_search, memory_get, daily_log_search

> Ver [ADR-018: Hybrid Memory Search](../adr/018-hybrid-memory-search.md)

#### 📊 Database Schema Updates

- Tabela `agent_sessions` - gerenciamento de sessões OpenClaw
- Tabela `agent_memory_profiles` - perfis de memória por sessão
- Tabela `session_transcripts` - transcrições de sessões
- Tabela `agent_daily_logs` - logs diários do agente
- Campos de personalidade em `users`: assistant_emoji, assistant_creature, assistant_tone, assistant_vibe

#### 🎨 Dashboard UI

- Editor de perfil de agente (AGENTS.md, SOUL.md, IDENTITY.md, USER.md)
- Visualizador de sessões com export JSONL
- Dashboard de busca de memória
- Gerenciador de daily logs
- Visualização de session keys

#### 🧪 Tests

- session-service.test.ts
- context-builder.test.ts
- chat-commands.test.ts
- memory-search.test.ts
- discord-adapter.test.ts
- telegram-adapter-mention-gating.test.ts

**Estado:** ✅ Concluído e deployado

---

## ✅ v0.5.0 - Advanced Features (Concluído - 18/02/2026)

**Objetivo:** Features que agregam valor e observabilidade

### ✅ Implementado

#### 📊 Stats & Analytics

- Endpoint `/analytics` com KPIs, trends, breakdown
- Analytics service completo
- Dashboard com gráficos e métricas

#### 🛡️ Observability Avançada (Sentry v10)

- Sentry v10.39.0 com Logs estruturados (`Sentry.logger`)
- Node Profiling (`@sentry/profiling-node`)
- Métricas customizadas (`Sentry.metrics.count/gauge/distribution`)
- Sourcemaps upload automático no build (`@sentry/esbuild-plugin`)
- `consoleLoggingIntegration` para captura de console.log
- Filtros de dados sensíveis (cookies, authorization headers)
- Helpers: `sentryLogger`, `sentryMetrics`, `incrementCounter`, `recordTiming`

### 🟡 Pendente

- [ ] **Rate Limiting**
  - Limite: 5 mensagens/minuto por usuário via Redis
  - Resposta amigável quando exceder

#### 🟡 Próximo Passo Imediato: Feature Flags & Runtime Controls

- [ ] **Service Instrumentation Feature Flag**
  - `SERVICE_INSTRUMENTATION_ENABLED` para ligar/desligar tracing/log por serviço sem deploy
  - Allowlist/blocklist por env para reduzir ruído operacional

- [ ] **Tools Runtime Flags**
  - Habilitar/desabilitar categorias e tools críticas em tempo de execução
  - Endpoint admin para visualizar estado efetivo das flags

- [ ] **Onboarding/Trial Flags**
  - `ONBOARDING_TRIAL_LIMIT` e controles por provider (WhatsApp/Telegram)
  - Evitar constante fixa para ajuste operacional rápido

- [ ] **Email Confirmation Flags**
  - `EMAIL_CONFIRMATION_REQUIRED` e kill-switch de envio (`EMAIL_SEND_ENABLED`)
  - Rate limit de reenvio configurável

**Estado:** ✅ Parcialmente concluído (Rate Limiting pendente)

---

## 🔵 v0.6.0 - Integrations (Planejado)

**Objetivo:** Integrar com produtividade e calendário

### Google Calendar Integration

**Use Case:** "reunião com joão amanhã às 15h" → cria evento

### Microsoft To Do Integration

**Use Case:** "lembrar de ligar pro dentista quinta" → cria task

---

## 🔵 v0.7.0 - Performance Optimization (Planejado)

**Objetivo:** Otimizações para escala

- [ ] **Cache de Query Embeddings**
  - Cache queries frequentes ("filmes de ação", "séries de comédia")
  - Invalidação inteligente quando novos items são salvos

- [ ] **Hybrid Search (pgvector + cosineSimilarity)**
  - pgvector filtra top 100 candidatos (rápido)
  - `ai.cosineSimilarity` ranqueia top 10 finais (preciso)

---

## 🎨 v1.0 - Production Ready (Release Completo)

**Objetivo:** Sistema pronto para escala e público geral

### Core Features

- [ ] **Auth Multi-User**
  - Supabase Auth (Email/Password)
  - RLS (Row Level Security)

- [ ] **Web Dashboard**
  - Visualizar/gerenciar items
  - Analytics e gráficos

- [ ] **Testing & CI/CD**
  - Unit tests, integration tests, E2E tests
  - GitHub Actions pipeline

- [ ] **Monitoring & Observability**
  - Cloudflare Analytics
  - Error tracking (Sentry opcional)

---

## 🔮 v2.0+ - Advanced & Nice-to-Have (Longo Prazo)

- [ ] Fine-tuning de Embedding Model
- [ ] Voice Messages (Whisper API)
- [ ] Image Recognition (OCR + Claude Vision)
- [ ] More Enrichment Sources (Spotify, Goodreads, Steam)
- [ ] Telegram Interactive UI (Inline keyboards)
- [ ] Smart Recommendations
- [ ] Reminders & Notifications
- [ ] Collaborative Lists
- [ ] Export/Import

---

## 📊 Métricas de Sucesso

### MVP (v0.2.0)

- ✅ 10 usuários beta testando
- ✅ 100+ items salvos
- [ ] 95%+ das mensagens processadas corretamente
- [ ] < 2s tempo de resposta médio
- [ ] Zero crashes críticos em 1 semana

### Production (v1.0)

- [ ] 100 usuários ativos
- [ ] 99.9% uptime
- [ ] < 1s tempo de resposta médio
- [ ] 0 critical bugs
- [ ] NPS > 50

### Scale (v2.0+)

- [ ] 1000+ usuários
- [ ] 10k+ items salvos
- [ ] Custo < $200/mês
- [ ] API pública com documentação

---

## 💰 Estimativa de Custos (Mensal)

### Free Tier (Atual - até 100 usuários)

| Serviço               | Plano     | Custo     |
| --------------------- | --------- | --------- |
| Cloudflare Workers    | Free      | $0        |
| Supabase              | Free      | $0        |
| Gemini API            | Free tier | $0        |
| Claude API (fallback) | Pay-as-go | ~$2-5     |
| **Total**             |           | **~$2-5** |

### Paid Tier (100-1000 usuários)

| Serviço            | Plano     | Custo       |
| ------------------ | --------- | ----------- |
| Cloudflare Workers | Paid      | $5          |
| Supabase           | Pro       | $25         |
| Gemini API         | Pay-as-go | ~$10-20     |
| **Total**          |           | **~$50-65** |

---

## 🎯 Princípios de Desenvolvimento

1. **Simplicidade primeiro** - Features simples e funcionais > complexidade prematura
2. **Deploy early, deploy often** - Iteração rápida com feedback real
3. **User feedback drives roadmap** - Não assumir necessidades
4. **Provider-agnostic** - Fácil trocar LLM/APIs/Services
5. **Cost-conscious** - Otimizar para Free tier Cloudflare
6. **Security by design** - Validações desde o início

---

**Última atualização**: 18 de fevereiro de 2026 (v0.5.0 - Advanced Features + Observability)
