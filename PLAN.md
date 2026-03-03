# PLAN — Nexo AI Conversational Memory Pivot

## Objetivo
Pivotar o Nexo AI de um fluxo rígido de CRUD para um **assistente conversacional de memórias**: conversa livre por padrão, com ações determinísticas quando há efeito colateral (save/update/delete/integrations), mantendo tool-calling JSON estrito.

## Branch e PR
- Branch: `refactor/conversational-memory-pivot`
- PR: https://github.com/psousaj/nexo-ai/pull/93

## O que já foi feito (até agora)

### 1) Governança do workflow (planejamento + instruções)
- Plano de execução por sprints/milestones definido no plano da sessão.
- Regras mandatórias adicionadas:
  - `feature -> testes -> verdinho -> next`
  - loop contínuo até fechar milestones/features
  - commit por feature concluída
  - branch dedicada + PR incremental
- Arquivos atualizados:
  - `AGENTS.md`
  - `.github/copilot-instructions.md`

### 2) Base técnica inicial do pivot (API)
- **Contrato AgentDecisionV2 (scaffold)**
  - `apps/api/src/types/agent-decision-v2.ts`
  - export em `apps/api/src/types/index.ts`
  - teste: `apps/api/src/tests/agent-decision-v2.test.ts`

- **Parser/validator AgentDecisionV2 no json-parser**
  - `apps/api/src/utils/json-parser.ts`
  - teste: `apps/api/src/tests/json-parser-agent-decision-v2.test.ts`

- **Feature flags de pivot (env + helper)**
  - `packages/env/src/index.ts`
  - `apps/api/src/config/pivot-feature-flags.ts`
  - teste: `apps/api/src/tests/pivot-feature-flags.test.ts`

- **Telemetria de parse AgentDecisionV2**
  - métricas adicionadas:
    - `agent_decision_v2_parse_valid_total`
    - `agent_decision_v2_parse_invalid_total`
  - ação (`CALL_TOOL|RESPOND|NOOP`) enviada como atributo no caso válido

- **Visibilidade operacional das flags**
  - endpoint: `GET /api/admin/pivot-feature-flags`
  - arquivo: `apps/api/src/routes/dashboard/admin.routes.ts`
  - teste: `apps/api/src/tests/admin-routes-pivot-feature-flags.test.ts`

## Validação executada
- `pnpm --filter @nexo/env build`
- `pnpm --filter @nexo/api exec vitest run src/tests/agent-decision-v2.test.ts src/tests/json-parser-agent-decision-v2.test.ts src/tests/pivot-feature-flags.test.ts src/tests/admin-routes-pivot-feature-flags.test.ts --config vitest.config.ts`
- Status: ✅ verde

## O que falta (próximos blocos)

## M0 — Baseline & Guardrails (em progresso)
- [x] Contrato V2 inicial + parser + telemetria básica
- [x] Flags de pivot + endpoint de visibilidade
- [ ] Baseline KPI consolidado (latência, invalid JSON rate, false-save rate)
- [ ] Eval set inicial de conversa livre vs intenção de memória

## M1 — Conversational Freedom
- [ ] Ajustar políticas para conversa livre (reduzir bloqueio de off-topic)
- [ ] Limitar resposta para 2-3 parágrafos no composer final
- [ ] Aplicar tone/humor configurável com presets (friendly default etc.)
- [ ] Detectar ambiguidade de tipo (filme vs nota/link/etc.) e perguntar quando necessário

## M2 — Tool Contract V2 Enforcement
- [ ] Integrar AgentDecisionV2 no orquestrador como caminho oficial (guarded por flag)
- [ ] Matriz determinística por risco (quando exige confirmação)
- [ ] Reforço de validação/retry com erro explícito de contrato
- [ ] Evoluir tools para save/search por tipo com metadados completos para embedding vetorial

## M3 — Multimodal Memory Intake
- [ ] Pipeline de áudio (STT) -> roteador canônico
- [ ] Pipeline de imagem com OCR (worker Python) -> extração estruturada
- [ ] Fallback textual + política por confiança

## M4 — Provider Decoupling
- [ ] Extrair `messaging-core`
- [ ] Separar Discord em app dedicado (`apps/bot-discord`)
- [ ] Garantir compatibilidade Telegram/WhatsApp no gateway HTTP

## M5 — Runtime Migration
- [ ] Migrar API principal para Elysia
- [ ] Migrar cron para `@elysiajs/cron`
- [ ] Manter contratos externos e cobertura de integração

## M6 — Hardening & Go-live
- [ ] Ajuste final de qualidade/custos/latência
- [ ] Testes E2E completos (texto + áudio + imagem + slash)
- [ ] Rollout progressivo com gates de aceitação

