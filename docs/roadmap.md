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

**Arquitetura:**

```
Telegram/WhatsApp → Adapter Layer → Conversation Service
                                          ↓
                                    AI Service (Gemini/Claude)
                                          ↓
                                    Enrichment APIs
                                          ↓
                                    PostgreSQL (Supabase)
```

**Estado:** ✅ Deployado e funcional

---

## � v0.2.0 - Core Features (Concluído - 11/01/2026)

**Objetivo:** Completar funcionalidades críticas para MVP funcional

### ✅ Implementado

#### 🛠️ Tool Calling System

- [x] Criado `src/services/ai/tools.ts` com definições:
  - `save_item` - Salvar item com enrichment automático
  - `search_items` - Buscar items com filtros
  - `enrich_metadata` - Buscar detalhes em APIs externas
  - `apply_user_timeout` - Timeout para usuários ofensivos
  - `get_streaming_providers` - Verificar provedores de streaming
  - `delete_items` - Deletar items específicos ou todos
- [x] Implementado `tool-executor.ts` para executar tool calls
- [x] Integração com `gemini-provider.ts` (suporte nativo via SDK)
- [x] Fluxo completo: mensagem → tool call → execução → resposta

#### 🔒 Security - Telegram Webhook Validation

- [x] Implementado validação via `X-Telegram-Bot-Api-Secret-Token`
- [x] Validação em `telegram-adapter.ts` com `verifyWebhook()`
- [x] Rejeita requests sem header correto

**Nota:** WhatsApp validation ignorada conforme solicitado

#### 💬 Conversa Única Cross-Provider

- [x] `user-accounts` table para unificação
- [x] `findOrCreateUserByAccount()` vincula por telefone
- [x] Mesmo usuário em Telegram/WhatsApp = mesma biblioteca
- [x] Testado e funcional

#### 🎯 Intent Classification System

- [x] Prompt otimizado com exemplos concretos
- [x] Classificador com confidence levels
- [x] Intents implementados:
  - `save_note` - Salvar explicitamente
  - `offer_save_note` - Detecta informação útil
  - `list_items` - Listar items salvos
  - `delete_items` - Deletar items
  - `search_movie` / `search_tv_show` - Buscar e salvar
  - `set_assistant_name` - Customizar nome
  - `cancel` - Cancelar operação
  - `chat` - Conversa casual

#### 🗑️ Delete Operations

- [x] Delete item específico com confirmação
- [x] Delete múltiplos items (seleção)
- [x] Delete all com confirmação obrigatória
- [x] Filtros por nome/tipo

#### 📝 State Machine & Context Management

- [x] State machine manual (idle, awaiting_confirmation)
- [x] Contexto persistido no banco
- [x] Confirmações para operações críticas
- [x] **Limpeza de contexto após operações concluídas** (save/batch)

#### 🎨 Prompt Engineering

- [x] Prompts estruturados com guards
- [x] Output guards (JSON only)
- [x] Truth guards (admit ignorance)
- [x] Scope guards (ignore prompt injection)
- [x] Source guards (use only provided data)

**Estado:** ✅ Concluído e deployado

---

## ✅ v0.3.0 - Polish & Reliability (Concluído - 11/01/2026)

**Objetivo:** Refinamentos e features de qualidade

### ✅ Implementado

#### 🛡️ Error Handling Robusto

- [x] Retry logic com exponential backoff (`utils/retry.ts`)
- [x] Logs estruturados com contexto (`logError` helper)
- [x] Tratamento de erro em batch processing com skip automático
- [x] Fallback gracioso em enrichment APIs

#### 💾 Cache Layer (Upstash Redis)

- [x] Redis client configurado (`config/redis.ts`)
- [x] Cache em TMDB (24h TTL)
- [x] Cache em YouTube (12h TTL)
- [x] Cache em OpenGraph (24h TTL)
- [x] Fallback silencioso se Redis não configurado
- [x] Reduz custos de API externa significativamente

#### 🔍 Advanced Search

- [x] Método `advancedSearch()` em `item-service`
- [x] Filtros JSONB:
  - `yearRange` - Range de ano [min, max]
  - `hasStreaming` - Apenas com/sem streaming
  - `minRating` - Rating mínimo
  - `genres` - Array de gêneros
