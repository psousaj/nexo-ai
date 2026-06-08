# Pool de Credenciais — Global & Per-User

Sistema de两层 de credenciais para o Nexo AI: **CredentialPool global** (chaves de app) + **Better Auth OAuth per-user** (tokens de usuários).

## Artifacts

| # | Arquivo | Status |
|---|---------|--------|
| 00 | `00-idea-capture.md` | ✅ Capture |
| 01 | `01-design-doc.md` | ✅ Design Doc |
| 02 | `02-implementation-spec.md` | ✅ Implementation Spec |
| 03 | `03-agent-build-handoff.md` | ✅ Build Handoff |
| 04 | `04-spec-review.md` | ✅ Spec Review |

## Status do Workflow

| Stage | Status |
|-------|--------|
| Stage 1: Capture | ✅ |
| Stage 2: Interview | ✅ (2 perguntas) |
| Stage 3: Design Doc | ✅ |
| Stage 4: UI Design Brief | ⏭️ Skipped (backend puro) |
| Stage 5: Research Pass | ✅ |
| Stage 6: Implementation Spec | ✅ |
| Stage 7: Build Handoff | ✅ |
| Stage 8: Spec Review | ✅ — **PASS WITH CHANGES** |
| Stage 9: Review | ⏳ Pendente |

## Verdict

**PASS** ✅ — spec pronta para implementação. Pendências resolvidas:
1. ✅ URLs e scopes do Spotify OAuth (docs do Hermes Agent)
2. ✅ Testes unitários obrigatórios, E2E postergados
3. ✅ Mapeamento Telegram→userId (Better Auth + NEX-80)
