# Pool de Credenciais — Implementation Spec

## Major System Pieces

1. **CredentialPool** (já existe) — `apps/api/src/core/model/credential-pool.ts`
   - Pool de chaves globais com `register()`, `resolve()`, `markExhausted()`
   - Estratégias: `fill_first`, `round_robin`, `random`
   - Cooldown de exaustão (1h default)

2. **Better Auth + Generic OAuth Plugin** (configurar)
   - Adicionar `genericOAuth()` plugin no auth.ts com Spotify como provider
   - Endpoint `/oauth2/callback/spotify` já montado automaticamente
   - Account linking via `oAuth2LinkAccount()` API

3. **SpotifyUserService** (novo)
   - Serviço que aceita `userId` e busca token via Better Auth
   - Operações: playback, playlists, library, devices, queue
   - Cache de token em memória com refresh automático

4. **Token Resolver** (novo helper)
   - Função única que dado `userId` + `provider` → retorna access token válido
   - Encapsula chamada ao Better Auth `getAccessToken()`
   - Trata refresh expirado e erros

## Data Needs

### PostgreSQL (Better Auth gerencia)

O Better Auth cria automaticamente tabelas para contas OAuth vinculadas:

| Tabela | Descrição |
|--------|-----------|
| `account` | Vincula user → provider + access_token + refresh_token |
| `session` | Sessões ativas |
| `user` | Usuários do sistema |

Não precisa de migrations novas — o Better Auth cuida disso.

### Env Vars

```env
# Globais (CredentialPool)
SPOTIFY_CLIENT_ID=xxx
SPOTIFY_CLIENT_SECRET=xxx
OPENAI_API_KEY=xxx
DEEPSEEK_API_KEY=xxx
TMDB_API_KEY=xxx
BRAVE_API_KEY=xxx

# Better Auth (já configurado)
BETTER_AUTH_SECRET=xxx
BETTER_AUTH_URL=https://api.nexo.app
```

## Recommended Technical Stack Defaults

| Component | Escolha | Motivo |
|-----------|---------|--------|
| Auth | Better Auth + Generic OAuth Plugin | Já implementado, plugin pronto |
| OAuth Provider | Generic `oauth2` com discovery URL manual | Spotify não tem OIDC discovery |
| Token Storage | Better Auth `account` table | Gerenciado automaticamente |
| Token Refresh | Better Auth (automático) | `getAccessToken()` já faz refresh |
| Cache | Redis (existente) | Evita chamadas repetidas ao Better Auth |
| API | Hono (existente) | Sem mudanças |
| Dashboard | React (NEX-77) | UI de vinculação via `oauth2.link()` |

## Integration Points

### Better Auth → Spotify

```
Dashboard (React)
  ↓ authClient.oauth2.link({ providerId: "spotify" })
  ↓ Redireciona para Spotify OAuth
  ↓ Usuário autoriza
  ↓ Callback: /oauth2/callback/spotify
  ↓ Better Auth salva tokens na account table
  ↓ Pronto! 🎉
```

### Nexo API → Better Auth → Spotify

```
Tool Call (ex: spotify_playback)
  ↓ sessionKey → resolve userId
  ↓ TokenResolver.getToken(userId, "spotify")
    ↓ Better Auth: getAccessToken("spotify", userId)
    ↓ (auto-refresh se expirado)
  ↓ Token válido retornado
  ↓ SpotifyUserService faz chamada à API
```

### CredentialPool (Global)

```
Tool Call (ex: spotify_search)
  ↓ CredentialPool.resolve("spotify")
  ↓ Retorna SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET
  ↓ SpotifyService faz Client Credentials flow
  ↓ Token de app usado para search público
```

## Workflow / Milestones

### Fase 1: Configurar Generic OAuth (1-2 dias)

- [ ] Adicionar `genericOAuth()` plugin no `auth.ts` com provider Spotify
- [ ] Configurar redirect URI no Spotify Developer Dashboard
- [ ] Testar fluxo de autorização manualmente
- [ ] Verificar se tokens estão sendo salvos na `account` table

### Fase 2: Token Resolver (1 dia)

