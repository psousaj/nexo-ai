# TODO - Feature Flags e Observabilidade

Checklist técnico para ativar/desativar comportamentos sensíveis sem novo deploy.

## 1) Instrumentação de Services

- [ ] Criar env `SERVICE_INSTRUMENTATION_ENABLED` (default: `false` em prod, `true` em dev)
- [ ] Condicionar `instrumentService(...)` ao flag (retornar instância original quando desligado)
- [ ] Criar env `SERVICE_INSTRUMENTATION_LOG_LEVEL` (`debug|info|warn|error`)
- [ ] Definir allowlist de serviços por env (`SERVICE_INSTRUMENTATION_INCLUDE=agentOrchestrator,user,item`)
- [ ] Definir blocklist de serviços por env (`SERVICE_INSTRUMENTATION_EXCLUDE=embedding,tmdb`)
- [ ] Reduzir payload de logs (não logar args completos por padrão)
- [ ] Adicionar atributo OTEL `service.instrumented=true|false`

## 2) Feature Flags de Tools (runtime)

- [ ] Criar flag global: `TOOLS_RUNTIME_FLAGS_ENABLED`
- [ ] Criar flags por categoria:
  - [ ] `TOOLS_SAVE_ENABLED`
  - [ ] `TOOLS_SEARCH_ENABLED`
  - [ ] `TOOLS_ENRICHMENT_ENABLED`
- [ ] Criar flags por tool crítica:
  - [ ] `TOOL_SAVE_MOVIE_ENABLED`
  - [ ] `TOOL_SAVE_TV_SHOW_ENABLED`
  - [ ] `TOOL_SAVE_VIDEO_ENABLED`
  - [ ] `TOOL_SAVE_LINK_ENABLED`
  - [ ] `TOOL_SAVE_NOTE_ENABLED`
- [ ] Aplicar no `tool.service.ts`/registry antes da execução
- [ ] Expor estado efetivo das flags no endpoint admin

## 3) Flags de Onboarding / Trial

- [ ] `ONBOARDING_TRIAL_ENABLED`
- [ ] `ONBOARDING_TRIAL_LIMIT` (substituir constante fixa)
- [ ] `ONBOARDING_WHATSAPP_ALLOW_TRIAL`
- [ ] `ONBOARDING_TELEGRAM_REQUIRE_SIGNUP`
- [ ] `ONBOARDING_AUTO_ACTIVATE_BETTER_AUTH`

## 4) Flags de Email e Verificação

- [ ] `EMAIL_CONFIRMATION_REQUIRED` (gate no dashboard)
- [ ] `EMAIL_SEND_ENABLED` (kill-switch para Resend)
- [ ] `EMAIL_CONFIRM_TOKEN_TTL_MINUTES`
- [ ] `EMAIL_RESEND_RATE_LIMIT_MINUTES`

## 5) Flags de Segurança / Resiliência

- [ ] `WEBHOOK_SIGNATURE_ENFORCE_WHATSAPP`
- [ ] `WEBHOOK_SIGNATURE_ENFORCE_TELEGRAM`
- [ ] `QUEUE_MESSAGE_RETRIES`
- [ ] `QUEUE_RESPONSE_RETRIES`
- [ ] `QUEUE_ENABLE_DEAD_LETTER_LOG`

## 6) Flags de Busca / IA

- [ ] `SEMANTIC_SEARCH_ENABLED`
- [ ] `HYBRID_SEARCH_ENABLED`
- [ ] `QUERY_EXPANSION_ENABLED`
- [ ] `ENRICHMENT_BACKGROUND_ENABLED`
- [ ] `LLM_INTENT_FALLBACK_ENABLED`

## 7) Operação e Governança

- [ ] Criar documento de matriz de defaults por ambiente (`dev/staging/prod`)
- [ ] Adicionar endpoint `/admin/feature-flags` (read-only inicial)
- [ ] Adicionar auditoria de alteração de flags críticas
- [ ] Adicionar smoke tests para cenários com flags on/off
- [ ] Adicionar seção no runbook de incidentes com kill-switches

## Prioridade sugerida (curto prazo)

1. `SERVICE_INSTRUMENTATION_ENABLED`
2. `ONBOARDING_TRIAL_LIMIT`
3. `EMAIL_CONFIRMATION_REQUIRED`
4. `TOOLS_RUNTIME_FLAGS_ENABLED`
5. `WEBHOOK_SIGNATURE_ENFORCE_WHATSAPP`
