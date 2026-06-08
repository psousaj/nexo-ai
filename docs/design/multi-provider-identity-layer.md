# Multi-Provider Identity & Two-Layer Credential System

**Status:** Draft — Refined Design  
**Created:** 2026-05-13  
**Epic:** Additional Features (NEX-79)  
**Related ADRs:** ADR-021, ADR-007, ADR-011  

---

## 1. Problem Statement

O Nexo AI precisa de um sistema de credenciais de **duas camadas**:

1. **Camada Global** (já existe via `CredentialPool.ts`) — chaves de API para LLMs e serviços compartilhados
2. **Camada Per-User** (nova) — tokens OAuth vinculados a cada usuário interno do sistema, permitindo que tools como Spotify Playback, Google Calendar, Microsoft Graph, Discord API ajam **em nome do usuário real**, não de uma conta de serviço genérica

**Problema atual:** O Telegram handler recebe `from.id` mas **nunca resolve quem é o usuário internamente**. Não há mapping de `(telegram, 123456) → users.id → OAuth tokens`. Tools como Spotify Playback são impossíveis sem esse mapping.

---

## 2. Referência: Padrão Hermes Agent

O Hermes Agent implementa um padrão de duas camadas que serve de inspiração:

### Layer 1 — CredentialPool (Hermes)
- `agent/credential_pool.py` (~1.584 LOC)
- Gerencia chaves de API LLM com 4 estratégias: `fill_first`, `round_robin`, `random`, `least_used`
- Failover automático em 402/429/401 com cooldown TTL
- **NÃO tem noção de usuário** — pool compartilhado global
- Fonte: Hermes Wiki → `credential-pool-and-isolation.md`, `provider-transport-architecture.md`

### Layer 2 — OAuth Per-User (Hermes)
- `agent/auxiliary_client.py` (~2.127 LOC) + `hermes_cli/auth.py`
- Tokens OAuth armazenados em `auth.json` (Codex, Anthropic, GitHub)
- Cada token vinculado a um usuário real com auto-refresh
- Fonte: Hermes Wiki → `auxiliary-client-architecture.md`

### Lacuna do Hermes
O Hermes **não faz mapping automático de plataforma → userId interno**. Ele usa SessionKey `platform:chat_id:user_id` e assume isolamento por chat. O Nexo precisa ir além — resolver identidade contra o banco e injetar no runtime.

---

## 3. Arquitetura Proposta

```
┌──────────────────────────────────────────────────────────────────┐
│                     TWO-LAYER CREDENTIAL SYSTEM                  │
├────────────────────────────┬─────────────────────────────────────┤
│  LAYER 1: Global Pool      │  LAYER 2: Per-User OAuth           │
│                            │                                     │
│  CredentialPool.ts         │  Better Auth `account` table       │
│  (já existe)               │  (já existe)                       │
│                            │                                     │
│  LLM API Keys              │  Spotify access_token              │
│  (OpenAI, DeepSeek...)     │  Google access_token               │
│                            │  Microsoft access_token            │
│                            │  Discord access_token              │
└────────────────────────────┴─────────────────────────────────────┘
         │                             │
         │                             │
         ▼                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                   UserIdentityResolver (NOVO)                    │
│                                                                  │
│  Entrada: (platform: string, externalUserId: string)             │
│  Saída:   {                                                      │
│             userId: string | null,                                │
│             user: User | null,                                    │
│             linkedProviders: AuthProvider[],                      │
│             oauthTokens: Map<ProviderId, OAuthToken>              │
│           }                                                       │
│                                                                  │
│  Fluxo:                                                           │
│  1. Consulta auth_providers WHERE provider=? AND providerUserId=? │
│  2. Se encontrar → retorna users.id + lista de providers           │
│  3. Para cada provider OAuth (spotify, google, ms, discord):      │
│     a. Consulta account table WHERE userId=? AND providerId=?     │
│     b. Se token expirado → refresh via Better Auth refresh_token  │
│     c. Retorna token ativo                                        │
│  4. Se não encontrar → retorna userId: null                        │
└──────────────────────────────────────────────────────────────────┘
```

