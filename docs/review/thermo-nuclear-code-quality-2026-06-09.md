# Thermo-Nuclear Code Quality Review — Nexo AI

**Data:** 2026-06-09
**Branch:** `review/thermo-nuclear-code-quality`
**Base:** `development` (770687b)
**Escopo:** apps/api/src/ — 212 arquivos, ~34k linhas

---

## 🔴 CRÍTICO — 5 Arquivos Acima de 1.000 Linhas

### 1. `services/tools/index.ts` — 1.921 linhas 🔥🔥🔥

**O problema:** 31 tool functions todas inline no mesmo arquivo. Zero módulos extraídos.

| Categoria | O que encontrei |
|-----------|----------------|
| **Copy-paste** | `save_movie` vs `save_tv_show` — ~85% idênticos. `save_book` vs `save_music` — mesmo padrão 2-fase. `list_calendar_events` vs `create_calendar_event` — connection check duplicado. |
| **Dead code** | `collectContextTool` — assinatura diferente, NÃO registrada em `AVAILABLE_TOOLS`, nunca executada |
| **TODO stub** | `enrich_video` — retorna fake success, YouTube metadata não implementado |
| **Inconsistência** | `delete_all_memories` usa snake_case (`deleted_count`), todo o resto é camelCase |
| **Erro handling repetido** | 31x `try/catch { success: false, error: error.message }` — zero shared wrapper |
| **Duplicate check** | `result.isDuplicate && result.existingItem` em 4 tools, nenhum shared helper |

**Code-judô:** Extrair para 10+ módulos (save-tools, media-save-tools, enrichment-tools, book-music-tools, memory-tools, integration-tools, delete-tools, preferences-tools, url-tools, context-tools) deixando `index.ts` com ~70 linhas de imports + registry + executor.

---

### 2. `services/agent-orchestrator.ts` — 1.854 linhas 🔥🔥🔥

**O problema:** Pelo menos **7 responsabilidades distintas** no mesmo arquivo.

| Responsabilidade | Linhas |
|-----------------|--------|
| State machine / routing | 140–474 |
| LLM runtime management | 495–741 |
| Confirmation handler | 746–979 |
| CRUD handlers (search, delete, save) | 1000–1316 |
| Clarification dialog | 1322–1676 |
| UI button construction (Telegram) | 1682–1850 |

**Métricas de complexidade:**
- 75 `if` statements (~1 a cada 25 linhas)
- 23 `as any` casts (erosão de tipo, especialmente em state updates)
- 15 métodos públicos + privados
- 3 chamadas recursivas a `processMessage()` dentro de `handleClarificationResponse` — stack growth, span nesting, traces perdidos
- 3 cópias do mesmo mapa `tool→type` (save_movie→movie, save_tv_show→series, etc.)

**State machine implícita:** As transições de estado estão espalhadas no if-ladder. `handleConfirmation` faz update manual com `as any`. Não existe uma `StateMachine` declarativa.

**Code-judô:** Extrair state machine, confirmation flow, clarification dialog, e UI construction para services separados. Eliminar recursão — usar sinal de "reprocess" explícito.

---

### 3. `services/message-analysis/training/training-data.ts` — 1.639 linhas 🔥🔥🔥

**99% dados, 1% código.** Interfaces (0,7%) + 3 constantes de dados (~99,3%).

**O problema:**
- Dados de treino **misturados com código de produção** — deveria ser JSON/YAML
- **~65–70% dos exemplos são permutações mecânicas** de 3-4 templates (`'salva <TITULO>'`, `'quero assistir <TITULO>'`, `'coloca <TITULO> na lista'`)
- **Sem split treino/teste** — zero dados de validação, risco de overfitting não detectado
- Typos intencionais (`asistir`, `adicona`, `incepition`) hardcoded em vez de gerados via augmentation

**Code-judô:** Converter para `training-data.json`, gerar exemplos via template expansion, adicionar split 80/20.

---

### 4. `services/intent-classifier.ts` — 1.112 linhas 🔥🔥

**O problema:** Classificador híbrido 3-tier (Neural → Regex → LLM) com padrões duplicados e hardcoded.

| Problema | Detalhes |
|----------|----------|
| **80+ regex patterns** | Hardcoded, espalhados em 15 métodos privados |
| **70+ keyword strings** | Também hardcoded, sem shared config |
| **LLM sem validação** | `JSON.parse()` direto em `IntentResult` — sem schema check, sem Zod |
| **Duplicação** | `deleteKeywords` idêntico em 2 lugares, `memoryContextKeywords` em 2 lugares com EN/PT divergentes |
| **Bug de ordinal** | `isConfirmation` vai até "terceiro", `extractSelection` vai até "quinto" — confirmação nunca detecta ordinais 4-5 |

**Code-judô:** Extrair todos patterns para config YAML/JSON, adicionar Zod schema pra saída do LLM, deduplicar keyword lists.

---

## 🟡 ALTO — Arquivos com Vazamento de Responsabilidade

### 5. `services/message-service.ts` — 700 linhas 🔥

