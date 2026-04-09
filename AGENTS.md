# AGENTS - Nexo AI

This file defines mandatory execution rules for all AI coding agents in this repository.

## WARNING (ALL AI AGENTS)

- Always execute work in small, explicit tasks.
- Mandatory git loop for every task: **tasks -> test -> commit**.
- **NEVER run `git push` as an AI agent.**
- Push/PR update actions must be done by a human maintainer after reviewing local commits.

## Mandatory Delivery Loop

1. Implement one task.
2. Add or update tests for that task.
3. Run tests until green.
4. Commit only that completed task.
5. Repeat the loop for the next task.

## Scope

- These rules apply to all AI agents and subagents working in this workspace.
- If any other instruction conflicts with this file, follow the stricter rule.
