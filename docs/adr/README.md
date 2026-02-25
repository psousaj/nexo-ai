# Architecture Decision Records (ADR)

Registro de decisões arquiteturais do Nexo AI.

## Índice

- [ADR-001](001-cloudflare-workers.md) - Cloudflare Workers como plataforma de deploy
- [ADR-002](002-supabase-postgres.md) - Supabase como database
- [ADR-003](003-jsonb-metadata.md) - JSONB para metadados flexíveis
- [ADR-004](004-state-machine.md) - State machine para conversação
- [ADR-005](005-ai-agnostic.md) - Arquitetura AI-agnostic
- [ADR-006](006-meta-whatsapp-api.md) - Meta WhatsApp API oficial
- [ADR-007](007-multi-provider-support.md) - Multi-provider messaging architecture
- [ADR-008](008-advanced-state-machine.md) - Advanced state machine (postponed until v1.0+)
- [ADR-009](009-no-mcp-mvp.md) - MCP Server é opcional no MVP
- [ADR-010](010-sync-enrichment-mvp.md) - Enriquecimento síncrono no MVP
- [ADR-011](011-deterministic-runtime-control.md) - Controle runtime determinístico (v0.3.0)
- [ADR-012](012-bun-test-framework.md) - Bun Test como framework de testes
- [ADR-013](013-conversational-anamnesis.md) - Anamnese conversacional (clarificação N1/N2)
- [ADR-014](014-document-enrichment-strategy.md) - Document Enrichment para busca semântica (v0.3.2)
- [ADR-020](020-baileys-405-platform-fix.md) - ⚠️ Workaround 405 Baileys (Platform.WEB rejeitado em 2026-02-24) — checar ao atualizar

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