- [ ] Criar `TokenResolver` helper em `apps/api/src/core/auth/token-resolver.ts`
- [ ] Implementar `getToken(userId, providerId)` → consulta Better Auth
- [ ] Tratar erros: token expirado sem refresh, provider não vinculado
- [ ] Cache em Redis com TTL

### Fase 3: SpotifyUserService (2-3 dias)

- [ ] Criar `apps/api/src/core/enrichment/spotify-user-service.ts`
- [ ] Implementar métodos: `play()`, `pause()`, `skip()`, `seek()`, `setVolume()`
- [ ] Implementar: `getDevices()`, `transferDevice()`
- [ ] Implementar: `getQueue()`, `addToQueue()`
- [ ] Implementar: `search()` (catalog search autenticado)
- [ ] Implementar: `getPlaylists()`, `createPlaylist()`, `addToPlaylist()`
- [ ] Implementar: `getLibrary()`, `saveToLibrary()`, `removeFromLibrary()`

### Fase 4: Registrar Tools no Kernel (1 dia)

- [ ] Registrar as 7 tools no `ToolRegistry` com schemas OpenAI function-calling
- [ ] Configurar ToolPolicy (auto mode para todas)
- [ ] Adicionar ao `buildHermesToolCatalog()`
- [ ] Testar fluxo completo via Telegram

### Fase 5: CredentialPool — Registrar serviços globais (1 dia)

- [ ] Garantir que `CredentialPool.fromEnv()` registre todos os serviços
- [ ] Adicionar Spotify Client Credentials ao pool
- [ ] Refatorar `SpotifyService` para usar `CredentialPool` em vez de env vars diretas

## Risks and Tradeoffs

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Spotify não tem OIDC discovery | Configuração manual das URLs | Usar Generic OAuth sem discovery, passar URLs manualmente |
| Refresh token expirado sem refresh possível | Usuário precisa re-vincular | Mostrar erro claro + botão "Reconectar" no Dashboard |
| Múltiplos usuários no mesmo chat do Telegram | Qual token usar? | Ghost System (NEX-75) resolve mapeamento |
| Dashboard Vue atual não tem UI de vinculação | Não dá pra testar fluxo completo | Criar endpoint de teste ou priorizar NEX-77 |

## Build Sequence

A ordem recomendada de implementação:

```
1. Generic OAuth Plugin (Better Auth)
   ↓
2. Token Resolver
   ↓
3. SpotifyUserService (back-end)
   ↓
4. Registrar Tools no Kernel
   ↓
5. Dashboard React (NEX-77) + UI de vinculação
   ↓
6. CredentialPool registrar serviços globais
```

> ⚠️ **Nota:** O passo 5 (Dashboard React) é pré-requisito para o usuário final vincular a conta. Mas os passos 1-4 podem ser implementados e testados com tokens manuais/scripts.

## Testing and Verification Plan

### Unit Tests
- `TokenResolver`: mock Better Auth, testar cache, refresh, erros
- `SpotifyUserService`: mock Spotify API, testar cada tool
- `CredentialPool`: testar estratégias de rotação, cooldown, exaustão

### Integration Tests
- Fluxo de autorização OAuth (manual via script)
- Tool call com token válido → resposta esperada
- Tool call sem token vinculado → erro amigável
- Tool call com token expirado → refresh automático

### E2E (após Dashboard React pronto)
- Usuário loga no Dashboard
- Vincula conta Spotify
- Envia mensagem de voz no Telegram → toca música
- Verifica playlist → adiciona música → toca

## Acceptance Criteria / Done Means

- [ ] `genericOAuth()` plugin configurado com Spotify
- [ ] `TokenResolver` retorna token válido dado `userId` + `providerId`
- [ ] `SpotifyUserService` implementa as 7 tools (playback, devices, queue, search, playlists, albums, library)
- [ ] Tools registradas no `ToolRegistry` e disponíveis no kernel
- [ ] `CredentialPool` usado pelo SpotifyService existente (search)
- [ ] Fallback amigável quando usuário não vinculou conta
- [ ] Refresh automático de tokens expirados
- [ ] Cache em Redis com TTL configurável
