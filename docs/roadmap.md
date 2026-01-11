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

## 🔴 v0.2.0 - Core Features (Atual - Em Progresso)

**Objetivo:** Completar funcionalidades críticas para MVP funcional

### Prioridade Alta

#### 🛠️ Tool Calling System
- [ ] Criar `src/services/ai/tools.ts` com definições:
  - `save_item` - Salvar item com enrichment automático
  - `search_items` - Buscar items com filtros
  - `get_item_details` - Detalhes de item específico
- [ ] Implementar `tool-executor.ts` para executar tool calls
- [ ] Integrar com `gemini-provider.ts` (suporte nativo)
- [ ] Integrar com `claude-provider.ts` (Tool Use API)
- [ ] Testar fluxo completo: mensagem → tool call → execução → resposta

**Por quê:** Sem tools, LLM não consegue executar ações (apenas responde texto)

#### 🔒 Security - WhatsApp Webhook Validation
- [ ] Implementar `validateMetaSignature()` em `src/routes/webhook.ts`
- [ ] Usar `crypto.subtle` (Cloudflare Workers compatible)
- [ ] Validar header `X-Hub-Signature-256` com HMAC-SHA256
- [ ] Rejeitar requests com assinatura inválida

**Por quê:** Webhook vulnerável a spoofing sem validação

#### 💬 Conversa Única Cross-Provider
- [ ] Migration: adicionar coluna `is_active BOOLEAN DEFAULT true` em `conversations`
- [ ] Refatorar `conversation-service.ts`:
  - `findOrCreateConversation(userId)` retorna apenas conversa ativa
  - Ao criar nova, desativar anteriores do mesmo usuário
- [ ] Testar fluxo: Telegram → WhatsApp → mesmo contexto

**Por quê:** Melhor UX - usuário continua conversa independente do canal

#### 📊 Rate Limiting
- [ ] Adicionar rate limiting usando Cloudflare KV
- [ ] Limite: 10 mensagens/minuto por usuário
- [ ] Resposta amigável quando exceder limite

### Environment Updates
```bash
# Adicionar ao .env (se usar rate limiting)
RATE_LIMIT_REQUESTS=10
RATE_LIMIT_WINDOW=60
```

**Entregável:** Bot funcional com segurança e UX melhorada

---

## 🟡 v0.3.0 - Polish & Reliability (Próximo)

**Objetivo:** Refinamentos e features de qualidade

### Tasks

- [ ] **Error Handling Robusto**
  - Logs estruturados com contexto
  - Mensagens de erro amigáveis
  - Retry logic para APIs externas

- [ ] **Batch Processing Melhorado**
  - Suporte a listas de itens: "clube da luta, matrix, inception"
  - Processamento sequencial com confirmação individual
  - Progresso visual: "[2/5] Processando..."

- [ ] **Advanced Search**
  - Full-text search em títulos/descrições
  - Filtros avançados: `type`, `year_range`, `has_streaming`
  - Ordenação por metadata JSONB

- [ ] **Stats & Analytics**
  - Endpoint `GET /items/stats`
  - Total items, breakdown por tipo
  - Items mais recentes

- [ ] **Caching Layer**
  - Cache TMDB responses (Cloudflare KV, TTL 24h)
  - Cache YouTube responses (TTL 12h)
  - Reduzir latência e custos de API

**Entregável:** Sistema polido e confiável

---

## 🟢 v0.4.0 - Advanced Features (Futuro)

**Objetivo:** Features que agregam valor mas não são críticas

### Enriquecimento Assíncrono (Requer Workers Paid $5/mês)

**Quando implementar:**
- CPU time exceder 50ms em 10%+ dos requests
- Upgrade para Cloudflare Workers Paid plan

**Como:**
```typescript
// webhook.ts
export default {
  async fetch(request, env, ctx) {
    // Processar mensagem rapidamente
    const item = await quickSave(message);
    
    // Enfileirar enriquecimento (não-bloqueante)
    await env.ENRICHMENT_QUEUE.send({
      itemId: item.id,
      type: item.type,
      externalId: item.externalId
    });
    
    return sendMessage("✅ Salvei! Buscando mais detalhes...");
  },
  
  // Worker separado processa fila
  async queue(batch, env) {
    for (const msg of batch.messages) {
      const metadata = await enrichmentService.enrich(msg.body);
      await itemService.updateMetadata(msg.body.itemId, metadata);
    }
  }
};
```

**Benefício:** Libera request em <50ms, enriquecimento roda em background

### Semantic Search com pgvector

**Quando implementar:**
- Usuário tem > 500 items salvos
- Feedback de "não encontrei X" é frequente

**Setup:**
```sql
-- Migration
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE memory_items 
ADD COLUMN embedding vector(768);

CREATE INDEX items_embedding_idx 
ON memory_items USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

**Embedding Provider:** Gemini Embedding (768 dims, free tier)

**Query:**
```typescript
// Busca semântica
const results = await db.execute(sql`
  SELECT *, embedding <=> ${queryEmbedding} as distance
  FROM memory_items
  WHERE user_id = ${userId}
  ORDER BY distance
  LIMIT 10
`);
```

**Benefício:** Busca por significado ("filmes de viagem no tempo" → Interestelar, Matrix)

### Bulk Operations
- [ ] `POST /items/bulk` - Criar múltiplos items
- [ ] `PATCH /items/bulk` - Atualizar múltiplos
- [ ] `DELETE /items/bulk` - Deletar múltiplos

### Export/Import
- [ ] `GET /items/export?format=json|csv` - Exportar dados
- [ ] `POST /items/import` - Importar JSON/CSV
- [ ] Backup completo do usuário

**Entregável:** Features avançadas de busca e gestão

---

## 🔵 v0.5.0 - Integrations (Futuro)

**Objetivo:** Integrar com produtividade e calendário

### Google Calendar Integration

**Use Case:** "reunião com joão amanhã às 15h" → cria evento

**Setup:**
```typescript
// OAuth 2.0
GOOGLE_CLIENT_ID="xxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxx"