**God service.** Apesar do nome "message", faz:
- Content moderation (NLP.js sentiment)
- User management (find-or-create)
- Conversation management (find-or-create, close cancellation)
- Onboarding gating (trial exceeded, signup, provider-specific buttons)
- TTS orchestration (edge-tts synthesis)
- Response dispatching (auto-split, error notification)
- Timeout escalation (5→15→30→60 min)
- **6× duplicação** do padrão `error.cause?.code === 'ETIMEDOUT' || error.cause?.code === 'ECONNREFUSED'`

---

### 6. `adapters/messaging/discord-adapter.ts` — 1.010 linhas 🔥🔥

**14% de lógica de negócio vazando no adapter.** A arquitetura diz "adapters são finos, zero business logic".

| Vazamento | Linhas | Problema |
|-----------|--------|----------|
| `registerSlashCommandHandlers` | ~80 | Strings de UI em português hardcoded (welcome, help, comandos) |
| `guildCreate` | ~31 | Account linking OAuth — lógica de gerenciamento de conta |
| `findGuildOwnedByUser` | ~29 | Utilitário geral exportado, importado por `user.routes.ts` |
| `verifyWebhook` | — | **TODO stub — não verifica assinatura de fato** |

**Telegram é bem mais limpo** (~90% puro adapter), só repete o group check de 4 linhas.

---

## 🟡 MÉDIO — Arquivos com Problemas Estruturais

### 7. `services/queue-service.ts` — 986 linhas 🔥

4 responsabilidades misturadas: definições de fila + workers inline + **CRON jobs de DB** + helpers públicos.

**Fora de lugar:** `runConversationCloseCron` e `runAwaitingConfirmationTimeoutCron` são operações DB puras (`SELECT ... FOR UPDATE SKIP LOCKED`). Pertencem a um `conversation-cron.ts`.

**Boilerplate:** ~200 linhas de listeners `on('error')`/`on('active')`/`on('failed')` virtualmente idênticos entre filas.

---

### 8. `services/item-service.ts` — 942 linhas 🔥

**O mais saudável dos grandes.** Classe coesa com CRUD + busca híbrida + embedding.

**Problema:** Modelo dual-storage (`memoryItems` + `semanticExternalItems`) força **11 repetições do padrão** `COALESCE(memoryItems.metadata, semanticExternalItems.rawData)`. Uma view no banco ou SQL builder helper resolveria.

---

## 🔵 BAIXO — Questões de Manutenção

### Duplicação generalizada

| Padrão | Ocorrências | Arquivos |
|--------|-------------|----------|
| `error.cause?.code === 'ETIMEDOUT' || error.cause?.code === 'ECONNREFUSED'` | **6×** | message-service, queue-service, embedding-service |
| `COALESCE(memoryItems.metadata, semanticExternalItems.rawData)` | **11×** | item-service.ts |
| Worker listener boilerplate | **~200 linhas** | queue-service.ts |
| Tool→type map (`save_movie→movie`) | **3×** | agent-orchestrator.ts |
| `deleteKeywords` / `memoryContextKeywords` | **2× cada** | intent-classifier.ts |
| `handleCommand` group check | **2×** | discord-adapter + telegram-adapter |

### TypeScript Erosão
- **23 `as any`** em agent-orchestrator.ts
- **LLM output sem validação** em intent-classifier.ts
- **`collectContextTool`** com assinatura incompatível, não tipada

---

## 📋 Resumo por Prioridade

| Prioridade | Arquivo | Linhas | Problema Central |
|-----------|---------|--------|-----------------|
| 🔴 P0 | `services/tools/index.ts` | 1.921 | Monólito de 31 tools inline, copy-paste massivo |
| 🔴 P0 | `services/agent-orchestrator.ts` | 1.854 | 7 responsabilidades, state machine implícita, recursão |
| 🔴 P0 | `services/message-analysis/training/training-data.ts` | 1.639 | Dados como código, 70% repetição template |
| 🔴 P0 | `services/intent-classifier.ts` | 1.112 | 80+ regex + 70+ keywords hardcoded, LLM sem validação |
| 🔴 P0 | `adapters/discord-adapter.ts` | 1.010 | 14% business logic vazando, webhook stub |
| 🟡 P1 | `services/message-service.ts` | 700 | God service, 8+ responsabilidades |
| 🟡 P1 | `services/queue-service.ts` | 986 | CRON DB lógico onde não pertence |
| 🟡 P1 | Duplicação geral | — | ETIMEDOUT (6x), COALESCE (11x), boilerplate (~200 linhas) |

---

## 🎯 Recomendações de Code-Judô

### Split imediato (1 → N arquivos)
- `services/tools/` — extrair 31 tools para 10+ módulos por categoria
- `services/agent-orchestrator.ts` — extrair state machine, confirmation, clarification, UI

### Data-driven
- `intent-classifier.ts` — regex/keywords para YAML/JSON config
- `training-data.ts` — JSON puro + template expansion

### Eliminar vazamento
- `discord-adapter.ts` — UI strings → config, OAuth→service, webhook→implementar
- `message-service.ts` — onboarding→dedicated service, content moderation→service

### Shared utilities
- `isNetworkError()` — elimina 6x duplicação
- SQL view/builder — elimina 11x COALESCE
- `createWorkerHandlers()` factory — elimina ~200 linhas boilerplate
