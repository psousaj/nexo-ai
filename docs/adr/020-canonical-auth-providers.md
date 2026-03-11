# ADR-021: Modelo canônico de identidade com auth_providers

**Status**: accepted  
**Data**: 2026-02-25

## Contexto

O sistema acumulou inconsistências de identidade ao manter duas fontes de verdade para vínculos de provider:

- Better Auth (`account`) para OAuth/sessão
- Tabela de app `user_accounts` para runtime de mensageria

Esse desenho gerou comportamento não determinístico em fluxos multi-provider (Telegram/WhatsApp/Discord), incluindo criação de conta duplicada seguida de merge posterior.

## Decisão

Adotar `auth_providers` como **fonte canônica** de vínculo entre usuário interno e identidades externas.

### Modelo

- `users`: entidade interna global
- `auth_providers`: vínculos externos por provider
  - `UNIQUE(provider, provider_user_id)`
  - `UNIQUE(user_id, provider)`

### Regras de segurança

- Não fazer auto-link por email em fluxo não autenticado.
- Vinculação autenticada usa usuário logado + `provider_user_id`.
- Para providers sem vínculo prévio:
  - WhatsApp pode iniciar trial.
  - Telegram/Discord exigem cadastro/vinculação explícita.

### Naming de vínculo

Padronizar código de vínculo no produto como `vinculate_code` (query param e payloads de integração).

## Consequências

### Positivas

- Uma única fonte de verdade no runtime para identidade de provider.
- Redução de duplicações e merges tardios.
- Fluxo multi-provider previsível e auditável.

### Negativas

- Exige migração de serviços e documentação legada.
- Necessita manutenção temporária de tabelas históricas até remoção completa.

## Alternativas Consideradas

1. **Manter `user_accounts` + sync eventual**: rejeitada por manter race conditions e divergência.
2. **Many-to-many entre users e providers**: rejeitada; regra de negócio é 1 usuário com até 1 conta por provider.
3. **Auto-link por email não autenticado**: rejeitada por risco de takeover.

## ADRs Relacionadas

- [ADR-007](007-multi-provider-support.md)
- [ADR-011](011-deterministic-runtime-control.md)