### 3.1 UserIdentityResolver — Serviço Central

```typescript
// core/identity/user-identity-resolver.ts

interface ResolvedIdentity {
  userId: string | null;
  user: { id: string; name: string | null; email: string | null } | null;
  linkedProviders: AuthProvider[];
  oauthTokens: Map<string, OAuthToken>;
}

class UserIdentityResolver {
  constructor(
    private db: DrizzleClient,
    private betterAuth: BetterAuthClient
  ) {}

  async resolve(platform: Platform, externalUserId: string): Promise<ResolvedIdentity> {
    // 1. Lookup auth_providers table
    const link = await this.db.query.authProviders.findFirst({
      where: (ap, { eq, and }) => and(
        eq(ap.provider, platform),
        eq(ap.providerUserId, externalUserId)
      ),
      with: { user: true }
    });

    if (!link) return { userId: null, user: null, linkedProviders: [], oauthTokens: new Map() };

    // 2. Get all linked providers for this user
    const allLinks = await this.db.query.authProviders.findMany({
      where: (ap, { eq }) => eq(ap.userId, link.userId)
    });

    // 3. Resolve OAuth tokens from Better Auth account table
    const oauthTokens = new Map<string, OAuthToken>();
    for (const providerLink of allLinks) {
      const token = await this.resolveOAuthToken(link.userId, providerLink.provider);
      if (token) oauthTokens.set(providerLink.provider, token);
    }

    return {
      userId: link.userId,
      user: link.user,
      linkedProviders: allLinks.map(l => l.provider),
      oauthTokens
    };
  }

  private async resolveOAuthToken(userId: string, providerName: string): Promise<OAuthToken | null> {
    const account = await this.db.query.accounts.findFirst({
      where: (a, { eq, and }) => and(
        eq(a.userId, userId),
        eq(a.providerId, providerName)  // 'spotify', 'google', 'microsoft', 'discord'
      )
    });

    if (!account) return null;

    // Check if expired and refresh if needed
    if (account.accessTokenExpiresAt && new Date() >= account.accessTokenExpiresAt) {
      return this.refreshToken(account);
    }

    return {
      accessToken: account.accessToken!,
      refreshToken: account.refreshToken,
      expiresAt: account.accessTokenExpiresAt,
      scope: account.scope
    };
  }

  private async refreshToken(account: Account): Promise<OAuthToken | null> {
    // Better Auth handles the OAuth refresh flow via Generic OAuth Plugin
    // This calls the provider's token endpoint with the refresh_token
    // The plugin's `refreshAccessToken` method handles this automatically
    try {
      const refreshed = await this.betterAuth.refreshSession(account.id);
      return {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        expiresAt: refreshed.accessTokenExpiresAt,
        scope: refreshed.scope
      };
    } catch (e) {
      console.warn(`Failed to refresh token for ${account.providerId}:`, e);
      return null;
    }
  }
}
```

### 3.2 Tool Credential Middleware — Injeção Automática

```typescript
// core/tools/middleware/per-user-credential-middleware.ts

/**
 * Middleware que intercepta tools OAuth-dependentes,
 * resolve identidade do usuário e injeta token.
 *
 * Se o token não existir, retorna erro padronizado
 * para a IA orientar o usuário.
 */
interface ToolCredentialRequest {
  toolName: string;
  provider: string;        // 'spotify', 'google', 'microsoft', 'discord'
  requiredScope?: string;  // e.g. 'playlist-read-private'
  userId: string;
}

interface ToolCredentialResult {
  ok: true;
  token: string;
} | {
  ok: false;
  error: 'oauth_required';
  provider: string;
  dashboardUrl: string;
}

class PerUserCredentialInjector {
  private readonly DASHBOARD_BASE = 'https://dashboard.nexo.app/settings';

  async resolve(req: ToolCredentialRequest): Promise<ToolCredentialResult> {
    const account = await db.query.accounts.findFirst({
      where: (a, { eq, and }) => and(
        eq(a.userId, req.userId),
        eq(a.providerId, req.provider)
      )
    });

    if (!account?.accessToken) {
      return {
        ok: false,
        error: 'oauth_required',
        provider: req.provider,
        dashboardUrl: `${this.DASHBOARD_BASE}/oauth/${req.provider}`
      };
    }

    // Auto-refresh if expired
    if (account.accessTokenExpiresAt && new Date() >= account.accessTokenExpiresAt) {
      const refreshed = await betterAuth.refreshSession(account.id);
      if (!refreshed?.accessToken) {
        return {
          ok: false,
          error: 'oauth_required',
          provider: req.provider,
          dashboardUrl: `${this.DASHBOARD_BASE}/oauth/${req.provider}`
        };
      }
      return { ok: true, token: refreshed.accessToken };
    }

    return { ok: true, token: account.accessToken };
  }
}
```

