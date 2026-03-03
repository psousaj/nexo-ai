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

## M2 — Tool Contract V2 Enforcement
- [ ] Integrar AgentDecisionV2 no orquestrador como caminho oficial (guarded por flag)
- [ ] Matriz determinística por risco (quando exige confirmação)
- [ ] Reforço de validação/retry com erro explícito de contrato

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
