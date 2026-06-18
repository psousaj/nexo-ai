# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`AGENTS.md`** at the repo root — contains project context, stack, conventions
- **`CONTEXT.md`** or **`CONTEXT-MAP.md`** at the repo root if they exist — build a shared domain language
- **`docs/adr/`** — Nexo AI already has ADRs; read ones that touch the area you're about to work in

If any of these files don't exist, **proceed silently**.

## File structure

Single-context repo (Turbo monorepo):

```
/
├── AGENTS.md
├── CONTEXT.md
├── docs/
│   ├── adr/              ← existing ADRs
│   └── agents/           ← this folder
└── apps/
    ├── api/
    ├── dashboard/
    └── landing/
```

## Use the glossary's vocabulary

When your output names a domain concept, use the term as defined in `CONTEXT.md`. Don't drift to synonyms.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding.
