# Issue tracker: Linear

Issues and PRDs for this repo live in Linear.

- Workspace: `nexo-memo-assistant`
- Team: `Nexo-memo-assistant` (`NEX`)
- Team ID: `437fc0de-e423-4c5a-907a-87fa8dcd1230`
- Project: `Nexo Hermes Engine`
- Project ID: `253c8bb3-49b7-488f-aec9-61ec2ab4a0d2`

Use Linear MCP tools for all issue operations. In Hermes these appear as `mcp__linear__*`; in agent prose this may be written as `mcp_linear_*`.

## Conventions

- **Create an issue**: `mcp__linear__save_issue` with `team: "Nexo-memo-assistant"`, `project: "Nexo Hermes Engine"`, `template: "Jose Backlog"`, `title: "..."`, `description: "..."`
- **Read an issue**: `mcp__linear__get_issue` with `id: "NEX-XXX"`
- **List issues**: `mcp__linear__list_issues` with `project: "Nexo Hermes Engine"` and the relevant `state`
- **Comment**: `mcp__linear__save_comment` with the issue identifier/ID and `body: "..."`
- **Update status**: `mcp__linear__save_issue` with `id: "NEX-XXX"`, `state: "..."`
- **Create sub-tasks**: `mcp__linear__save_issue` with `parentId: "NEX-XXX"`, `team: "Nexo-memo-assistant"`, `project: "Nexo Hermes Engine"`

## Status conventions

- Use `Backlog` for unplanned backlog work.
- Use `Todo` for planned but not started work.
- Use `In Progress` for active work.
- Use `Done` only after implementation is complete and merged.
- Use `Canceled` only for abandoned/wontfix work, not implemented features.

## When a skill says "publish to the issue tracker"

Create a Linear issue in the NEX team and `Nexo Hermes Engine` project, using the `Jose Backlog` template unless the user explicitly asks otherwise.

## When a skill says "fetch the relevant ticket"

Use `mcp__linear__get_issue` with the issue identifier, for example `NEX-123`, and include relations/comments when the tool supports it.
