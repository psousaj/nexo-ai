# Arquitetura Final - Sistema de Conversação v0.3.0

## Visão Geral

Sistema de chat inteligente com IA que mantém contexto conversacional limpo através de fechamento automático de conversas inativas. Implementa arquitetura determinística onde o LLM atua apenas como planejador, e o runtime controla toda execução.

---

## Estados da Conversação

### Diagrama de Transições

```
┌──────────────────────────────────────────────────────────────┐
│                     LIFECYCLE COMPLETO                        │
└──────────────────────────────────────────────────────────────┘

     ┌─────────┐
     │  IDLE   │ ◀── Estado inicial / Pronta para comandos
     └────┬────┘
          │ nova mensagem
          ▼
   ┌──────────────┐
   │ PROCESSING   │ ◀── Executando ação (evita concorrência)
   └──────┬───────┘
          │
    ┌─────┴──────┐
    │            │
    ▼            ▼
┌────────────┐  ┌─────────┐
│   IDLE     │  │ AWAIT   │ ◀── Múltiplos resultados, pede confirmação
└─────┬──────┘  │ CONFIRM │
      │         └────┬────┘
      │              │ usuário escolhe
      │              ▼
      │         ┌─────────┐
      │         │  IDLE   │
      │         └────┬────┘
      │              │
      └──────────────┘
              │ ação finalizada
              ▼
       ┌──────────────┐
       │ WAITING      │ ◀── Timer de 3min agendado
       │ CLOSE        │
       └──────┬───────┘
              │
        ┌─────┴──────┐
        │            │
    nova msg     3min passa
        │            │
        ▼            ▼
    ┌─────────┐  ┌────────┐
    │  IDLE   │  │ CLOSED │ ◀── Contexto limpo, fim do ciclo
    └─────────┘  └────────┘
```

### Estados Detalhados

#### 1. `idle`
**Descrição:** Conversa inativa, pronta para receber comandos.

**Quando entra:**
- Nova conversa criada
- Ação executada com sucesso (transição rápida)
- Usuário cancela timer mandando nova mensagem

**Pode transitar para:**
- `processing` - ao receber nova mensagem
- `waiting_close` - após finalizar ação

**Duração típica:** Instantânea (aguarda mensagem do usuário)

---

#### 2. `processing`
**Descrição:** Ação em andamento. Previne concorrência e duplicação.

**Quando entra:**
- Mensagem recebida e sendo processada
- LLM escolhendo tool
- Tool sendo executada

**Pode transitar para:**
- `idle` - ação simples finalizada
- `awaiting_confirmation` - múltiplos resultados encontrados
- `waiting_close` - ação finalizada (via idle)

**Duração típica:** 1-5 segundos (tempo de processamento LLM + tool)

**Nota:** Este estado **não persiste** entre mensagens. Se uma nova mensagem chegar enquanto está `processing`, o sistema aguarda finalização.

---

#### 3. `awaiting_confirmation`
**Descrição:** Aguardando confirmação do usuário (ex: múltiplos filmes encontrados).

**Quando entra:**
- Tool de enrichment retorna múltiplos resultados
- Sistema precisa de escolha do usuário

**Exemplo:**
```
Bot: "Encontrei 3 filmes:
     1. Fight Club (1999)
     2. The Fight Club (2020)
     3. Fight Club Documentary (2005)
     Qual você quer salvar?"

Estado: awaiting_confirmation
Context: { candidates: [...], awaiting_selection: true }
```

**Pode transitar para:**
- `idle` - usuário escolheu (ação finalizada)
- `idle` - usuário cancelou

**Duração típica:** Variável (aguarda resposta do usuário)

---

#### 4. `waiting_close`
**Descrição:** Ação finalizada, timer de 3 minutos agendado para fechar conversa.

**Quando entra:**
- Ação executada com sucesso
- Estado volta para `idle` mas imediatamente agenda fechamento

**O que acontece:**
1. Banco atualizado: `state='waiting_close'`, `close_at=now()+3min`
2. Bull queue: delayed job de 3 minutos enfileirado
3. Sistema aguarda

**Pode transitar para:**
- `idle` - usuário manda nova mensagem (cancela timer)
- `closed` - 3 minutos passam sem interação

**Duração típica:** 3 minutos (ou cancelado antes)

---

#### 5. `closed`
**Descrição:** Conversa encerrada. Contexto limpo.

**Quando entra:**
- Timer de 3 minutos expirou
- Worker/Cron fechou a conversa

**Comportamento:**
- Nova mensagem do usuário → **cria nova conversa** (contexto limpo)
- Não reaproveita histórico antigo
- Previne contextos contaminados

**Estado final:** Sim. Não transita para outros estados.

---

## Estados Removidos (da versão antiga)

| Estado Antigo | Motivo da Remoção | Substituído Por |
|---------------|-------------------|-----------------|
| `enriching` | Redundante | `processing` |
| `saving` | Redundante | `processing` |
| `batch_processing` | Redundante | `processing` |
| `awaiting_batch_item` | Redundante | `awaiting_confirmation` |
| `error` | Transitório | `idle` (erro tratado, volta ao normal) |
| `open` | Semântica confusa | `idle` (mais claro) |