## Próximo passo recomendado imediato
1. Implementar baseline de KPIs do M0 (coleta + exposição mínima).
2. Iniciar M1 com liberdade conversacional (2-3 parágrafos + tom padrão amigável).
3. Integrar AgentDecisionV2 no orquestrador sob `TOOL_SCHEMA_V2`.

## Tickets técnicos para execução paralela (atualizado)

> Objetivo desta quebra: cobrir também memórias “sem corpo”, enrich completo por tipo (ex.: filmes com diretor/ano/elenco etc.) e salvamento de mensagens longas (ex.: receita) como nota com contexto curto para busca vetorial.

### Trilha A — Modelo de memória e indexação

**TKT-A1 — Memory canonical model v2**  
**Escopo**
- Definir shape canônico para memória com:
  - `memory_type` (movie, tv_show, video, link, note, book, music, generic_memory),
  - `source_modality` (text, audio, image, mixed),
  - `raw_content` opcional (suporta memória sem corpo),
  - `semantic_context` obrigatório (resumo curto para embedding),
  - `metadata` tipado por domínio.
- Garantir que memória sem `raw_content` ainda possa ser salva e pesquisada via `semantic_context`.
**Dependência:** nenhuma.  
**Paralelismo:** base para B/C, mas pode começar sozinho.

**TKT-A2 — Embedding document builders por tipo**  
**Escopo**
- Criar builders de documento vetorial por tipo (movie/note/book/music/link/etc.).
- Para filme, combinar campos: título, ano, diretor, elenco principal, gêneros, overview, runtime e providers.
- Para nota longa (ex.: receita), incluir `semantic_context` + corpo normalizado.
**Dependência:** A1.

### Trilha B — Tools específicas de save/search

**TKT-B1 — Save tools de domínio rico (filme/livro/música/etc.)**  
**Escopo**
- Reforçar ferramentas para salvar por domínio com enriquecimento mínimo obrigatório por tipo.
- Ex.: `save_movie` só finaliza após metadata essencial (ano + diretor + pelo menos 2 campos adicionais).
**Dependência:** A1.  
**Paralelismo:** pode rodar junto com C1/C2.

**TKT-B2 — Generic memory sem corpo**  
**Escopo**
- Adicionar fluxo/tool para memória “leve” sem corpo completo (insight rápido, ideia curta).
- Runtime deve gerar `semantic_context` curto e salvar mesmo sem texto longo.
**Dependência:** A1.

**TKT-B3 — Search tools por estratégia**  
**Escopo**
- Definir busca híbrida por tipo:
  - metadados estruturados (quando houver),
  - vetor via `semantic_context`.
- Melhorar recall para consultas naturais.
**Dependência:** A2 + B1.

### Trilha C — Orquestração e ambiguidade

**TKT-C1 — Intent/type disambiguation policy**  
**Escopo**
- Se ambíguo entre tipos (ex.: “clube da luta” pode filme/livro), perguntar antes de salvar.
- Se mensagem longa e descritiva (ex.: receita), priorizar nota com contexto.
**Dependência:** nenhuma (usa contrato atual).  
**Paralelismo:** total com A1/B1.

**TKT-C2 — Save-note contextualizer**  
**Escopo**
- Para texto longo: gerar `semantic_context` (1-3 frases), tags e título curto.
- Armazenar contexto + conteúdo para futura busca vetorial.
**Dependência:** A1.

**TKT-C3 — AgentDecisionV2 integration in orchestrator**  
**Escopo**
- Integrar decisão V2 no fluxo principal com flags.
- Enforçar caminho determinístico para saves/updates/deletes.
**Dependência:** B1 + C1.

### Trilha D — Qualidade e rollout

**TKT-D1 — Test matrix (unit/integration/e2e)**  
**Escopo**
- Casos obrigatórios:
  1) filme com metadata rica,
  2) mensagem longa (receita) salva como nota contextualizada,
  3) memória sem corpo salva e recuperável,
  4) ambiguidade dispara pergunta.
**Dependência:** A2 + B2 + C1.

**TKT-D2 — KPI baseline + regressão**  
**Escopo**
- Medir false-save, invalid decision JSON, latência e qualidade de recuperação.
**Dependência:** C3 + D1.

## Ordem recomendada para paralelizar (com worktrees)

1. **Sprint wave 1:** A1 + C1 em paralelo.  
2. **Sprint wave 2:** A2 + B1 + C2 em paralelo.  
3. **Sprint wave 3:** B2 + B3 + C3 em paralelo.  
4. **Sprint wave 4:** D1 + D2.

## Regras operacionais (mantendo o combinado)

- Sempre: `feature -> testes -> verdinho -> next`.
- 1 commit por ticket concluído.
- PR #93 atualizado incrementalmente a cada ticket verde.
