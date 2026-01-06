# Nexo AI - Assistente Pessoal WhatsApp

Sistema de assistente pessoal via WhatsApp que organiza, categoriza e enriquece automaticamente diferentes tipos de conteúdo usando IA.

## 🎯 O que é?

Envie mensagens sobre filmes, vídeos, links ou notas pelo WhatsApp e o assistente:

- Identifica o tipo de conteúdo
- Enriquece com metadados (avaliações, streaming, etc)
- Organiza em categorias
- Permite busca e gerenciamento

## 🚀 Quick Start

```bash
# Instalar dependências
bun install

# Configurar environment
cp .env.example .env

# Setup database
bun run db:generate
bun run db:push

# Iniciar desenvolvimento
bun run dev
```

## 📚 Documentação

> **[📑 Índice Completo da Documentação](docs/INDEX.md)** - Guia de navegação

### Começando

- **[Stack Tecnológica](docs/STACK.md)** - Tecnologias e decisões técnicas
- **[Environment Variables](docs/ENV.md)** - Configuração de variáveis de ambiente
- **[Deployment](docs/DEPLOYMENT.md)** - Deploy no Cloudflare Workers

### Arquitetura

- **[Arquitetura](docs/ARQUITETURA.md)** - Visão geral do sistema e fluxos
- **[Database Schema](docs/SCHEMA.md)** - Estrutura do banco PostgreSQL
- **[Estrutura do Projeto](docs/ESTRUTURA.md)** - Organização de arquivos
- **[ADRs](docs/adr/README.md)** - Por quê das decisões técnicas

### Referência

- **[API Endpoints](docs/ENDPOINTS.md)** - Documentação completa da API REST
- **[Tipos de Metadados](docs/METADA.md)** - Estruturas JSONB por tipo de item
- **[Roadmap](docs/ROADMAP.md)** - Planejamento e próximas features

## 🛠️ Stack Principal

- **Runtime**: Bun + Elysia
- **Deploy**: Cloudflare Workers
- **Database**: Supabase (PostgreSQL + JSONB)
- **WhatsApp**: Meta WhatsApp Business API
- **AI**: Claude API (Anthropic)
- **Enrichment**: TMDB, YouTube Data API, OpenGraph

## 🔥 Features

- ✅ Recebe mensagens via WhatsApp
- ✅ Classifica conteúdo automaticamente
- ✅ Enriquece com metadados externos
- ✅ Salva e organiza items
- ✅ API REST completa
- 🚧 MCP Server (em progresso)
- 🚧 Dashboard web (planejado)
- 🚧 Recomendações inteligentes (planejado)

## 📝 Exemplo de Uso

```
Usuário: "quero assistir clube da luta"

Bot: Encontrei 2 filmes:
     1. Fight Club (1999) - David Fincher
     2. The Fight Club (2020)

     Qual você quer salvar?

Usuário: "o primeiro"

Bot: ✅ Salvei "Fight Club" (1999)
     Disponível em: Netflix, Amazon Prime
     IMDb: 8.8/10
```

## 🏗️ Arquitetura Simplificada

```
WhatsApp → Webhook → Conversation Manager → AI
                           ↓
                    Enrichment APIs
                           ↓
                      PostgreSQL
```

## 🔐 Segurança

- Autenticação Supabase Auth
- Row Level Security (RLS) no PostgreSQL
- Validação de webhooks Meta
- Rate limiting por usuário
- Secrets via Cloudflare Workers

## 📄 Licença

MIT