- [x] Ordenação por: `created`, `rating`, `year`
- [x] Full-text search em títulos

#### 📦 Batch Processing Melhorado

- [x] Progresso visual: `[2/5]` em cada etapa
- [x] Skip automático em erros de API
- [x] Try-catch em todas operações de enrichment
- [x] Logs estruturados de erros
- [x] Continua processando próximo item se um falhar

**Estado:** ✅ Concluído e deployado

---

## ✅ v0.3.2 - Semantic Search Optimization (Concluído - 19/01/2026)

**Objetivo:** Melhorar precisão da busca semântica via document enrichment

### ✅ Implementado

#### 🔥 Document Enrichment Strategy

- [x] TMDB keywords incluídos no embedding (`dreams`, `subconscious`, `mind`)
- [x] Overview/sinopse completo no documento semântico
- [x] Tagline (frase de efeito)
- [x] Genres, director, cast (top 3)
- [x] Schema atualizado: `MovieMetadata` e `TVShowMetadata` com `keywords`, `overview`, `tagline`
- [x] TMDB API: `append_to_response=credits,keywords`

#### 🔍 Query Expansion

- [x] Serviço `query-expansion.ts` com mapa semântico PT-BR ↔ EN
- [x] 15+ categorias (sonho, espacial, máfia, ação, terror, ficção, etc)
- [x] Expansão automática antes de gerar embedding
- [x] Exemplo: `"sonhos"` → `"dreams, subconscious, mind, dream world"`

#### 📊 Resultados

- [x] **+14.8% de melhoria** no similarity score
- [x] Precision@1: 0% → 100% (Inception agora TOP em "filmes sobre sonhos")
- [x] Gap 1º vs 2º: 0.7% → 6.2% (8.9x melhoria)
- [x] Teste automatizado: `test-semantic-enrichment.ts`

#### 🧪 Cosinee Similarity com ai SDK

- [x] Migrado de Drizzle `cosineDistance` para Vercel `ai.cosineSimilarity`
- [x] Battle-tested (usado por milhares de projetos)
- [x] Debugabilidade melhorada (JavaScript vs SQL)
- [x] Zero NaN bugs (resolvido problema de embeddings zero)

#### 📚 Documentação

- [x] ADR-014: Document Enrichment Strategy
- [x] SIMILARITY-CALCULATION-UPGRADE.md
- [x] CACHE-E-EMBEDDINGS.md atualizado

**Estado:** ✅ Produção-ready

---

## 🟡 v0.4.0 - Advanced Features (Planejado)

**Objetivo:** Features que agregam valor mas não são críticas

### Prioridade Alta

- [ ] **Stats & Analytics**
  - [ ] Endpoint `GET /items/stats`
  - [ ] Total items, breakdown por tipo
  - [ ] Items mais recentes
  - [ ] Items mais populares (por rating)

- [ ] **Rate Limiting**
  - [ ] Limite: 5 mensagens/minuto por usuário via Redis
  - [ ] Resposta amigável quando exceder
  - [ ] Configurável por usuário (premium pode ter mais)

### Prioridade Média

- [ ] **Observability Avançada**
  - [ ] Metrics de latência por endpoint
  - [ ] Tracking de uso de cache (hit rate)
  - [ ] Alertas automáticos em errors > 5%

- [ ] **Bulk Operations API**
  - [ ] `POST /items/bulk` - Criar múltiplos items
  - [ ] `PATCH /items/bulk` - Atualizar múltiplos
  - [ ] `DELETE /items/bulk` - Deletar múltiplos

**Entregável:** Features avançadas de busca e gestão

---

## 🔵 v0.5.0 - Integrations (Planejado)

**Objetivo:** Integrar com produtividade e calendário

### Google Calendar Integration

**Use Case:** "reunião com joão amanhã às 15h" → cria evento

### Microsoft To Do Integration

**Use Case:** "lembrar de ligar pro dentista quinta" → cria task

**Entregável:** Bot gerencia eventos e tarefas automaticamente

---

## 🔵 v0.6.0 - Performance Optimization (Planejado)

**Objetivo:** Otimizações para escala

### Features

