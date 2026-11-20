# Pro_Bridge MCP Server

Local Model Context Protocol server for Pro_Bridge. It exposes captured projects,
conversations, messages, extracted context and coding-agent feedback to clients over stdio
using the official `@modelcontextprotocol/sdk` TypeScript SDK.

The server reads from the local core HTTP API and, since Phase 7, can append coding-agent
sessions and progress, completion or blocker reports. It never approves tasks, changes task
status, extracts context or deletes anything. Extracted requirements, decisions and tasks
remain suggestions; check their status fields before acting on them.

## Configuration

| Variable                 | Default                 | Description                               |
| ------------------------ | ----------------------- | ----------------------------------------- |
| `PRO_BRIDGE_API_URL`     | `http://127.0.0.1:4317` | Loopback URL of the Pro_Bridge core API   |
| `PRO_BRIDGE_LOCAL_TOKEN` | required                | Local bearer token, minimum 32 characters |

`PRO_BRIDGE_API_URL` must use `http` or `https`, point to `127.0.0.1`, `localhost` or
`[::1]`, and must not include credentials, a path, query or fragment.

`PRO_BRIDGE_LOCAL_TOKEN` must match the token configured for the core. The MCP server does
not generate or store tokens.

## Build and run

```bash
# From the repository root.
pnpm build

# Start the core API in another terminal.
pnpm dev

# Run the built MCP server over stdio.
PRO_BRIDGE_LOCAL_TOKEN=<your-token> \
  pnpm --filter @pro-bridge/mcp-server start
```

For development without a build step:

```bash
PRO_BRIDGE_LOCAL_TOKEN=<your-token> \
  pnpm --filter @pro-bridge/mcp-server dev
```

The process writes diagnostics to stderr only. stdout is reserved for MCP JSON-RPC frames.

## Tools

| Tool                  | Arguments                                                                          | Returns                                   |
| --------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------- |
| `list_projects`       | —                                                                                  | All projects                              |
| `get_project`         | `projectId`                                                                        | One project                               |
| `get_project_context` | `projectId`                                                                        | Requirements, decisions and tasks         |
| `list_conversations`  | `projectId?`                                                                       | Conversations, optionally for one project |
| `get_conversation`    | `conversationId`                                                                   | One conversation                          |
| `list_messages`       | `conversationId`, `afterSequence?`, `limit?`                                       | Messages in sequence order                |
| `list_requirements`   | `projectId`, `kind?`, `status?`                                                    | Requirements and related extracted items  |
| `list_decisions`      | `projectId`, `status?`                                                             | Decisions                                 |
| `list_tasks`          | `projectId`, `status?`, `approvalStatus?`                                          | Tasks                                     |
| `list_agent_sessions` | `projectId`                                                                        | Agent sessions, newest first              |
| `get_agent_session`   | `agentSessionId`                                                                   | One agent session                         |
| `list_agent_reports`  | `projectId`, `agentSessionId?`, `taskId?`, `type?`, `limit?`                       | Agent reports, newest first               |
| `start_agent_session` | `projectId`, `agentName`, `externalSessionId?`, `startedAt?`                       | Created agent session                     |
| `end_agent_session`   | `agentSessionId`, `endedAt?`                                                       | Ended agent session                       |
| `report_progress`     | `projectId`, `summary`, `agentSessionId?`, `taskId?`, `details?`, `modifiedFiles?` | Progress report                           |
| `report_completion`   | same as `report_progress`                                                          | Completion report                         |
| `report_blocker`      | same as `report_progress`                                                          | Blocker report                            |

Read tools declare `readOnlyHint: true`. The agent feedback tools declare
`readOnlyHint: false` and `destructiveHint: false`; they append data and never approve tasks
or change task status. `end_agent_session` is idempotent: ending an ended session returns the
existing session unchanged. Tool results are pretty-printed JSON in a single text block.
Errors are returned as `isError` results with a short message.

## Resources

| URI                                                   | Content                                |
| ----------------------------------------------------- | -------------------------------------- |
| `probridge://projects`                                | All projects                           |
| `probridge://projects/{projectId}/context`            | Project requirements, decisions, tasks |
| `probridge://projects/{projectId}/conversations`      | Conversations linked to the project    |
| `probridge://conversations/{conversationId}/messages` | Synchronized messages                  |
| `probridge://projects/{projectId}/agent-sessions`     | Agent sessions, newest first           |
| `probridge://projects/{projectId}/agent-reports`      | Agent reports, newest first            |
| `probridge://agent-sessions/{agentSessionId}/reports` | Reports for one agent session          |

Resources are JSON (`application/json`). Resource templates also enumerate concrete instances
from the local database, so clients can discover projects, conversations, sessions and report
collections without calling a tool first.

## Agent feedback

Phase 7 adds a two-way feedback flow. A coding agent can call `start_agent_session`, then
append `report_progress`, `report_completion` or `report_blocker` entries, and finally call
`end_agent_session`. Reports may reference an agent session and a task, but both must belong
to the same project.

Reports are append-only. `report_completion` does not mark a task completed or approved, and
`report_blocker` does not change task status. A user must review the task through the core
task API or extension. The `modifiedFiles` argument accepts repository-relative paths and is
stored as a JSON string array.

## Antigravity setup

Build the MCP server first, then add it to Antigravity.

1. Copy `mcp_config.example.json` to your Antigravity configuration file.
2. Replace the `args` path with the absolute path to this repository's
   `apps/mcp-server/dist/index.js`.
3. Replace `PRO_BRIDGE_LOCAL_TOKEN` with the same token used by the core API.
4. Ensure the core API is running at `PRO_BRIDGE_API_URL`.

Configuration locations:

- **Workspace (CLI and IDE):** `<workspace>/.agents/mcp_config.json`
- **Global (CLI and IDE):** `~/.gemini/config/mcp_config.json`
- **Antigravity App:** Customizations → Installed → MCP Servers → Add MCP Server

Example:

```json
{
  "mcpServers": {
    "pro-bridge": {
      "command": "node",
      "args": ["/absolute/path/to/Pro_Bridge/apps/mcp-server/dist/index.js"],
      "env": {
        "PRO_BRIDGE_API_URL": "http://127.0.0.1:4317",
        "PRO_BRIDGE_LOCAL_TOKEN": "replace-with-your-local-token"
      }
    }
  }
}
```

Restart the MCP server from Antigravity after changing configuration or rebuilding. If the
server shows as disconnected, run the command manually with the same environment variables
and check stderr for configuration or connectivity errors.

## Tests

```bash
pnpm --filter @pro-bridge/mcp-server test
```

Tests cover environment validation, loopback enforcement, the HTTP client, read and write
tool registration and argument forwarding, agent feedback write semantics, resource listing
and reading, and error handling. MCP behavior is tested in-process with `InMemoryTransport`
and the official `Client`.
