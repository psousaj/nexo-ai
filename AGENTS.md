# AGENTS - Nexo AI

This file defines mandatory execution rules for all AI coding agents in this repository.

## WARNING (ALL AI AGENTS)

- Always execute work in small, explicit tasks.
- Mandatory git loop for every task: **tasks -> test -> commit**.
- **Never run `git push` automatically.**
- For database migrations (`db:generate`, `db:push`, `drizzle-kit`), always run commands from `apps/api` (API root), not from monorepo root.
- If the user explicitly asks for push/PR actions, execute them.
- Each planning cycle must run in one dedicated branch.
- Keep implementation inside that dedicated branch until all planned milestones/tasks are complete.

## Mandatory Delivery Loop

1. Start planning by creating/using a dedicated branch for that planning cycle.
2. For each milestone/task, implement one feature.
3. Add or update tests for that feature.
4. Run tests until green.
5. Commit only that completed feature/task.
6. Repeat until all milestones/tasks in the planning are done.
7. Ensure the final result is on the target feature branch.
8. Notify the user that delivery is ready.
9. Push/open/update PR only when the user explicitly requests it.

## Scope

- These rules apply to all AI agents and subagents working in this workspace.
- If any other instruction conflicts with this file, follow the stricter rule.