**Justificativa:**
- `processing` unifica todas as ações em andamento
- `error` não é um estado persistente - sistema recupera e volta ao normal
- `idle` é mais semântico que `open` para conversas (idle = inativo, aguardando)

---

## Sistema de Fechamento Automático

### Arquitetura em 3 Camadas

```
┌─────────────────────────────────────────────────────────┐
│  CAMADA 1: Database (Source of Truth)                   │
│  - Campo: close_at (TIMESTAMP NULL)                     │
│  - NUNCA mente, sempre consistente                      │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│  CAMADA 2: Bull Queue + Redis (Aceleração)              │
│  - Delayed jobs (3min)                                  │
│  - Retry automático (3x)                                │
│  - Backoff exponencial                                  │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│  CAMADA 3: Cron Backup (Anti-Apocalipse)                │
│  - Roda a cada 1 minuto                                 │
│  - Fecha conversas que deveriam estar fechadas          │
│  - Salva sistema se Redis/Bull cair                     │
└─────────────────────────────────────────────────────────┘
```

### Fluxo Completo (Exemplo Real)

```
T=0s   │ Usuário: "salva naruto"
       │ Estado: idle → processing
       │
T=2s   │ LLM: { action: "CALL_TOOL", tool: "enrich_tv_show" }
       │ Tool: busca TMDB
       │
T=3s   │ Bot: "✅ Naruto Shippuden salvo!"
       │ Estado: processing → idle
       │
T=3.1s │ Agenda fechamento:
       │   DB: state='waiting_close', close_at='T+3min'
       │   Bull: delayed job (3min)
       │
T=30s  │ Estado: waiting_close (nada acontece)
       │
T=2min │ Estado: waiting_close (nada acontece)
       │
T=2m30s│ Usuário: "e one piece?"
       │ Webhook: detecta waiting_close
       │   DB: state='idle', close_at=NULL
       │   Bull: remove job
       │ Estado: idle → processing
       │
T=2m32s│ Bot responde, agenda novo timer...
```

**Fluxo alternativo (sem nova mensagem):**

```
T=3m01s│ Worker Bull: pega job
       │ Busca conversa no DB
       │ Valida: state='waiting_close' ✓
       │ Valida: close_at <= now() ✓
       │ DB: state='closed', close_at=NULL
       │ ✅ Conversa fechada
```

### Componentes Técnicos

#### 1. Queue Service (`src/services/queue-service.ts`)

**Funções principais:**
```typescript
// Agenda fechamento
scheduleConversationClose(conversationId: string): Promise<void>

// Cancela fechamento
cancelConversationClose(conversationId: string): Promise<void>

// Cron de backup
runConversationCloseCron(): Promise<number>
```

**Worker (idempotente):**
```typescript
closeConversationQueue.process(async (job) => {
  const convo = await db.findById(job.data.conversationId);
  
  // CHECAGENS VITAIS - previne fechamento errôneo
  if (convo.state !== 'waiting_close') return;
  if (!convo.close_at || convo.close_at > now()) return;
  
  // Só fecha se validações passarem
  await db.update({ state: 'closed', close_at: null });
});
```

#### 2. Agent Orchestrator (`src/services/agent-orchestrator.ts`)

**Integração:**
```typescript
// Após processar mensagem
if (response.state === 'idle' && action !== 'handle_casual') {
  await scheduleConversationClose(conversation.id);
}
```

#### 3. Webhook (`src/routes/webhook-new.ts`)

**Cancela timer em nova mensagem:**
```typescript
if (conversation.state === 'waiting_close') {
  await cancelConversationClose(conversation.id);
  console.log('🔄 Fechamento cancelado');
}
```

#### 4. Cron Backup (`src/app.ts`)

**Roda a cada 1 minuto:**
```typescript
setInterval(async () => {
  await runConversationCloseCron();
}, 60 * 1000);
```

**SQL executado:**
```sql
UPDATE conversations
SET state = 'closed', close_at = NULL
WHERE state = 'waiting_close'
  AND close_at <= NOW();
```

---

## Integração com Redis (Upstash)

### Configuração

```bash
# .env
REDIS_HOST=us1-your-instance.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=your-token-here
REDIS_TLS=true
```

### Por quê Upstash funciona?

✅ **Persistência ativada** (storage durável, não volátil)  
✅ **Sobrevive a restart** (dados não perdem)  
✅ **Bull usa listas**, não pub/sub (retry automático)  
⚠️ **Latência maior** (aceitável para delayed jobs)

### Garantias

O sistema **garante**:
- ✅ Conversas fecham em até 4min (3min + 1min cron backup)
- ✅ Nova mensagem cancela fechamento
- ✅ Zero perda de estado (banco é source of truth)
- ✅ Zero race condition (jobs idempotentes)
- ✅ Recuperação automática (cron backup)

O sistema **não garante**:
- ❌ Fechamento exato em 3:00.000 min (pode variar +/- segundos)
- ❌ Exactly-once execution (job pode rodar 2x, mas é idempotente)

