# ADR-021: Runtime WhatsApp Evolution-Only

Data: 2026-04-09
Status: Aceito

## Contexto

A integração WhatsApp no Nexo evoluiu para execução local self-hosted usando Evolution API em Docker Compose.
Historicamente coexistiam caminhos de runtime e código para Meta WhatsApp API e Baileys, com aliases e pontos de compatibilidade temporários.
Essa convivência aumentava superfície de manutenção e complexidade operacional.

## Decisão

Adotar Evolution como único runtime suportado para WhatsApp neste código-base.

Mudanças estruturais incluídas nesta decisão:

- Remoção dos adapters/serviços legados de Meta/Baileys.
- Remoção dos endpoints legados:
  - /webhook/meta
  - /api/admin/whatsapp-settings/api
  - aliases /api/admin/whatsapp-settings/baileys/*
- Padronização das tipagens para sourceApi/providerApi apenas como evolution.
- Remoção de dependências e patch de @whiskeysockets/baileys do monorepo.
- Atualização de documentação operacional para fluxo Evolution-only.

## Consequências

Positivas:

- Menor acoplamento e menor custo de manutenção.
- Menos caminhos de falha e menos ambiguidade operacional.
- Menor carga cognitiva para suporte e onboarding.

Trade-offs:

- Quebra explícita de compatibilidade com integrações antigas que dependiam de rotas legadas.
- Necessidade de migração para instalações que ainda referenciam endpoints removidos.

## Compatibilidade de Dados

A tabela whatsapp_settings mantém colunas legadas no banco por compatibilidade de schema, mas o código passa a usar nomes neutros de propriedades.
Isso evita migração de banco obrigatória neste passo.

## ADRs Relacionados

- Supersede parcialmente ADR-006 (006-meta-whatsapp-api.md) no contexto deste runtime.
- Supersede ADR-019 (019-baileys-405-platform-fix.md) para execução corrente, mantendo histórico.
