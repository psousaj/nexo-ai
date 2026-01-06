# Stack Tecnológica

## Core Stack

- **Runtime**: Bun
- **Framework**: Elysia
- **Database**: Supabase (PostgreSQL + JSONB)
- **ORM**: Drizzle
- **Deploy**: Cloudflare Workers

## APIs Externas

- **WhatsApp**: Meta WhatsApp Business API
- **AI**: Claude API (Anthropic)
- **Enrichment**: TMDB, YouTube Data API, OpenGraph

## Decisões Arquiteturais

Decisões técnicas importantes estão documentadas em ADRs (Architecture Decision Records):

- **[ADR-001](adr/001-cloudflare-workers.md)** - Por que Cloudflare Workers
- **[ADR-002](adr/002-supabase-postgres.md)** - Por que Supabase
- **[ADR-003](adr/003-jsonb-metadata.md)** - JSONB para metadados flexíveis
- **[ADR-004](adr/004-state-machine.md)** - State machine de conversação
- **[ADR-005](adr/005-ai-agnostic.md)** - Arquitetura AI-agnostic
- **[ADR-006](adr/006-meta-whatsapp-api.md)** - Meta WhatsApp API oficial

Ver todos os ADRs em [docs/adr/](adr/README.md)
