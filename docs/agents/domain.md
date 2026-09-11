# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`AGENTS.md`** at the repo root: project context, stack, commands, and repo rules.
- **`CONTEXT.md`** at the repo root if it exists, or **`CONTEXT-MAP.md`** if it exists and points to context-specific docs.
- **`docs/adr/`**: system-wide architecture decisions.
- **`apps/api/docs/adr/`**: API-specific architecture decisions when working in `apps/api`.

If any of these files don't exist, **proceed silently**. Don't flag their absence or suggest creating them upfront. The domain-modeling flow creates them lazily when terms or decisions actually get resolved.

## File structure

Single-context repo (Turbo monorepo):

```
/
├── AGENTS.md
├── CONTEXT.md
├── docs/
│   ├── adr/              ← system-wide ADRs
│   └── agents/           ← this folder
├── apps/
│   ├── api/
│   │   └── docs/adr/     ← API-specific ADRs
│   ├── dashboard/
│   └── landing/
└── packages/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, or a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, either reconsider the wording or note the gap for `/domain-modeling`.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding.