---

## Arquitetura Determinística (v0.3.0)

### Princípios Fundamentais

```
┌─────────────────────────────────────────────────────┐
│  LLM = PLANNER (escolhe ações via JSON)             │
│  Runtime = EXECUTOR (executa tools, controla fluxo) │
└─────────────────────────────────────────────────────┘
```

**LLM NUNCA:**
- ❌ Gerencia estado
- ❌ Decide fluxo
- ❌ Executa lógica de negócio
- ❌ Controla loops
- ❌ Pergunta "quer que eu salve?"

**LLM APENAS:**
- ✅ Analisa mensagem
- ✅ Planeja ação
- ✅ Escolhe tool apropriada
- ✅ Retorna JSON estruturado

**Runtime SEMPRE:**
- ✅ Valida resposta LLM
- ✅ Executa tools
- ✅ Gerencia estado
- ✅ Controla concorrência
- ✅ Garante consistência

### Schema de Resposta LLM

```typescript
interface AgentLLMResponse {
  schema_version: "1.0",
  action: "CALL_TOOL" | "RESPOND" | "NOOP",
  tool?: "save_note" | "save_movie" | ... | null,
  args?: { ...params } | null,
  message?: string | null
}
```

**Exemplo real:**
```json
{
  "schema_version": "1.0",
  "action": "CALL_TOOL",
  "tool": "enrich_movie",
  "args": { "title": "inception" },
  "message": null
}
```

---

## Tools Disponíveis

### Save Tools (específicas)
- `save_note(content: string)` - Lembretes, ideias, anotações
- `save_movie(title, year?, tmdb_id?)` - Filmes
- `save_tv_show(title, year?, tmdb_id?)` - Séries
- `save_video(url, title?)` - YouTube/Vimeo
- `save_link(url, description?)` - Sites/artigos

### Search Tools
- `search_items(query?, limit?)` - Busca itens salvos

### Enrichment Tools
- `enrich_movie(title, year?)` - Busca TMDB
- `enrich_tv_show(title, year?)` - Busca TMDB
- `enrich_video(url)` - Busca YouTube metadata

### Delete Tools
- `delete_memory(item_id)` - Deleta item específico
- `delete_all_memories()` - Deleta tudo

---

## Monitoramento

### Logs Importantes

```
✅ Logs de Estado:
📅 Fechamento agendado para <id> em 3min
🔄 Fechamento cancelado para <id>
🔄 Processando fechamento: <id>
✅ Conversa <id> fechada com sucesso
🔧 <n> conversa(s) fechada(s) pelo backup

✅ Logs de Ação:
🤖 [Agent] LLM action: CALL_TOOL
🔧 [Agent] Executando tool: save_movie
✅ [Agent] Resposta gerada (42 chars)

⚠️ Logs de Aviso:
⚠️ [Queue] Conversa <id> não está em waiting_close
⚠️ [Agent] Resposta não é JSON válido
```

### Métricas Sugeridas

- **Conversas ativas** (estado != closed)
- **Taxa de fechamento automático** (3min expirou vs cancelado)
- **Latência de fechamento** (deve ficar ~180s)
- **Jobs falhados** (retry > 3x)
- **Conversas em waiting_close > 5min** (bug!)

---

## Resumo de Mudanças (v0.3.0)

### O que mudou?

**Estados:**
```diff
- idle, awaiting_confirmation, batch_processing, enriching, saving, error
+ idle, processing, awaiting_confirmation, waiting_close, closed
```

**Fechamento automático:**
- ✅ Conversas fecham após 3min de inatividade
- ✅ Nova mensagem cancela timer
- ✅ Cron backup (1min) garante consistência

**Arquitetura:**
- ✅ LLM modo JSON (sem function calling nativo)
- ✅ Runtime determinístico (100% controle)
- ✅ Tools específicas (não genéricas)
- ✅ Bull + Redis (Upstash)

### Arquivos Principais

```
src/
├── types/index.ts               # Estados da conversa
├── db/schema/conversations.ts   # Campo close_at
├── services/
│   ├── queue-service.ts         # Bull queue + cron
│   ├── agent-orchestrator.ts    # Agenda/cancela fechamento
│   └── ai/
│       ├── gemini-provider.ts   # Modo JSON (sem function calling)
│       └── tools.ts             # Tools específicas
├── routes/
│   └── webhook-new.ts           # Cancela timer em nova msg
└── app.ts                       # Inicializa cron backup
```

---

## Documentação Adicional

- 📄 [CONVERSATION-CLOSE-SYSTEM.md](./CONVERSATION-CLOSE-SYSTEM.md) - Detalhes técnicos
- 📄 [ADR-011: Controle Determinístico](./adr/011-deterministic-runtime-control.md)
- 📄 [REFACTORING-v0.3.0.md](./REFACTORING-v0.3.0.md) - Histórico de mudanças

---

**Versão:** v0.3.0  
**Data:** 13 de janeiro de 2026  
**Status:** ✅ Implementado e em produção
