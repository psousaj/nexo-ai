# Nexo AI

Assistente pessoal via Telegram que organiza, categoriza e enriquece automaticamente conteúdo usando IA.

**v0.3.0** - Arquitetura Determinística Completa ✅

- ✅ **Controle runtime determinístico** - LLM apenas planeja, código executa
- ✅ **Schema JSON único** - `AgentLLMResponse` validado
- ✅ **11 tools específicas** - Contratos fortes (save_note, save_movie, enrich_movie, etc)
- ✅ **Zero conversação livre** - LLM nunca pergunta "quer que eu salve?"
- ✅ **Ações determinísticas** - delete_all, list_all sem LLM
- 📖 [Ver refatoração completa](docs/concepts/deterministic-runtime.md)

v0.2.0: Dashboard web para linking manual de contas
Futuro: Ativar WhatsApp quando houver demanda

## 🎯 O que faz?

Envie mensagens sobre filmes, vídeos, links ou notas pelo Telegram (ou WhatsApp):

- **Identifica** o tipo de conteúdo automaticamente
- **Enriquece** com metadados (TMDB, YouTube, OpenGraph)
- **Organiza** e salva no PostgreSQL com busca inteligente
- **Responde** de forma natural usando IA
- **Unifica** usuários cross-provider (mesmo telefone = mesma conta)

### Exemplos de uso

```
Você: "clube da luta"
Bot: Encontrei vários filmes:
     1. Fight Club (1999) - David Fincher ⭐ 8.8
     2. The Fight Club (2020)
     Qual você quer salvar?

Você: "1"
Bot: ✅ Fight Club (1999)
     Disponível em: Netflix, Amazon Prime
```

## 🚀 Quick Start

### 1. Instalar dependências

```bash
pnpm install
```

### 2. Configurar environment

```bash
cp .env.example .env
# Edite .env com suas credenciais
```

**Principais variáveis** (ver [docs/tutorials/setup-environment.md](docs/tutorials/setup-environment.md) para detalhes):

- `DATABASE_URL` - PostgreSQL (ou Supabase)
- `TELEGRAM_BOT_TOKEN` - Token do bot Telegram (via @BotFather)
- `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` - Cloudflare Workers AI
- `GOOGLE_API_KEY` - Google Gemini (opcional, fallback)
- `TMDB_API_KEY` - The Movie Database
- `YOUTUBE_API_KEY` - YouTube Data API
- (Opcional) `META_WHATSAPP_TOKEN` - WhatsApp Business (feature futura)

### 3. Setup database

```bash
# Gera migrations
pnpm run db:generate

# Aplica no banco
pnpm run db:push
```

### 4. Rodar em desenvolvimento

```bash
pnpm run dev
```

API disponível em `http://localhost:3000`  
**Documentação OpenAPI (Scalar UI)** em `http://localhost:3000/reference`

## 📁 Estrutura

```
nexo-ai/
├── apps/
│   ├── api/              # API principal (Bun + Elysia)
│   ├── dashboard/        # Dashboard web (Vue 3)
│   ├── landing/          # Landing page (Vite)
│   └── old-dashboard/    # Dashboard legado
├── docs/                 # Documentação completa (BMAD-style)
├── packages/             # Packages compartilhados
└── package.json          # Monorepo root
```

Ver [docs/README.md](docs/README.md) para documentação completa.

## 🛠️ Stack Tecnológico

| Categoria         | Tecnologia                                  |
| ----------------- | ------------------------------------------- |
| **Runtime**       | Bun                                         |
| **Framework**     | Elysia                                      |
| **Database**      | PostgreSQL (Supabase)                       |
| **ORM**           | Drizzle                                     |
| **Deploy**        | Cloudflare Workers / Docker                 |
| **Chat**          | Telegram Bot API (padrão)                   |
| **WhatsApp**      | Meta WhatsApp API (feature futura)          |
| **AI**            | Google Gemini (SDK) + Cloudflare (Fallback) |
| **Enrichment**    | TMDB, YouTube Data API, OpenGraph           |
| **Docs**          | OpenAPI/Scalar via @elysiajs/openapi        |
| **Observability** | OpenTelemetry + Uptrace                     |

## ��� Documentação

### 📖 Tutorials

- **[Getting Started](docs/tutorials/getting-started.md)** - Instalação e primeiro uso em 5 minutos
- **[Setup de Ambiente](docs/tutorials/setup-environment.md)** - Configuração completa

### 🛠️ How-To Guides

- **[Busca Avançada](docs/how-to/advanced-search.md)** - Filtros avançados e queries complexas
- **[Busca Semântica](docs/how-to/semantic-search.md)** - Sistema de embeddings e cache

### 💡 Concepts

- **[Visão Geral da Arquitetura](docs/concepts/architecture-overview.md)** - Camadas, fluxos e componentes
- **[Controle Runtime Determinístico](docs/concepts/deterministic-runtime.md)** - Pattern Hugging Face Agents
- **[State Machine](docs/concepts/state-machine.md)** - Máquina de estados de conversação

### 📋 Reference

- **[BMAD Agents](docs/reference/agents.md)** - Agentes e workflows BMAD
- **[Implementation Checklist](docs/reference/implementation-checklist.md)** - Status da refatoração v0.3.0
- **[Roadmap](docs/reference/roadmap.md)** - Planejamento de versões

### 📐 ADRs (Architecture Decision Records)

- **[Todos os ADRs](docs/adr/README.md)** - Decisões arquiteturais documentadas
- [ADR-011](docs/adr/011-deterministic-runtime-control.md) - Controle runtime determinístico

## ��� Comandos

```bash
# Desenvolvimento
bun run dev              # Roda servidor local
bun run build            # Build para produção
bun run start            # Roda build

# Database
bun run db:generate      # Gera migrations
bun run db:push          # Aplica migrations
bun run db:studio        # Abre Drizzle Studio
pnpm run db:generate
# Testes
bun test                 # Roda testes
pnpm run db:push
# Deploy
wrangler deploy          # Deploy Cloudflare Workers
wrangler tail            # Logs em tempo real
```

pnpm run dev

### Cloudflare Workers

```bash
# 1. Login
wrangler login
pnpm run dev              # Roda servidor local
pnpm run build            # Build para produção
pnpm run start            # Roda build
wrangler secret put META_WHATSAPP_TOKEN
wrangler secret put ANTHROPIC_API_KEY
pnpm run db:generate      # Gera migrations
pnpm run db:push          # Aplica migrations
pnpm run db:studio        # Abre Drizzle Studio
wrangler deploy
```
pnpm test                 # Roda testes
Ver guia completo em [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## ���️ Arquitetura

### State Machine de Conversação

```
idle → awaiting_confirmation → enriching → saving → idle
  ↓                               ↓
  └────────────── error ──────────┘
```

### Fluxo de Dados

```
WhatsApp → Webhook → Conversation Manager → AI Service
                          ↓
                    Enrichment APIs (TMDB/YouTube)
                          ↓
                    PostgreSQL (Supabase)
```

Ver detalhes em [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## ��� Princípios Arquiteturais

1. **Adapters são simples** - apenas traduzem requisições
2. **Services são provider-agnostic** - podem trocar LLM/APIs
3. **JSONB para flexibilidade** - metadados diferentes por tipo
4. **State persistido** - conversação sobrevive a cold starts

## ��� Licença

MIT

## ��� Contribuindo

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## ��� Contato

Para dúvidas e sugestões, abra uma issue no GitHub.