### 3.3 Tool Error Protocol — IA Orienta o Usuário

```typescript
// core/tools/protocol/tool-errors.ts

/**
 * Erro padronizado retornado por tools OAuth-dependentes
 * quando o usuário não vinculou a conta necessária.
 *
 * A IA (LLM) interpreta esse erro e responde
 * naturalmente orientando o usuário.
 */
const OAUTH_REQUIRED_ERROR = {
  code: 'OAUTH_REQUIRED',
  message: (provider: string, dashboardUrl: string) =>
    `Usuário não vinculou conta ${provider}. ` +
    `Acesse ${dashboardUrl} para conectar via OAuth.`
};

/**
 * Exemplo de resposta da IA quando recebe esse erro:
 *
 * "Você ainda não conectou sua conta do Spotify!
 * Quer que eu te envie o link do Dashboard pra configurar?
 * Lá você pode autorizar o Nexo a controlar sua conta do Spotify."
 */
```

### 3.4 SessionContext Enrichment — IA Sabe o que o Usuário Tem

```typescript
// core/session/session-context-builder.ts (modificado)

// Dentro do build() método, APÓS resolver identidade:
const identity = await userIdentityResolver.resolve(source.platform, source.userId!);

function buildOauthStatus(identity: ResolvedIdentity): string {
  const providers = ['spotify', 'google', 'microsoft', 'discord'];
  const statuses = providers.map(p => {
    const has = identity.oauthTokens.has(p);
    return `${p}: ${has ? '✅' : '❌'}`;
  });
  return statuses.join(' | ');
}

// Output no session context:
// ## Current Session Context
// **Source:** Telegram (DM with José Filho)
// **User:** José Filho (internal_id: abc-123)
// **OAuth:** spotify: ✅ | google: ❌ | microsoft: ❌ | discord: ❌
// **Connected Platforms:** local, telegram: Connected ✓
```

---

## 4. Fluxo Completo (Telegram → Tool)

```
Usuário envia áudio: "Toca Survivor do Bob Marley"
    │
    ├── 1. Telegram webhook recebe update
    │       → STT transcreve: "Toca Survivor do Bob Marley"
    │
    ├── 2. UserIdentityResolver.resolve('telegram', '123456789')
    │       → auth_providers lookup
    │       → userId: 'abc-123'
    │       → linkedProviders: ['telegram', 'spotify']
    │       → oauthTokens: { spotify: { accessToken: '...' } }
    │
    ├── 3. SessionContextBuilder injeta identidade no prompt
    │       "User: José (id: abc-123) — OAuth: spotify ✅, google ❌"
    │
    ├── 4. IA decide: "Vou usar spotify_search primeiro"
    │       → Tool: spotify_search(q: "Survivor Bob Marley")
    │       → CredentialInjector.resolve({ tool, provider:'spotify', userId })
    │       → Token OK → Spotify API → retorna track_id
    │
    ├── 5. IA decide: "Agora spotify_play"
    │       → Tool: spotify_play(track_id: "4T3V4Hx0U...")
    │       → CredentialInjector.resolve({ tool, provider:'spotify', userId })
    │       → Token OK → Spotify Playback API → música tocando ✅
    │
    └── [Caso não tivesse Spotify vinculado]
            → Tool retorna { error: 'oauth_required', provider: 'spotify' }
            → IA responde: "Você ainda não conectou o Spotify!
               Acessa o Dashboard em nexodash.app/settings/oauth/spotify
               que eu te ajudo a configurar. Quer o link?"
```

