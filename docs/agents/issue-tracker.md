# Issue tracker: Linear

Issues and PRDs for this repo live as Linear issues in the **Nexo-memo-assistant** team (team key: NEX, project: **Nexo Hermes Engine**). Use the MCP tools for all operations.

## Conventions

- **Create an issue**: `mcp_linear_save_issue` with `team: "Nexo-memo-assistant"`, `project: "Nexo Hermes Engine"`, `title: "..."`, `description: "..."`
- **Read an issue**: `mcp_linear_get_issue` with `id: "NEX-XXX"`
- **List issues**: `mcp_linear_list_issues` with `project: "Nexo Hermes Engine"`, `state: "Todo"`
- **Comment**: `mcp_linear_save_comment` with `issueId: "NEX-XXX"`, `body: "..."`
- **Update status**: `mcp_linear_save_issue` with `id: "NEX-XXX"`, `state: "Done"`
- **Create sub-tasks**: `mcp_linear_save_issue` with `parentId: "NEX-XXX"`, `team: "Nexo-memo-assistant"`, `project: "Nexo Hermes Engine"`

Infer the project from context — Linear tools use the workspace's API key already configured.

## When a skill says "publish to the issue tracker"

Create a Linear issue via MCP with the appropriate project and team.

## When a skill says "fetch the relevant ticket"

Use `mcp_linear_get_issue` with the issue identifier (e.g. NEX-123) and `includeRelations: true` for full context.
