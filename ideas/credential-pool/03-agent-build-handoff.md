# Pool de Credenciais — Agent Build Handoff

## Mission

Implementar um sistema de两层 de credenciais para o Nexo AI: **CredentialPool global** (chaves de app) + **Better Auth OAuth per-user** (tokens de usuários), habilitando tools do Spotify com autenticação pessoal.

## Product Vision

O Nexo AI deve suportar tools que operam com credenciais da aplicação (search público, LLMs) e tools que agem em nome do usuário (Spotify playback, playlists, library). Cada usuário vincula sua própria conta Spotify via Dashboard, e o sistema resolve automaticamente qual token usar.

## Non-Negotiable Requirements

1. **Isolamento total**: Usuário A NUNCA acessa dados do Usuário B
2. **Refresh automático**: Better Auth gerencia refresh tokens sem intervenção
3. **Fallback amigável**: Se usuário não vinculou conta, tool retorna erro claro
4. **Sem mudanças na UX do Telegram**: A vinculação é feita pelo Dashboard, não pelo chat
5. **CredentialPool continua**: O pool global não é substituído, apenas estendido

## Technical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Credential System                         │
│                                                              │
│  ┌──────────────────────┐    ┌───────────────────────────┐   │
│  │    CredentialPool     │    │      Better Auth           │   │
│  │   (já existe)        │    │  + Generic OAuth Plugin    │   │
│  │                      │    │                            │   │
│  │  register("openai")  │    │  oauth2.link({             │   │
│  │  register("spotify") │    │    providerId: "spotify"   │   │
│  │  resolve("deepseek") │    │  })                        │   │
│  │  markExhausted(...)  │    │                            │   │
│  └──────────┬───────────┘    │  getAccessToken("spotify") │   │
│             │                └────────────┬───────────────┘   │
│             ▼                             ▼                   │
│  ┌──────────────────────────────────────────────────────┐     │
│  │              Tool Execution Layer                     │     │
│  │                                                       │     │
│  │  TokenResolver.getToken(userId, "spotify")             │     │
│  │  CredentialPool.resolve("spotify")                    │     │
│  └──────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
```

### Componentes

| Componente | Arquivo | Status |
|-----------|---------|--------|
| `CredentialPool` | `apps/api/src/core/model/credential-pool.ts` | ✅ Existe |
| `genericOAuth` plugin | `auth.ts` (Better Auth config) | 🔲 Configurar |
| `TokenResolver` | `apps/api/src/core/auth/token-resolver.ts` | 🔲 Criar |
| `SpotifyUserService` | `apps/api/src/core/enrichment/spotify-user-service.ts` | 🔲 Criar |
| `SpotifyService` (search) | `apps/api/src/core/enrichment/spotify-service.ts` | ✅ Existe |
| Tools (7) | ToolRegistry | 🔲 Registrar |

## Implementation Phases

### Fase 1: Better Auth Generic OAuth

**Arquivo:** `apps/api/src/core/auth/auth.config.ts` (ou onde o Better Auth é configurado)

Adicionar plugin:
```typescript
import { genericOAuth } from "better-auth/plugins";

export const auth = betterAuth({
  // ... config existente
  plugins: [
    genericOAuth({
      config: [
        {
          providerId: "spotify",
          clientId: process.env.SPOTIFY_CLIENT_ID!,
          clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
          // Spotify não tem OIDC discovery, usar URLs manuais
          authorizationUrl: "https://accounts.spotify.com/authorize",
          tokenUrl: "https://accounts.spotify.com/api/token",
          userInfoUrl: "https://api.spotify.com/v1/me",
          scopes: [
            "user-read-playback-state",
            "user-modify-playback-state",
            "user-read-currently-playing",
            "playlist-read-private",
            "playlist-modify-private",
            "playlist-modify-public",
            "user-library-read",
            "user-library-modify",
            "user-read-recently-played",
          ],
        },
      ],
    }),
  ],
});
```

**Callback URL no Spotify Dashboard:**
```
https://api.nexo.app/api/auth/oauth2/callback/spotify
```

### Fase 2: TokenResolver

**Arquivo novo:** `apps/api/src/core/auth/token-resolver.ts`

```typescript
export class TokenResolver {
  async getToken(userId: string, providerId: string): Promise<string | null> {
    // 1. Check Redis cache
    // 2. Call Better Auth getAccessToken(providerId, userId)
    // 3. Cache result
    // 4. Return token or null
  }