---

## 5. OAuth Providers Suportados (Fase 1)

| Provider | Better Auth Plugin | Scopes Mínimos | Tool Exemplo |
|---|---|---|---|
| **Spotify** | Generic OAuth | `user-read-playback-state`, `user-modify-playback-state`, `playlist-read-private`, `user-library-read` | `spotify_search`, `spotify_play`, `spotify_queue` |
| **Google** | Generic OAuth | `https://www.googleapis.com/auth/userinfo.email`, `https://www.googleapis.com/auth/userinfo.profile` | Google Calendar, Gmail, YouTube Music |
| **Microsoft** | Generic OAuth | `User.Read`, `Mail.Read`, `Calendars.Read` | Microsoft Graph, Outlook, Teams |
| **Discord** | Generic OAuth | `identify`, `guilds`, `messages.read` | Discord API actions em nome do user |

**Redirect URI (todos):** `https://dashboard.nexo.app/api/auth/oauth2/callback/{provider}`

---

## 6. Componentes e Dependências

| Componente | Arquivo | Depende de | Prioridade |
|---|---|---|---|
| `UserIdentityResolver` | `core/identity/user-identity-resolver.ts` | `auth_providers` table, `account` table | P0 |
| `OAuthTokenRefresher` | `core/identity/oauth-token-refresher.ts` | Better Auth `refreshSession()` | P0 |
| `PerUserCredentialInjector` | `core/tools/middleware/per-user-credential-injector.ts` | `UserIdentityResolver` | P0 |
| `ToolErrorProtocol` | `core/tools/protocol/tool-errors.ts` | Nenhuma (constantes) | P0 |
| Telegram Handler Integration | `routes/webhook/telegram.ts` | `UserIdentityResolver` | P0 |
| SessionContext Enrichment | `core/session/session-context-builder.ts` | `UserIdentityResolver` | P0 |
| Dashboard OAuth Screens | Dashboard (NEX-77) | Better Auth Generic OAuth Plugin | P1 |
| Spotify Tools (per-user) | `tools/spotify/*.ts` | `PerUserCredentialInjector` | P1 (NEX-80) |

---

## 7. Segurança

1. **Isolamento total**: Cada usuário vê APENAS seus próprios tokens OAuth. `UserIdentityResolver` usa `auth_providers` com `UNIQUE(provider, providerUserId)` como único ponto de entrada.
2. **Auto-refresh seguro**: Better Auth gerencia o refresh automático. Se o refresh falhar (token revogado), o token é removido silenciosamente.
3. **Sem auto-link por email**: Conforme ADR-021, vinculação não autenticada por email é proibida.
4. **Tokens em trânsito**: Tokens trafegam apenas internamente (API → tool middleware), nunca expostos ao LLM ou ao cliente.

---

## 8. Estratégia de Testes

| Tipo | O que testar | Mock necessário |
|---|---|---|
| **Unitário** | `UserIdentityResolver.resolve()` com DB mock | `auth_providers` + `account` queries |
| **Unitário** | `PerUserCredentialInjector.resolve()` com/sem token | Better Auth client mock |
| **Unitário** | `SessionContextBuilder` com identity resolvida | Identity resolver mock |
| **Integração** | Telegram handler → resolve → runtime → tool | STT mock, Telegram mock |
| **E2E** | (Postergado para pós-Dashboard) | — |

---

## 9. Referências

- **ADR-021** — Modelo canônico de identidade com `auth_providers`
- **Hermes Wiki — credential-pool-and-isolation.md** — Pool global de credenciais
- **Hermes Wiki — auxiliary-client-architecture.md** — Tokens OAuth per-user
- **Hermes Wiki — provider-transport-architecture.md** — Transport layer
- **Hermes Wiki — gateway-session-management.md** — Session context injection
- **NEX-80** — Spotify Tools (depende deste sistema)
- **NEX-77** — Dashboard React (pré-requisito para UI de OAuth)
