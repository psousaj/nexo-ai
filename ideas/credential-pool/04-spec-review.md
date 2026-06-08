# Pool de Credenciais — Spec Review

## Readiness Assessment

### Product Goal
✅ Claro — sistema de两层 de credenciais para tools globais e per-user

### UI/Design Expectations
✅ N/A — backend puro, UI de vinculação será no Dashboard React (NEX-77, task separada)

### Requirements Testability
✅ Todos os critérios são testáveis (testes unitários + integração)

### Unresolved Product Decisions
- ✅ **Mapeamento Telegram → Dashboard userId** — Better Auth já gerencia via schema `auth_providers` (provider='telegram', providerUserId=chat_id) → userId. Documentado na NEX-80
- ✅ **UI de vinculação** — Dashboard React é task separada, mas backend pode ser testado com tokens manuais via script

### Unresolved Technical Decisions
- ✅ **URLs do Spotify OAuth** — Hermes Agent usa PKCE OAuth com redirect `http://127.0.0.1:43827/spotify/callback` (CLI). Para Nexo (web): `https://dashboard.nexo.app/api/auth/oauth2/callback/spotify`
- ✅ **Scopes necessários**:
  - `user-read-playback-state`
  - `user-modify-playback-state`
  - `user-read-currently-playing`
  - `playlist-read-private`
  - `playlist-modify-private`
  - `playlist-modify-public`
  - `user-library-read`
  - `user-library-modify`
  - `user-read-recently-played`
- ✅ **Testes sem Dashboard** — Script manual com token obtido via Device Authorization Flow ou curl

### Acceptance Criteria
✅ Concretos e mensuráveis

### Done Means
✅ Checklist claro

### Fresh Agent Buildability
✅ Um agente poderia construir a partir deste spec + handoff sem perguntas óbvias

### Testing & Verification
✅ Testes unitários obrigatórios. E2E podem ficar pendentes para fase pós-Dashboard React

### Non-Goals
✅ Claramente definidos

## Verdict

**PASS** ✅

Todas as pendências resolvidas:
1. ✅ URLs e scopes do Spotify OAuth — documentados no Hermes Agent Docs
2. ✅ Testes — unitários obrigatórios, E2E postergados
3. ✅ Mapeamento Telegram→userId — Better Auth + NEX-80 já cobrem