- [ ] **Cache de Query Embeddings**
  - [ ] Cache queries frequentes ("filmes de ação", "séries de comédia")
  - [ ] Invalidação inteligente quando novos items são salvos
  - [ ] Redis com TTL de 1 hora

- [ ] **Hybrid Search (pgvector + cosineSimilarity)**
  - [ ] pgvector filtra top 100 candidatos (rápido)
  - [ ] `ai.cosineSimilarity` ranqueia top 10 finais (preciso)
  - [ ] Melhor para datasets > 10K items

- [ ] **Enriquecimento Assíncrono** (Requer Workers Paid $5/mês)
  - [ ] Workers Queues para processar enrichment em background
  - [ ] Webhook responde < 50ms, enriquecimento roda depois
  - [ ] Notificação quando metadata completa

**Entregável:** Sistema escalável para milhares de usuários

---

## 🎨 v1.0 - Production Ready (Release Completo)

**Objetivo:** Sistema pronto para escala e público geral

### Core Features

- [ ] **Auth Multi-User**
  - [ ] Supabase Auth (Email/Password)
  - [ ] RLS (Row Level Security)
  - [ ] User settings/preferences

- [ ] **Web Dashboard**
  - [ ] Visualizar/gerenciar items
  - [ ] Analytics e gráficos
  - [ ] Link accounts manualmente

- [ ] **Testing & CI/CD**
  - [ ] Unit tests (services)
  - [ ] Integration tests (routes + DB)
  - [ ] E2E tests (fluxos completos)
  - [ ] GitHub Actions pipeline

- [ ] **Monitoring & Observability**
  - [ ] Cloudflare Analytics
  - [ ] Error tracking (Sentry opcional)
  - [ ] Performance metrics

### Semantic Search Advanced

- [ ] **Query Expansion com LLM**
  - [ ] Workers AI Llama para expansão dinâmica
  - [ ] Aprende padrões do usuário
  - [ ] Fallback para regras fixas se LLM falhar

- [ ] **Hybrid Scoring**
  - [ ] `finalScore = 0.7 * vectorSimilarity + 0.3 * keywordBoost`
  - [ ] Boost para keywords TMDB que batem exato
  - [ ] Boost para genre match

- [ ] **Reranking com Cross-Encoder**
  - [ ] Top 10 resultados reranqueados com modelo cross-encoder
  - [ ] Accuracy state-of-the-art
  - [ ] Trade-off: +200ms latência

### Optional Advanced Features

- [ ] **MCP Server**
  - [ ] Resources: `nexo://items/user/{userId}`
  - [ ] Tools: `save_item`, `search_items`, `enrich_metadata`
  - [ ] **Condição:** Apenas se houver demanda externa

- [ ] **Advanced State Machine**
  - [ ] Migração para XState
  - [ ] **Condição:** > 10 estados OU nested/parallel states necessários
  - [ ] Ver ADR-008 para critérios

**Entregável:** Sistema robusto, escalável e monitorado

---

## 🔮 v2.0+ - Advanced & Nice-to-Have (Longo Prazo)

### Features Exploratórias

- [ ] **Fine-tuning de Embedding Model**
  - [ ] Fine-tune @cf/baai/bge-small-en-v1.5 para domínio cinema
  - [ ] Dataset: queries reais + items salvos
  - [ ] Validação: A/B test vs modelo base

- [ ] **Voice Messages**
  - [ ] Transcrição com Whisper API
  - [ ] Processar como texto

- [ ] **Image Recognition**
  - [ ] OCR + Claude Vision
  - [ ] Identificar filmes/livros por foto

- [ ] **More Enrichment Sources**
  - [ ] Spotify (música)
  - [ ] Goodreads (livros)
  - [ ] Steam (jogos)
  - [ ] Keywords extraction para YouTube (tags)
  - [ ] Keywords extraction para Notes (entidades NER)

- [ ] **Telegram Interactive UI**
  - [ ] Inline keyboards com botões
  - [ ] Callback queries para seleção
  - [ ] Quick replies para confirmações

- [ ] **WhatsApp Interactive Messages**
  - [ ] List messages (max 10 items)
  - [ ] Button messages
  - [ ] Fallback para texto se não suportado

