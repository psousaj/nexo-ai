# Nexo AI 🤖 — Contexto do Projeto

Plataforma de agentes inteligentes inspirada no Hermes Agent. Hermes-inspired agent platform with multi-channel support (WhatsApp, Telegram), conversational anamnesis, and pluggable tool system.

## Stack

- **Runtime:** Bun
- **Framework:** Elysia
- **Database:** PostgreSQL + Drizzle ORM
- **Auth:** Better Auth
- **Orquestração:** Turborepo + pnpm
- **Lint/Format:** Biome + ESLint
- **Deploy:** Coolify (Docker)

## Estrutura

```
nexo-ai/
├── apps/
│   ├── api/          # Elysia backend
│   ├── dashboard/    # Next.js dashboard (?)
│   └── landing/      # Landing page
└── packages/
    └── shared/       # Tipos e utilitários
```

## Comandos

```bash
pnpm dev         # dev:api + dev:dash + dev:landing (turbo)
pnpm build       # build completo
pnpm lint        # lint biome + eslint
pnpm test        # turbo test
```

## Documentação

- **ADRs:** `docs/adr/` — arquitetura e decisões técnicas (vários ADRs já registrados)
- **Domain Docs:** `docs/agents/`

## Ambiente

- **Bun:** 1.x
- **pnpm:** 11.x
- **Node:** 22+
- **GitHub:** psousaj/nexo-ai

## 🚨 Regra Sagrada: NUNCA push direto na main

NUNCA dar push direto na main. Sempre criar PR → revisar → mergear. Push direto na main só com ordem EXPLÍCITA do usuário.

## 🔄 Pós-PR Merge: sempre rodar `git sync-branch`

Após mergear QUALQUER PR na main, rodar:
```
git sync-branch
```

O alias global (`~/.gitconfig`) executa:
1. `git switch main`
2. `git pull --rebase`
3. `git switch development`
4. `git rebase main`
5. `git push --force-with-lease origin development`

Isso mantém a `development` sempre em cima da main.

## Agent skills

### Issue tracker

Issues are tracked in Linear (workspace: nexo-memo-assistant, team: Nexo-memo-assistant, team key: NEX, project: Nexo Hermes Engine). Use Linear MCP tools for all issue operations. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary — `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context Turbo monorepo. See `docs/agents/domain.md`.
