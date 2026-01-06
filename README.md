# Nexo AI

Assistente pessoal via WhatsApp que organiza, categoriza e enriquece automaticamente conteúdo usando IA.

## O que faz?

Envie mensagens sobre filmes, vídeos, links ou notas pelo WhatsApp:

- Identifica o tipo de conteúdo automaticamente
- Enriquece com metadados (TMDB, YouTube, OpenGraph)
- Salva organizado no PostgreSQL com busca inteligente

## Quick Start

```bash
# Instalar
bun install

# Configurar environment
cp .env.example .env

# Database
bun run db:generate
bun run db:push

# Rodar
bun run dev
```

## Stack

- **Runtime**: Bun + Elysia
- **Deploy**: Cloudflare Workers
- **Database**: Supabase (PostgreSQL + JSONB)
- **ORM**: Drizzle
- **WhatsApp**: Meta API oficial
- **AI**: Claude (Anthropic)
- **Enrichment**: TMDB, YouTube Data API, OpenGraph

## Documentação

- **[Arquitetura](docs/ARQUITETURA.md)** - Camadas, state machine, fluxos
- **[Setup & Deploy](docs/SETUP.md)** - Environment, secrets, deploy
- **[Referência](docs/REFERENCIA.md)** - Database schema e API
- **[ADRs](docs/adr/README.md)** - Architecture Decision Records

## Licença

MIT
