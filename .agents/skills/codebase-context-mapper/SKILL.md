---
name: codebase-context-mapper
description: Scans a software repository and generates a structured set of Markdown documents that fully describe the codebase — from executive summary down to module-level details — to serve as persistent LLM context. Use this skill whenever the user asks to "map the codebase", "document the repo", "generate context for the LLM", "create a codebase overview", "scan the project structure", or when they mention needing persistent context about a repository. Also trigger when the user uploads or references a codebase and wants it documented, analyzed, or indexed. Always prefer this skill over ad hoc codebase exploration when the goal is producing reusable documentation.
---

# Codebase Context Mapper

## Purpose

You are a codebase analysis agent. Scan a software repository and produce a structured set of Markdown documents that fully describe it — from executive summary down to module-level details. These documents serve as persistent context for any LLM working on this codebase in future sessions.

## Output Structure

All files go inside the `docs/` directory at the repository root.

### Entry Point

- `docs/index.md` — Executive summary + index linking to all other documents.

### Specialized Documents

| File | Covers |
|------|--------|
| `ARCHITECTURE.md` | High-level architecture, system boundaries, service topology, deployment model |
| `TECH_STACK.md` | Languages, frameworks, libraries, build tools, infrastructure dependencies |
| `DOMAIN_MODEL.md` | Core business entities, bounded contexts, domain relationships, data flow |
| `MODULES.md` | Module/package inventory with responsibilities, dependencies, and public interfaces |
| `PATTERNS.md` | Recurring code patterns, conventions, idioms, and anti-patterns found |
| `DATA_LAYER.md` | Databases, ORMs, migrations, caching strategies, data access patterns |
| `API_SURFACE.md` | External and internal APIs, contracts, authentication, versioning |
| `TESTING.md` | Test strategy, frameworks, coverage approach, test patterns |
| `BUILD_AND_DEPLOY.md` | Build system, CI/CD pipelines, environment configs, deployment targets |
| `TECH_DEBT.md` | Known debt, legacy areas, risky zones, coupling hotspots |
| `CONVENTIONS.md` | Naming conventions, file organization, commit patterns, PR workflow |
| `GLOSSARY.md` | Domain-specific and project-specific terminology |

---

## Execution Plan

Follow this order strictly. Each step builds on the previous.

### Phase 0: Incremental Update Check

Before doing anything else:

1. Check if `docs/` exists and if `docs/index.md` is present.
2. If **yes**: read `docs/index.md` to understand the previous state (generation date, repo state). Then check `git log --oneline -10` and `git status` to understand what changed since the last run. Document in each file header what changed. Regenerate only the documents that are affected by the changes — but when in doubt, regenerate all.
3. If **no**: create `docs/` and proceed from scratch.
4. Each document header must include: generation date and current git branch + last commit hash (run `git rev-parse --short HEAD` and `git branch --show-current`).

### Phase 1: Reconnaissance

1. **Map the filesystem** — Run `find` or `tree` (excluding `node_modules`, `.git`, `vendor`, `build`, `dist`, `target`, `__pycache__`, `.cache`) to get the full directory structure.

2. **Identify the tech stack** — Read root-level config files first:
   - Package managers: `package.json`, `pom.xml`, `build.gradle`, `Cargo.toml`, `go.mod`, `Gemfile`, `requirements.txt`, `pyproject.toml`, `composer.json`
   - Build configs: `Makefile`, `Dockerfile`, `docker-compose.yml`, `.env.example`, `webpack.config.*`, `vite.config.*`, `tsconfig.json`
   - CI/CD: `.github/workflows/`, `.gitlab-ci.yml`, `Jenkinsfile`, `.circleci/`
   - Infra: `terraform/`, `k8s/`, `helm/`, `serverless.yml`, `cdk.json`

3. **Find the entry points** — Locate `main()`, `index.*`, `app.*`, `server.*`, route definitions, or whatever bootstraps the application.

### Phase 2: Deep Analysis