// Service
async function createEvent(params: {
  summary: string;
  start: Date;
  end: Date;
  attendees?: string[];
}) {
  // Google Calendar API
}
```

**Flow:**
1. Usuário vincula conta Google via link
2. Bot detecta intenção de evento (LLM)
3. Confirma detalhes
4. Cria evento no Calendar
5. Salva referência como `type: "event"` em items

### Microsoft To Do Integration

**Use Case:** "lembrar de ligar pro dentista quinta" → cria task

**Similar ao Calendar, mas com Microsoft Graph API**

### Metadata Schema
```typescript
// type: "event"
{
  calendar_id: "primary",
  event_id: "abc123",
  start_time: "2026-01-15T15:00:00Z",
  end_time: "2026-01-15T16:00:00Z",
  attendees: ["joao@example.com"]
}

// type: "task"
{
  list_id: "AQMkADAwAT...",
  task_id: "AAMkADAwAT...",
  due_date: "2026-01-20",
  status: "notStarted" | "inProgress" | "completed"
}
```

**Entregável:** Bot gerencia eventos e tarefas automaticamente

---

## 🎨 v1.0 - Production Ready (Futuro)

**Objetivo:** Sistema pronto para escala e público geral

### Features

- [ ] **Auth Multi-User**
  - Supabase Auth (Email/Password)
  - RLS (Row Level Security)
  - User settings/preferences

- [ ] **Web Dashboard**
  - Visualizar/gerenciar items
  - Analytics e gráficos
  - Link accounts manualmente

- [ ] **MCP Server (Opcional)**
  - Resources: `nexo://items/user/{userId}`
  - Tools: `save_item`, `search_items`, `enrich_metadata`
  - Composição com Supabase MCP
  - **Condição:** Apenas se houver demanda externa

- [ ] **Advanced State Machine (Apenas se necessário)**
  - Migração para XState
  - **Condição:** > 10 estados OU nested/parallel states necessários
  - Ver ADR-008 para critérios

- [ ] **Testing & CI/CD**
  - Unit tests (services)
  - Integration tests (routes + DB)
  - E2E tests (fluxos completos)
  - GitHub Actions pipeline

- [ ] **Monitoring & Observability**
  - Cloudflare Analytics
  - Error tracking (Sentry opcional)
  - Performance metrics

**Entregável:** Sistema robusto, escalável e monitorado

---

## 🔮 v2.0+ - Advanced & Nice-to-Have (Longo Prazo)

### Features Exploratórias

- [ ] **Voice Messages**
  - Transcrição com Whisper API
  - Processar como texto

- [ ] **Image Recognition**
  - OCR + Claude Vision
  - Identificar filmes/livros por foto

- [ ] **More Enrichment Sources**
  - Spotify (música)
  - Goodreads (livros)
  - Steam (jogos)

- [ ] **Telegram Interactive UI**
  - Inline keyboards com botões
  - Callback queries para seleção
  - Quick replies para confirmações

- [ ] **WhatsApp Interactive Messages**
  - List messages (max 10 items)
  - Button messages
  - Fallback para texto se não suportado

- [ ] **Smart Recommendations**
  - ML model ou Claude para sugerir items similares
  - "Baseado no que você salvou..."

- [ ] **Reminders & Notifications**
  - Cloudflare Workers Cron
  - Lembretes automáticos via mensagem

- [ ] **Collaborative Lists**
  - Compartilhar listas com amigos
  - Permissões (view, edit)

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
| Serviço | Plano | Custo |
|---------|-------|-------|
| Cloudflare Workers | Free | $0 |
| Supabase | Free | $0 |
| Gemini API | Free tier | $0 |
| Claude API (fallback) | Pay-as-go | ~$2-5 |
| TMDB API | Free | $0 |
| YouTube Data API | Free | $0 |
| **Total** | | **~$2-5** |

### Paid Tier (100-1000 usuários)
| Serviço | Plano | Custo |
|---------|-------|-------|
| Cloudflare Workers | Paid | $5 |
| Supabase | Pro | $25 |
| Gemini API | Pay-as-go | ~$10-20 |
| Claude API (fallback) | Pay-as-go | ~$5-10 |
| Workers Queues | Paid | $5 |
| **Total** | | **~$50-65** |

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

**Decisão Atual:** Adiar (v0.4.0)

**Justificativa:**
- Busca estruturada (JSONB + GIN) suficiente para < 500 items/user
- Adiciona complexidade (embeddings, migrations)
- Custo de embeddings ($)

**Quando implementar:**
- Usuário com > 500 items
- Feedback negativo de busca ("não encontrei X")
- Need de recomendações semânticas

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

**Última atualização:** 10/01/2026 - v0.2.0 em progresso
