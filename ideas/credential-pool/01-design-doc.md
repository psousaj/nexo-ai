# Pool de Credenciais — Global & Per-User

## One-Line Summary

Sistema de两层 de credenciais para o Nexo AI: **CredentialPool global** para chaves de aplicação + **Better Auth OAuth per-user** para autenticação delegada, permitindo que tools operem tanto com credenciais da aplicação quanto em nome do usuário.

## Problem / Purpose

O Nexo AI precisa suportar dois tipos de credenciais para suas tools:

1. **Credenciais Globais (App-Level)** — chaves da aplicação que independem do usuário (API keys de LLMs, Spotify Client Credentials para search público, TMDB, Brave Search, etc.)
2. **Credenciais Per-User** — tokens OAuth vinculados à conta de cada usuário para operações que agem "como o usuário" (Spotify playback/playlists, YouTube Music, Google Drive, etc.)

Sem essa distinção, o sistema:
- Mistura chaves globais com tokens pessoais no mesmo lugar
- Não consegue escalar para múltiplos usuários (cada um com suas próprias contas vinculadas)
- Expõe risco de segurança (um token de usuário vazar para outro)

## Product Philosophy

- **Separação clara de responsabilidades**: O que é da app fica no pool global; o que é do usuário fica no OAuth dele
- **Segurança por isolamento**: Cada usuário vê APENAS os dados da conta dele
- **Transparência para o desenvolvedor**: Ao implementar uma nova tool, o dev escolhe o tipo de credencial e o sistema resolve automaticamente
- **Extensibilidade**: Novo serviço = novo provider no Better Auth + nova entrada no CredentialPool

## Target User

Desenvolvedores do Nexo AI (você) que implementam novas tools e precisam de um sistema claro e seguro de credenciais.

## Core Concept

```
┌──────────────────────────────────────────────────────────────┐
│                     Nexo Credential System                    │
│                                                              │
│  ┌─────────────────────┐    ┌────────────────────────────┐   │
│  │   CredentialPool     │    │      Better Auth           │   │
│  │   (Global / App)     │    │    (Per-User OAuth)        │   │
│  │                      │    │                            │   │
│  │  • SPOTIFY_CLIENT_ID │    │  ┌──────────┐              │   │
│  │  • OPENAI_API_KEY    │    │  │ User A   │  Spotify     │   │
│  │  • TMDB_API_KEY      │    │  │ User B   │  Spotify     │   │
│  │  • DEEPSEEK_API_KEY  │    │  │ User C   │  Spotify     │   │
│  │  • BRAVE_API_KEY     │    │  └──────────┘              │   │
│  └──────────┬───────────┘    └────────────┬───────────────┘   │
│             │                              │                   │
│             ▼                              ▼                   │
│  ┌──────────────────────────────────────────────────────┐     │
│  │              Tool Execution Layer                     │     │
│  │                                                       │     │
│  │  Spotify Search → CredentialPool (global token)       │     │
│  │  Spotify Playback → Better Auth (per-user token)      │     │
│  │  LLM Call → CredentialPool (round-robin keys)         │     │
│  └──────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
```

## Key Features

1. **CredentialPool (já existe)** — Pool de chaves globais com estratégias de rotação (fill_first, round_robin, random) e cooldown de exaustão
2. **Better Auth Account Linking** — Vinculação de contas OAuth por usuário (já implementado parcialmente)
3. **Resolução automática** — Tool especifica o tipo de credencial, sistema resolve qual token usar
4. **Credential Provider Plugin** — Plugin do Better Auth para providers customizados (Spotify via Generic OAuth)
5. **Dashboard UI** — Tela para usuário vincular/desvincular contas de terceiros
6. **Multi-tenant isolation** — Usuário A NUNCA vê dados do Usuário B

## Technical Shape

### Stack
- **Better Auth** — Autenticação + OAuth provider linking (já em uso)
- **CredentialPool** — Classe TypeScript existente em `apps/api/src/core/model/credential-pool.ts`
- **Generic OAuth Plugin** — Plugin do Better Auth para providers sem suporte nativo (Spotify)
- **PostgreSQL** — Armazenamento dos tokens OAuth (gerenciado pelo Better Auth)
- **Dashboard React (Futuro)** — UI de vinculação de contas

### Já implementado
- `CredentialPool` com suporte a múltiplas chaves, estratégias e cooldown
- `SpotifyService` com Client Credentials (search público)
- Schema `auth_providers` no banco (vincula user → provider externo)
- Dashboard Vue com estrutura de settings (precisa migrar pra React)

### A implementar
- Generic OAuth Plugin do Better Auth configurado para Spotify
- `SpotifyUserService` para operações per-user
- Mapeamento Telegram → Dashboard User (Ghost System)
- Tela de vinculação de contas no Dashboard
- Refatoração do sistema de env vars para usar CredentialPool + Better Auth

## Data / Integrations / Platform Needs

- **Banco**: PostgreSQL (já existente no Nexo)
- **Cache**: Redis (já existente)
- **OAuth**: Better Auth gerencia refresh tokens automaticamente
- **API externa**: Spotify Web API, futuramente YouTube Music API, Google Drive API, etc.

## Hosting / Data Location

- Mesmo hosting atual do Nexo (DO Droplet + Coolify)
- Tokens OAuth armazenados no PostgreSQL do Better Auth (criptografados por padrão)
- Chaves globais em env vars + CredentialPool

## Platform Targets

- Web (Dashboard React)
- API (Nexo API — Hono/Node.js)
- Telegram / WhatsApp / Discord (canais existentes)

## Non-Goals

- ❌ Não implementar autenticação própria — Better Auth já resolve
- ❌ Não armazenar tokens em localStorage ou client-side
- ❌ Não misturar lógica de credencial global com per-user no mesmo serviço
- ❌ Não suportar credenciais de terceiros sem OAuth (ex: senha de email)

## Open Questions

- Como fazer o mapeamento Telegram chat_id → Dashboard userId? (depende do NEX-75 Ghost System)
- Qual a estratégia de fallback se o token per-user expirar e o refresh falhar?
- Os providers do Generic OAuth Plugin do Better Auth suportam scopes customizados?

## Next Steps

1. ✅ Pesquisar Better Auth + Generic OAuth Plugin
2. 🔲 Configurar Generic OAuth Plugin com Spotify como provider de teste
3. 🔲 Implementar SpotifyUserService
4. 🔲 Migrar Dashboard para React (NEX-77)
5. 🔲 Implementar tela de vinculação de contas
6. 🔲 Documentar padrão para novas tools
