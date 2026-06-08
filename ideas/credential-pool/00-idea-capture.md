# Pool de Credenciais — Global & Per-User

**Data:** 2026-05-13
**Modo:** Full
**Status:** Capture

## Resumo

Sistema de两层 de credenciais para o Nexo AI: pool global para chaves de aplicação (CredentialPool já existente) + autenticação per-user via Better Auth para serviços que exigem agir em nome do usuário.

## Ponto de Partida

- CredentialPool já existe em `apps/api/src/core/model/credential-pool.ts`
- Better Auth já está integrado (schema `auth_providers`, `auth.client.ts`)
- SpotifyService já existe mas só com Client Credentials (search público)
- Dashboard atual é Vue, precisa migrar pra React para suportar UI de vinculação

## Próximos Passos

Seguir o Idea Workflow para gerar design doc, implementation spec e build handoff.