4. **Trace the architecture** — From entry points, follow the dependency graph:
   - How does the app bootstrap?
   - Main layers/modules/packages?
   - Communication (imports, HTTP, messaging, events)?
   - System boundaries (external services, databases, queues)?

5. **Map the domain** — Identify:
   - Core entities and relationships
   - Bounded contexts (if DDD) or functional domains
   - Data flow: where data enters, transforms, and exits
   - Key business rules and their location in code

6. **Catalog patterns** — Scan for:
   - Architectural patterns (MVC, hexagonal, clean, CQRS, etc.)
   - Code-level patterns (repository, factory, strategy, middleware chains, etc.)
   - Error handling, logging, configuration management, DI approach

7. **Analyze the data layer** — Document:
   - Databases and access patterns
   - ORM/query builder setup
   - Migration strategy
   - Caching layers and invalidation
   - Connection management

8. **Map the API surface** — Catalog:
   - REST/GraphQL/gRPC endpoints
   - Auth and authorization mechanisms
   - Versioning strategy
   - Internal service contracts
   - External integrations

9. **Assess quality and debt** — Look for:
   - High coupling zones
   - God classes/modules (files over 500 lines with mixed responsibilities)
   - Dead code or unused dependencies
   - Inconsistent patterns
   - TODO/FIXME/HACK density
   - No test coverage areas
   - Legacy patterns diverging from current standard

### Phase 3: Documentation Generation

10. **Write `docs/index.md` first** — Executive summary with:
    - One-paragraph description of what the software does
    - Architecture style in one sentence
    - Tech stack summary
    - Quick stats (modules, LOC, test files)
    - Table of contents linking all specialized documents
    - "Critical knowledge" — 5-10 most important facts to prevent mistakes

11. **Write each specialized document** — Follow templates below.

---

## Document Templates

### docs/index.md (Entry Point)

```markdown
# [Project Name] — Codebase Context

> Generated by Codebase Context Mapper on [DATE]
> Branch: [branch] | Commit: [short-hash]

## What is this

[One paragraph: what the software does, who it serves, core value proposition]

## Architecture at a glance

[One sentence describing the architectural style]

[MermaidJS diagram of the high-level architecture]

## Tech stack summary

- **Language(s):** [e.g., Kotlin 1.9, TypeScript 5.x]
- **Framework(s):** [e.g., Spring Boot 3.2, Next.js 14]
- **Database(s):** [e.g., PostgreSQL 15, Redis 7]
- **Infrastructure:** [e.g., AWS ECS, Kubernetes]
- **Build:** [e.g., Gradle 8.x, pnpm]

## Quick stats

| Metric | Value |
|--------|-------|
| Modules/packages | [N] |
| Source files | [N] |
| Test files | [N] |
| Approximate LOC | [N] |

## Critical knowledge

1. [Most important fact — what prevents the most common mistakes]
2. [Second most important fact]
3. [Continue up to 10 items]

## Context documents

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design, boundaries, topology |
| [TECH_STACK.md](./TECH_STACK.md) | Languages, frameworks, dependencies |
| [DOMAIN_MODEL.md](./DOMAIN_MODEL.md) | Business entities, contexts, data flow |
| [MODULES.md](./MODULES.md) | Module inventory and responsibilities |
| [PATTERNS.md](./PATTERNS.md) | Code patterns and conventions |
| [DATA_LAYER.md](./DATA_LAYER.md) | Databases, ORMs, caching |
| [API_SURFACE.md](./API_SURFACE.md) | APIs, contracts, integrations |
| [TESTING.md](./TESTING.md) | Test strategy and frameworks |
| [BUILD_AND_DEPLOY.md](./BUILD_AND_DEPLOY.md) | CI/CD, build system, environments |
| [TECH_DEBT.md](./TECH_DEBT.md) | Known debt and risk areas |
| [CONVENTIONS.md](./CONVENTIONS.md) | Naming, organization, workflow |
| [GLOSSARY.md](./GLOSSARY.md) | Project-specific terminology |
```

### ARCHITECTURE.md