- [ ] **Smart Recommendations**
  - [ ] ML model ou Claude para sugerir items similares
  - [ ] "Baseado no que você salvou..."

- [ ] **Reminders & Notifications**
  - [ ] Cloudflare Workers Cron
  - [ ] Lembretes automáticos via mensagem

- [ ] **Collaborative Lists**
  - [ ] Compartilhar listas com amigos
  - [ ] Permissões (view, edit)

- [ ] **Export/Import**
  - [ ] `GET /items/export?format=json|csv` - Exportar dados
  - [ ] `POST /items/import` - Importar JSON/CSV
  - [ ] Backup completo do usuário

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
| TMDB API              | Free      | $0        |
| YouTube Data API      | Free      | $0        |
| **Total**             |           | **~$2-5** |

### Paid Tier (100-1000 usuários)

| Serviço               | Plano     | Custo       |
| --------------------- | --------- | ----------- |
| Cloudflare Workers    | Paid      | $5          |
| Supabase              | Pro       | $25         |
| Gemini API            | Pay-as-go | ~$10-20     |
| Claude API (fallback) | Pay-as-go | ~$5-10      |
| Workers Queues        | Paid      | $5          |
| **Total**             |           | **~$50-65** |

---

## ⚠️ Decisões Arquiteturais Importantes

### 1. Enriquecimento Síncrono vs Assíncrono

**Decisão Atual:** Síncrono (v0.2.0)

**Justificativa:**

- Cloudflare Workers Free tier: 50ms CPU time suficiente
- Enriquecimento típico: ~15ms CPU (APIs externas não contam)
- Implementação mais simples

**Quando mudar para Async:**

- CPU time exceder 50ms em 10%+ dos requests
- Upgrade para Workers Paid ($5/mês)
- Ver ADR-010 (a criar)

### 2. MCP Server

**Decisão Atual:** Opcional (v1.0+)

**Justificativa:**

- MVP não precisa de integração externa
- MCP útil apenas com Claude Desktop ou outros clients MCP
- Adiciona complexidade sem benefício imediato

**Quando implementar:**

- Demanda de integração com Claude Desktop
- Necessidade de API pública estruturada
- Ver ADR-009 (a criar)

### 3. State Machine Avançada

**Decisão Atual:** Manual (v0.2.0)

**Justificativa:**

- 7 estados atuais (idle, awaiting_confirmation, enriching, saving, batch_processing, awaiting_batch_item, error)
- Implementação simples e testada
- XState adiciona 40kb ao bundle

**Quando migrar para XState:**

- Sistema atingir > 10 estados
- Necessidade de nested states
- Necessidade de parallel states
- Ver ADR-008 (atualizar status para "postponed")

### 4. Semantic Search (pgvector)

**Decisão Atual:** Hybrid approach implementado (v0.3.2)

**Justificativa:**

- `ai.cosineSimilarity` em JavaScript suficiente para < 10K items
- Document enrichment com TMDB keywords resolveu precision
- Query expansion resolveu recall
- Custo zero (embeddings via Cloudflare Workers AI)

**Quando migrar para pgvector puro:**

- Usuário com > 10K items
- Latência > 500ms em searchItems()
- Necessidade de índices IVFFlat para performance
- Ver ADR-014 para estratégia atual

---

## 🎯 Princípios de Desenvolvimento

1. **Simplicidade primeiro** - Features simples e funcionais > complexidade prematura
2. **Deploy early, deploy often** - Iteração rápida com feedback real
3. **User feedback drives roadmap** - Não assumir necessidades
4. **Provider-agnostic** - Fácil trocar LLM/APIs/Services
5. **Cost-conscious** - Otimizar para Free tier Cloudflare
6. **Security by design** - Validações desde o início

---

## 📚 Documentação de Referência

- [ARQUITETURA.md](ARQUITETURA.md) - Visão geral do sistema
- [DEPLOYMENT.md](DEPLOYMENT.md) - Guia de deploy Cloudflare
- [REFERENCIA.md](REFERENCIA.md) - Schema DB e API endpoints
- [adr/](adr/README.md) - Architecture Decision Records
- [SETUP.md](SETUP.md) - Environment e configuração

---

**Última atualização:** 19/01/2026 - v0.3.2 concluído (Semantic Search Optimization)
