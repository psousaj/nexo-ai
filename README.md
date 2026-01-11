# Nexo AI

Assistente pessoal via Telegram que organiza, categoriza e enriquece automaticamente conteúdo usando IA.

v0.2.0: Dashboard web para linking manual de contas
v0.3.0: Suporte a Discord (provider sem telefone)
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
bun install
```

### 2. Configurar environment

```bash
cp .env.example .env
# Edite .env com suas credenciais
```

**Principais variáveis** (ver [docs/SETUP.md](docs/SETUP.md) para detalhes):

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
bun run db:generate

# Aplica no banco
bun run db:push
```

### 4. Rodar em desenvolvimento

```bash
bun run dev
```

API disponível em `http://localhost:3000`  
Documentação em `http://localhost:3000/swagger`

## 📁 Estrutura

```
nexo-ai/
├── src/
│   ├── adapters/        # Messaging providers (Telegram, WhatsApp)
│   ├── config/          # Environment, database
│   ├── db/schema/       # Drizzle schemas
│   ├── services/        # Lógica de negócio
│   │   ├── ai/          # AI integration (Cloudflare/Gemini)
│   │   └── enrichment/  # TMDB, YouTube, OpenGraph
│   ├── routes/          # REST endpoints
│   └── index.ts         # Entry point
├── docs/                # Documentação detalhada
└── scripts/             # Setup e deploy
```

Ver [docs/ESTRUTURA.md](docs/ESTRUTURA.md) para detalhes completos.

## 🛠️ Stack Tecnológico

| Categoria      | Tecnologia                                |
| -------------- | ----------------------------------------- |
| **Runtime**    | Bun                                       |
| **Framework**  | Elysia                                    |
| **Database**   | PostgreSQL (Supabase)                     |
| **ORM**        | Drizzle                                   |
| **Deploy**     | Cloudflare Workers                        |
| **Chat**       | Telegram Bot API (padrão)                 |
| **WhatsApp**   | Meta WhatsApp API (feature futura)        |
| **AI**         | Cloudflare Workers AI + Gemini (Fallback) |
| **Enrichment** | TMDB, YouTube Data API, OpenGraph         |

## ��� Documentação

### Guias

- **[Arquitetura](docs/ARQUITETURA.md)** - Camadas, state machine, fluxos
- **[Setup & Deploy](docs/SETUP.md)** - Environment, secrets, deploy
- **[Deployment](docs/DEPLOYMENT.md)** - Guia Cloudflare Workers
- **[Estrutura](docs/ESTRUTURA.md)** - Organização do código
- **[Referência](docs/REFERENCIA.md)** - Database schema e API

### ADRs (Architecture Decision Records)

- [ADR-001](docs/adr/001-cloudflare-workers.md) - Cloudflare Workers
- [ADR-002](docs/adr/002-supabase-postgres.md) - Supabase PostgreSQL
- [ADR-003](docs/adr/003-jsonb-metadata.md) - JSONB metadata
- [ADR-004](docs/adr/004-state-machine.md) - State machine
- [ADR-005](docs/adr/005-ai-agnostic.md) - AI-agnostic architecture
- [ADR-006](docs/adr/006-meta-whatsapp-api.md) - Meta WhatsApp API

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

# Testes
bun test                 # Roda testes

# Deploy
wrangler deploy          # Deploy Cloudflare Workers
wrangler tail            # Logs em tempo real
```

## ��� Deploy

### Cloudflare Workers

```bash
# 1. Login
wrangler login

# 2. Configurar secrets
wrangler secret put DATABASE_URL
wrangler secret put META_WHATSAPP_TOKEN
wrangler secret put ANTHROPIC_API_KEY
# ... (ver docs/DEPLOYMENT.md)

# 3. Deploy
wrangler deploy
```

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