```markdown
# Architecture

> Generated: [DATE] | Branch: [branch] | Commit: [hash]

## Overview

[2-3 paragraphs: architectural style, main decisions, visible rationale]

## System diagram

[MermaidJS diagram: components, communication paths, external deps, data stores, queues]

## Component breakdown

### [Component/Service Name]

- **Responsibility:** [what it does]
- **Location:** [path in repo]
- **Communicates with:** [other components]
- **Protocol:** [HTTP/gRPC/events/direct import]

## Layers

[Layering strategy — e.g., controller → service → repository]

## Cross-cutting concerns

- **Authentication:** [how and where]
- **Authorization:** [how and where]
- **Logging:** [strategy and library]
- **Error handling:** [strategy]
- **Configuration:** [how configs are loaded]
```

### MODULES.md

```markdown
# Modules

> Generated: [DATE] | Branch: [branch] | Commit: [hash]

## Overview

[Brief description of how the codebase is organized]

## Module inventory

### [module-name]

- **Path:** `src/[path]`
- **Responsibility:** [single sentence]
- **Key files:**
  - `[file]` — [what it does]
- **Internal dependencies:** [other modules it imports from]
- **External dependencies:** [libraries it directly uses]
- **Public interface:** [exported functions/classes/types other modules consume]
- **Notes:** [anything surprising or important]

## Dependency graph

[MermaidJS diagram of inter-module dependencies]
```

### Other Documents (TECH_STACK, DOMAIN_MODEL, PATTERNS, DATA_LAYER, API_SURFACE, TESTING, BUILD_AND_DEPLOY, TECH_DEBT, CONVENTIONS, GLOSSARY)

For each remaining document, follow these principles:

1. Start with a header containing generation date and git info.
2. Start the body with an **Overview** section (2-3 paragraphs).
3. Use **tables** for inventories and catalogs.
4. Use **code snippets** to illustrate patterns (max 15 lines — show the pattern, not reproduce code).
5. Include **file paths** as references for navigation.
6. End with a **Notes** section for anything that doesn't fit elsewhere.

---

## Rules for the Agent

### Diagram rules

- **ALL diagrams MUST use MermaidJS syntax** inside fenced code blocks. No ASCII art, no PlantUML, no other format.
- Use the right type for the content: `graph TD`/`graph LR` for architecture and flows, `erDiagram` for domain/entity relationships, `sequenceDiagram` for interaction flows, `flowchart` for process flows, `classDiagram` for class structures.
- Max ~20 nodes per diagram. Split into multiple focused diagrams if needed.
- Use meaningful node labels (not abbreviations) and label all edges.

### Quality rules

- **Be factual, not speculative.** Only document what you can verify by reading the code. If you can't determine something, say "Could not determine from code analysis" rather than guessing.
- **Use relative paths** from the repository root in all file references.
- **Include concrete examples.** When describing a pattern, show a real snippet (abbreviated).
- **Flag contradictions.** If different parts use different patterns, document both and note the inconsistency.
- **Quantify when possible.** "5 out of 12 services use this pattern" beats "some services use this pattern."

### Incremental update rules

- On every run, read existing `docs/index.md` first (if it exists) to understand the previous state.
- Run `git log --oneline -10` and `git diff --stat HEAD~1 HEAD` (or equivalent) to understand what changed.
- If only a subset of modules changed, regenerate only the affected documents — but always regenerate `docs/index.md` to update stats and timestamp.
- At the top of each regenerated document, add a `## Changes since last run` section listing what was updated and why.
- Documents not affected by recent changes keep their previous content but get an updated timestamp.

### Scaling rules

- More than **50 modules/packages**: group by domain in `MODULES.md`. Create sub-documents (e.g., `MODULES_PAYMENTS.md`, `MODULES_AUTH.md`) linked from `MODULES.md`.
- **Monorepo with multiple apps**: separate `docs/` analysis per app, plus a top-level `docs/index.md` indexing them all.
- Context window at risk: prioritize depth over breadth. Fully analyze core modules first. Mark peripheral modules as "shallow analysis" — document only public interface and stated responsibility.
- Use `wc -l`, `find ... | wc -l`, and `cloc` (if available) for quantitative data.