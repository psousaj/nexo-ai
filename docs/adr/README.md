# Architecture Decision Records (ADR)

Registro de decisões arquiteturais do Nexo AI.

## Índice

- [ADR-001](001-cloudflare-workers.md) - Cloudflare Workers como plataforma de deploy
- [ADR-002](002-supabase-postgres.md) - Supabase como database
- [ADR-003](003-jsonb-metadata.md) - JSONB para metadados flexíveis
- [ADR-004](004-state-machine.md) - State machine para conversação
- [ADR-005](005-ai-agnostic.md) - Arquitetura AI-agnostic
- [ADR-006](006-meta-whatsapp-api.md) - Meta WhatsApp API oficial

## Template

Para novas decisões, use:

```markdown
# ADR-XXX: Título da Decisão

**Status**: proposed | accepted | deprecated | superseded

**Data**: YYYY-MM-DD

## Contexto

Situação e forças que levaram à decisão.

## Decisão

O que foi decidido.

## Consequências

### Positivas

- Benefício 1
- Benefício 2

### Negativas

- Trade-off 1
- Trade-off 2

## Alternativas Consideradas

1. **Alternativa A**: Por que não foi escolhida
2. **Alternativa B**: Por que não foi escolhida
```