  async refreshToken(userId: string, providerId: string): Promise<string | null> {
    // Better Auth handles this automatically
  }
}
```

### Fase 3: SpotifyUserService

**Arquivo novo:** `apps/api/src/core/enrichment/spotify-user-service.ts`

```typescript
export class SpotifyUserService {
  constructor(private tokenResolver: TokenResolver) {}

  async play(userId: string, args: PlayArgs) { ... }
  async pause(userId: string) { ... }
  async skip(userId: string, direction: 'next' | 'previous') { ... }
  async seek(userId: string, positionMs: number) { ... }
  async setVolume(userId: string, percent: number) { ... }
  async getDevices(userId: string) { ... }
  async transferDevice(userId: string, deviceId: string) { ... }
  async getQueue(userId: string) { ... }
  async addToQueue(userId: string, uri: string) { ... }
  async search(userId: string, query: string, types: string[]) { ... }
  async getPlaylists(userId: string) { ... }
  async createPlaylist(userId: string, name: string) { ... }
  async addToPlaylist(userId: string, playlistId: string, uris: string[]) { ... }
  async getLibrary(userId: string, kind: 'tracks' | 'albums') { ... }
  async saveToLibrary(userId: string, kind: string, ids: string[]) { ... }
}
```

### Fase 4: Registrar Tools

7 tools com schemas OpenAI function-calling, registradas no ToolRegistry, todas em `mode: 'auto'`.

## Testing Requirements

- **Unit**: TokenResolver com mock do Better Auth
- **Unit**: SpotifyUserService com mock da Spotify API
- **Unit**: CredentialPool testar rotação e cooldown
- **Integration**: Fluxo completo: criar tool call → resolver token → chamar API
- **Error cases**: Token expirado, provider não vinculado, rate limit, 403

## Verification Commands

```bash
# Testar TokenResolver
pnpm test -- --testPathPattern="token-resolver"

# Testar SpotifyUserService
pnpm test -- --testPathPattern="spotify-user"

# Build
pnpm build --filter=@nexo/api

# Deploy (Coolify auto-deploy na branch development)
git push origin development
```

## Acceptance Criteria

- [ ] `genericOAuth()` plugin configurado com Spotify
- [ ] `TokenResolver` retorna token válido dado `userId` + `providerId`
- [ ] `SpotifyUserService` implementa as 7 tools
- [ ] Tools registradas no `ToolRegistry` e disponíveis no kernel
- [ ] `CredentialPool` usado pelo SpotifyService existente (search)
- [ ] Fallback amigável quando usuário não vinculou conta
- [ ] Refresh automático de tokens expirados
- [ ] Cache em Redis com TTL configurável

## Done Means Checklist

- [ ] Todos os acceptance criteria acima atendidos
- [ ] Testes unitários passando
- [ ] Fluxo manual testado (token manual via script)
- [ ] Documentação do padrão para novas tools
- [ ] Código revisado e mergeado na `development`

## Prompt for Build Agent

> Implemente o sistema de credenciais de两层 para o Nexo AI seguindo esta spec. Comece configurando o Generic OAuth Plugin do Better Auth com Spotify, depois crie o TokenResolver, depois o SpotifyUserService com as 7 tools, e por fim registre tudo no ToolRegistry. O CredentialPool já existe e não precisa ser recriado. Teste cada fase antes de prosseguir.

## Superpowers Handoff

Para continuar a partir deste handoff, o agente deve:
1. Ler `01-design-doc.md` para contexto de produto
2. Ler esta spec para detalhes de implementação
3. Executar as fases na ordem especificada
4. Validar cada acceptance criteria antes de marcar como done
