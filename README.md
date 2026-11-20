# Pro_Bridge

Pro_Bridge is a local-first communication layer between AI chat applications and AI coding
agents. It captures project conversations, stores them locally, extracts project knowledge,
and exposes that knowledge to coding agents through MCP.

The project is being built in phases. **Phase 1 is complete:** the pnpm monorepo, shared
TypeScript configuration, local Fastify core foundation, validation packages, linting,
formatting, tests, and environment configuration are in place. **Phase 2 is complete:** the
local SQLite schema, migrations, and authenticated project, conversation and message APIs
are implemented. **Phase 3 is complete:** the ChatGPT browser extension and manual
conversation synchronization are implemented. **Phase 4 is complete:** opt-in automatic
incremental synchronization is implemented. **Phase 5 is complete:** deterministic context
extraction into proposed requirements, decisions and tasks is implemented. **Phase 6 is
complete:** the local MCP server and Antigravity integration are implemented. **Phase 7 is
complete:** coding-agent sessions and append-only progress, completion and blocker reports
are implemented through the core API and MCP. **Phase 8 is complete:** reliability,
testing, and documentation have been finalized — 148 unit tests pass across all packages,
`pnpm verify` is clean (build, typecheck, lint, test), and coverage has been extended with
dedicated unit tests for the shutdown lifecycle, database backup, origin validation, and MCP
result serialization helpers. **Phase 9 is complete:** Claude and Gemini browser adapters
are implemented alongside ChatGPT, including dedicated DOM parsers, URL and provider detection
helpers, content scripts for `claude.ai` and `gemini.google.com`, and an updated browser
extension popup supporting all three providers.

## Requirements

- macOS (initial target platform)
- Node.js `>= 22.18.0` (see `.nvmrc`)
- pnpm `>= 12` (this repository pins `pnpm@12.16.1` through `packageManager`)
- Git

## Setup

```bash
# Install pnpm if it is not already available.
npm install --global pnpm@12.16.1

# Install workspace dependencies.
pnpm install

# Create the local core environment file.
cp apps/core/.env.example apps/core/.env

# Generate a local authentication token and paste it into PRO_BRIDGE_LOCAL_TOKEN.
openssl rand -hex 32

# Build all workspace packages.
pnpm build

# Start the core API in watch mode.
pnpm dev
```

Verify the API is running:

```bash
curl http://127.0.0.1:4317/health
```

If `PRO_BRIDGE_LOCAL_TOKEN` is left empty outside production, the core generates an
ephemeral token at startup and logs it. Set a stable token in `apps/core/.env` for normal
development.

## Commands

| Command                                      | Purpose                                                    |
| -------------------------------------------- | ---------------------------------------------------------- |
| `pnpm dev`                                   | Build packages, then start the core API with file watching |
| `pnpm build`                                 | Build every workspace package in dependency order          |
| `pnpm start`                                 | Start the built core API                                   |
| `pnpm typecheck`                             | Type-check every workspace package                         |
| `pnpm test`                                  | Build, then run all unit tests                             |
| `pnpm test:unit`                             | Run unit tests without rebuilding                          |
| `pnpm test:coverage`                         | Build, then run tests with V8 coverage                     |
| `pnpm lint`                                  | Run ESLint across the repository                           |
| `pnpm lint:fix`                              | Run ESLint and apply safe fixes                            |
| `pnpm format`                                | Format the repository with Prettier                        |
| `pnpm format:check`                          | Check formatting without writing files                     |
| `pnpm verify`                                | Build, type-check, lint and test everything                |
| `pnpm db:generate`                           | Generate a new SQL migration from the Drizzle schema       |
| `pnpm db:migrate`                            | Apply pending migrations to the configured database        |
| `pnpm --filter @pro-bridge/extension dev`    | Run the extension in WXT watch mode                        |
| `pnpm --filter @pro-bridge/extension build`  | Build the unpacked Chrome extension                        |
| `pnpm --filter @pro-bridge/extension zip`    | Package the Chrome extension                               |
| `pnpm --filter @pro-bridge/mcp-server dev`   | Run the MCP server from source over stdio                  |
| `pnpm --filter @pro-bridge/mcp-server build` | Build the MCP stdio server                                 |
| `pnpm --filter @pro-bridge/mcp-server start` | Start the built MCP stdio server                           |
| `pnpm clean`                                 | Remove build output and coverage reports                   |

## Repository structure

```text
Pro_Bridge/
├── apps/
│   ├── core/                    # Local Fastify API
│   ├── extension/               # WXT ChatGPT extension
│   └── mcp-server/              # MCP stdio server for reads and agent feedback
├── packages/
│   ├── shared-types/            # Transport-agnostic shared types
│   ├── validation/              # Zod runtime schemas
│   ├── conversation-parser/     # ChatGPT DOM adapter
│   └── context-engine/          # Deterministic context extraction
├── apps/core/src/
│   ├── config/                  # Environment validation
│   ├── db/                      # Drizzle schema, client, migrations and mappers
│   ├── http/                    # Request parsing helpers
│   ├── plugins/                 # Security boundary
│   ├── repositories/            # Isolated database queries
│   ├── routes/                  # HTTP routes
│   ├── security/                # Origin validation
│   ├── services/                # Business logic above repositories
│   ├── app.ts                   # Fastify application factory
│   └── index.ts                 # Process entry point
├── apps/extension/src/
│   ├── entrypoints/             # Content script and React popup
│   └── lib/                     # API client, settings and message contracts
├── apps/core/drizzle/           # Generated SQL migrations and metadata
├── eslint.config.mjs
├── tsconfig.base.json
├── pnpm-workspace.yaml
└── package.json
```

`apps/core`, `apps/extension`, `apps/mcp-server`, `packages/shared-types`,
`packages/validation`, `packages/conversation-parser` and `packages/context-engine` contain
executable code through Phase 7. The remaining package directories are reserved with README
files so later phases can be added without restructuring the repository.

## Core API foundation

The Phase 1 core exposes:

- `GET /health` — public health response typed by shared types and covered by the shared Zod schema.
- A loopback-only bind by default (`127.0.0.1`).
- Bearer-token authentication for every route except `/health`.
- Browser-extension origin validation with CORS preflight support.
- Consistent JSON error envelopes for `401`, `403`, `404` and `500` responses.
- Zod-validated environment configuration with safe defaults.
- Graceful shutdown on `SIGINT` and `SIGTERM`.

### Environment variables

Environment configuration lives in `apps/core/.env` and is documented in
`apps/core/.env.example`.

| Variable                     | Default                | Description                                                       |
| ---------------------------- | ---------------------- | ----------------------------------------------------------------- |
| `NODE_ENV`                   | `development`          | `development`, `test` or `production`                             |
| `PRO_BRIDGE_HOST`            | `127.0.0.1`            | Must be a loopback host: `127.0.0.1`, `::1` or `localhost`        |
| `PRO_BRIDGE_PORT`            | `4317`                 | Local HTTP port                                                   |
| `PRO_BRIDGE_LOG_LEVEL`       | `info`                 | Pino log level                                                    |
| `PRO_BRIDGE_DATABASE_PATH`   | `./data/pro-bridge.db` | SQLite file path, or `:memory:` for temporary testing             |
| `PRO_BRIDGE_LOCAL_TOKEN`     | generated              | Local bearer token, minimum 32 characters; required in production |
| `PRO_BRIDGE_ALLOWED_ORIGINS` | empty                  | Comma-separated extension origins; required in production         |

In development and test, any well-formed `chrome-extension://` or `moz-extension://` origin
is accepted so unpacked extensions work without a stable extension ID. In production, the
explicit allowlist is mandatory.

## Local database

Phase 2 stores all data in a local SQLite database accessed through Drizzle ORM. The
database file is created automatically on startup, along with its parent directory.
Migrations in `apps/core/drizzle` are applied automatically when the core starts.

```bash
# Generate a migration after changing apps/core/src/db/schema.ts.
pnpm db:generate

# Apply pending migrations to PRO_BRIDGE_DATABASE_PATH.
pnpm db:migrate
```

The schema contains the planned domain tables: `projects`, `conversations`, `messages`,
`sync_checkpoints`, `requirements`, `decisions`, `tasks`, `agent_sessions`, `agent_reports`
and `events`. Phase 2 implements APIs for projects, conversations and messages; Phase 5 adds
APIs for requirements, decisions and tasks; Phase 7 adds APIs for agent sessions and agent
reports. The `events` table remains reserved for later use. Database-specific queries are
isolated in `apps/core/src/repositories` so services can be reused by the MCP server.

Conversation messages are preserved in full. Each message stores the provider message ID,
role, content, a SHA-256 content hash, sequence and timestamps. Re-syncing the same message
does not duplicate it; when the content changes, the existing row is updated and `editedAt`
is recorded.

## Project and conversation API

All endpoints except `GET /health` require `Authorization: Bearer <PRO_BRIDGE_LOCAL_TOKEN>`.

| Method   | Endpoint                                 | Purpose                                    |
| -------- | ---------------------------------------- | ------------------------------------------ |
| `GET`    | `/api/projects`                          | List projects                              |
| `POST`   | `/api/projects`                          | Create a project                           |
| `GET`    | `/api/projects/:projectId`               | Get a project                              |
| `PATCH`  | `/api/projects/:projectId`               | Update project fields                      |
| `DELETE` | `/api/projects/:projectId`               | Delete a project                           |
| `GET`    | `/api/conversations`                     | List conversations (optional `projectId`)  |
| `POST`   | `/api/conversations`                     | Link a conversation to a project           |
| `GET`    | `/api/conversations/:conversationId`     | Get a conversation                         |
| `PATCH`  | `/api/conversations/:conversationId`     | Update or relink a conversation            |
| `DELETE` | `/api/conversations/:conversationId`     | Delete a conversation and its messages     |
| `GET`    | `/api/conversations/:id/messages`        | List messages (`afterSequence`, `limit`)   |
| `POST`   | `/api/conversations/:id/messages`        | Sync a batch of messages                   |
| `GET`    | `/api/conversations/:id/sync-status`     | Read the incremental sync checkpoint       |
| `POST`   | `/api/conversations/:id/extract-context` | Extract proposed context items             |
| `GET`    | `/api/projects/:projectId/context`       | Read all requirements, decisions and tasks |
| `GET`    | `/api/projects/:projectId/requirements`  | List requirements (`kind`, `status`)       |
| `GET`    | `/api/projects/:projectId/decisions`     | List decisions (`status`)                  |
| `GET`    | `/api/projects/:projectId/tasks`         | List tasks (`status`, `approvalStatus`)    |
| `PATCH`  | `/api/requirements/:requirementId`       | Confirm or reject a requirement            |
| `PATCH`  | `/api/decisions/:decisionId`             | Confirm or reject a decision               |
| `PATCH`  | `/api/tasks/:taskId`                     | Update task approval or work status        |

Project fields are `name`, `description` and `repositoryPath`. Creating a project returns
`201`; validation failures return `400` with a `VALIDATION_ERROR` envelope, and missing
records return `404` with `NOT_FOUND`.

Linking is idempotent per `(provider, providerConversationId)`. The first link returns
`201` with `{ conversation, created: true }`; relinking the same provider conversation
returns `200` with `{ conversation, created: false }` and updates its project, URL and
optional title. Deleting a project sets the `projectId` of linked conversations to `null`
rather than deleting conversation history.

Message sync accepts `{ "messages": [...] }` with up to 1,000 messages. Each message needs
a unique `providerMessageId` within the request, plus `role`, `content` and `sequence`.
The response is a `SyncResult` with `receivedMessages`, `createdMessages`,
`updatedMessages`, `lastSyncedAt` and the affected messages. A sync also updates the
conversation's `lastSyncedAt` and its `sync_checkpoints` row.

`GET /api/conversations/:conversationId/sync-status` returns the `SyncCheckpoint` used by
incremental sync: `lastMessageSequence`, `lastMessageId`, `lastSyncedAt`, `status` and
`lastError`. Before the first sync it returns idle defaults with `lastMessageSequence: 0`
and `lastSyncedAt: null`.

## Context extraction

Phase 5 adds `@pro-bridge/context-engine`, a deterministic rule-based extractor. It reads the
messages already stored for a linked conversation and produces:

- requirements, constraints, dependencies and clarification questions;
- decisions, with an optional rationale split from `because`/`since` clauses;
- tasks with a title and optional description.

`POST /api/conversations/:conversationId/extract-context` persists the results and returns
`ContextExtractionResult` counts plus the created items. Extraction requires the conversation
to be linked to a project. It is idempotent: items already stored for the project with the
same normalized text are skipped, including items the user previously rejected. Re-running
extraction therefore does not resurrect rejected suggestions.

Every extracted item starts as a suggestion:

- requirements and decisions use `status: "proposed"`;
- tasks use `approvalStatus: "proposed"` and `status: "pending"`.

Nothing is auto-approved. Status changes happen only through the `PATCH` endpoints, and
setting a task to `completed` records `completedAt`; moving it out of `completed` clears that
timestamp. Requirements and decisions can be `proposed`, `confirmed` or `rejected`; tasks can
also be `pending`, `in_progress`, `completed`, `blocked` or `cancelled`.

The extractor recognizes explicit cues (`must`, `should`, `decided`, `depends on`, `TODO`,
and similar) and Markdown headings such as `## Requirements`, `## Decisions` and `## Tasks`.
It ignores fenced code blocks and does not call a model, so it is conservative and may miss
implicit context.

## MCP server and Antigravity

Phase 6 adds `apps/mcp-server`, a Model Context Protocol server built with the official
`@modelcontextprotocol/sdk` TypeScript SDK (`1.32.2`). It uses stdio transport and talks to
the core HTTP API, so the core must be running. Phase 7 adds agent feedback tools that append
sessions and reports. The server still cannot approve tasks, change task status, extract
context or delete data.

Configuration:

| Variable                 | Default                 | Description                               |
| ------------------------ | ----------------------- | ----------------------------------------- |
| `PRO_BRIDGE_API_URL`     | `http://127.0.0.1:4317` | Core API URL; loopback hosts only         |
| `PRO_BRIDGE_LOCAL_TOKEN` | required                | Local bearer token, minimum 32 characters |

`PRO_BRIDGE_API_URL` must use `http` or `https`, resolve to `127.0.0.1`, `localhost` or
`[::1]`, and must not include credentials, a path, query or fragment.

```bash
# Build the workspace, then run the MCP server over stdio.
pnpm build
PRO_BRIDGE_LOCAL_TOKEN=<your-token> pnpm --filter @pro-bridge/mcp-server start
```

The process writes diagnostics to stderr only; stdout carries the MCP JSON-RPC protocol.

### MCP tools

| Tool                  | Arguments                                                                          | Returns                                   |
| --------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------- |
| `list_projects`       | —                                                                                  | All projects                              |
| `get_project`         | `projectId`                                                                        | One project                               |
| `get_project_context` | `projectId`                                                                        | Requirements, decisions and tasks         |
| `list_conversations`  | `projectId?`                                                                       | Conversations, optionally for one project |
| `get_conversation`    | `conversationId`                                                                   | One conversation                          |
| `list_messages`       | `conversationId`, `afterSequence?`, `limit?`                                       | Messages in sequence order                |
| `list_requirements`   | `projectId`, `kind?`, `status?`                                                    | Requirements and related items            |
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

### MCP resources

| URI                                                   | Content                             |
| ----------------------------------------------------- | ----------------------------------- |
| `probridge://projects`                                | All projects                        |
| `probridge://projects/{projectId}/context`            | Requirements, decisions and tasks   |
| `probridge://projects/{projectId}/conversations`      | Conversations linked to the project |
| `probridge://conversations/{conversationId}/messages` | Synchronized messages               |
| `probridge://projects/{projectId}/agent-sessions`     | Agent sessions, newest first        |
| `probridge://projects/{projectId}/agent-reports`      | Agent reports, newest first         |
| `probridge://agent-sessions/{agentSessionId}/reports` | Reports for one agent session       |

Resources return `application/json`. Resource templates enumerate concrete project,
conversation, session and report instances from the local database.

Read tools and resources do not change data. The five agent feedback tools append sessions
and reports only; they never approve tasks or change task status. Extracted requirements,
decisions and tasks are suggestions with explicit status fields; nothing is treated as
approved automatically.

### Agent feedback API

Phase 7 adds these authenticated core endpoints:

| Method | Path                                          | Purpose                      |
| ------ | --------------------------------------------- | ---------------------------- |
| `POST` | `/api/projects/:projectId/agent-sessions`     | Start an agent session       |
| `GET`  | `/api/projects/:projectId/agent-sessions`     | List project sessions        |
| `GET`  | `/api/agent-sessions/:agentSessionId`         | Read one session             |
| `POST` | `/api/agent-sessions/:agentSessionId/end`     | End a session (idempotent)   |
| `GET`  | `/api/agent-sessions/:agentSessionId/reports` | List reports for one session |
| `POST` | `/api/projects/:projectId/agent-reports`      | Append a report              |
| `GET`  | `/api/projects/:projectId/agent-reports`      | List project reports         |

Reports use `progress`, `completion` or `blocker` types and are append-only. `modifiedFiles`
is stored as a JSON array. Reports may reference an agent session and a task, but both must
belong to the same project. Reporting completion does not mark a task completed, approved or
cancelled; a user must still review and update the task through the task API.

### Antigravity configuration

Build the MCP server first, then add a `pro-bridge` entry to `mcp_config.json`:

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

Antigravity configuration locations:

- **Workspace (CLI and IDE):** `<workspace>/.agents/mcp_config.json`
- **Global (CLI and IDE):** `~/.gemini/config/mcp_config.json`
- **Antigravity App:** Customizations → Installed → MCP Servers → Add MCP Server

A ready-to-copy example is in `apps/mcp-server/mcp_config.example.json`. Restart the server
from Antigravity after rebuilding or changing the configuration. See
`apps/mcp-server/README.md` for troubleshooting and testing details.

## ChatGPT browser extension

Phase 3 adds a Chrome Manifest V3 extension built with WXT and React. It targets ChatGPT
only. Reading, linking and manual sync are separate user actions; automatic incremental
sync is opt-in per conversation (Phase 4).

The extension uses `@pro-bridge/conversation-parser` to read the visible ChatGPT DOM. It
extracts the conversation ID from `/c/<id>` URLs, the title from the page, and each visible
user/assistant message in order. Message IDs use ChatGPT's `data-message-id` when available,
falling back to the conversation turn ID.

### Build and load the extension

```bash
# Start the local core API.
pnpm dev

# In another terminal, build the unpacked extension.
pnpm --filter @pro-bridge/extension build
```

1. Open `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**.
2. Select `apps/extension/.output/chrome-mv3`.
3. Open a saved ChatGPT conversation, for example `https://chatgpt.com/c/<id>`.
4. Open the Pro_Bridge popup, click the settings button, and enter the local API URL
   (`http://127.0.0.1:4317` by default) and `PRO_BRIDGE_LOCAL_TOKEN`.
5. Select a project, click **Link conversation**, then click **Sync messages**.
6. Click **Extract context** to create proposed requirements, decisions and tasks.
7. Optionally enable **Auto-sync this conversation** after linking.

The popup refreshes the conversation from the page only when **Read current tab** or
**Refresh from ChatGPT** is clicked. Large conversations are sent in batches of 500
messages.

### Automatic incremental synchronization

Auto-sync is opt-in per conversation and only runs for conversations already linked to a
project. The toggle is stored in `browser.storage.local`; enabling it never links a
conversation or approves anything automatically.

- The content script watches the ChatGPT page with a `MutationObserver`, debounces changes
  for 1.2 seconds, and notifies the background worker only when the parsed conversation
  changes.
- The background worker finds the linked conversation, reads its sync checkpoint, and sends
  the last two synced messages plus every newer message. The overlap lets the server detect
  edits and regenerated responses through content-hash comparison.
- Sync requests are serialized per conversation so overlapping DOM updates cannot race.
- The popup shows the last automatic sync result. It is stored locally under
  `proBridgeLastAutoSync`.
- Auto-sync is browser-driven: it only runs while the ChatGPT tab is open and the extension
  is enabled. Closing the tab stops synchronization until the page is opened again.

No database schema change was required for Phase 4; the existing `sync_checkpoints` table
stores the incremental position.

### Extension permissions

- `storage` — stores the local API URL and token in the browser profile.
- `activeTab` — reads the active ChatGPT tab when the popup is opened.
- Host permissions for `https://chatgpt.com/*`, `https://chat.openai.com/*` and the local
  API origins.

The extension does not modify ChatGPT pages and does not send conversation data anywhere
except the configured local API. In production, add the installed extension origin
(`chrome-extension://<extension-id>`) to `PRO_BRIDGE_ALLOWED_ORIGINS`.

## Security notes

- The API binds to a loopback address only; configuration rejects non-loopback hosts.
- Protected requests require `Authorization: Bearer <PRO_BRIDGE_LOCAL_TOKEN>`.
- Token comparison uses `crypto.timingSafeEqual`.
- Browser origins are validated before CORS handling.
- `.env` files, SQLite database files, local application data, build output and dependencies
  are ignored by Git.
- The database stays on the local machine; no network database connection is used.
- The extension stores its local API token in `browser.storage.local` and only calls the
  configured local API origin.
- The MCP server accepts only loopback core URLs and sends its diagnostics to stderr so
  stdout remains a clean MCP protocol stream.
- MCP write access is limited to creating agent sessions and appending agent reports. It
  cannot approve tasks, change task status, extract context or delete data.
- No shell execution or arbitrary command handling exists through Phase 7.

## Testing

Unit tests use Vitest. The core tests cover environment validation, loopback enforcement,
health responses, token authentication, origin rejection and CORS preflight behavior, plus
project CRUD, conversation linking and relinking, message sync idempotency, edit tracking,
message pagination and foreign-key unlink behavior. Tests run against an in-memory SQLite
database with migrations applied. The conversation parser tests run against happy-dom
fixtures, and the extension tests cover API batching, authentication headers, error
handling, URL normalization, sync checkpoint reads, incremental message planning, extension
message validation and context extraction requests. Core tests also cover sync-status
defaults and checkpoint updates after a sync, plus deterministic extraction, proposed status
defaults, deduplication and context status updates. Agent feedback tests cover session
lifecycle, idempotent ending, report append-only behavior, filtering, project ownership
checks and confirmation that reports do not change task approval or work status. MCP server
tests cover configuration and loopback validation, the HTTP client, read and write tool
argument forwarding, tool errors, resource listing and resource reads using
`InMemoryTransport` and the official MCP client. Phase 8 added dedicated tests for the
shutdown lifecycle handler, SQLite online backup, origin validation edge cases, and MCP
result serialization helpers. Phase 9 added DOM parser tests and provider detection tests
for Claude and Gemini. The monorepo has 171 passing unit tests across all packages.

```bash
pnpm verify
```

## Roadmap

| Phase | Scope                                                | Status   |
| ----- | ---------------------------------------------------- | -------- |
| 1     | Monorepo initialization and local backend foundation | Complete |
| 2     | Database schema and project/conversation APIs        | Complete |
| 3     | ChatGPT browser extension and manual synchronization | Complete |
| 4     | Automatic incremental synchronization                | Complete |
| 5     | Smart context extraction                             | Complete |
| 6     | Local MCP server and Antigravity integration         | Complete |
| 7     | Coding-agent feedback and two-way communication      | Complete |
| 8     | Reliability, testing and documentation               | Complete |
| 9     | Claude and Gemini browser adapters                   | Complete |

## Current limitations

- Supported AI chat providers: ChatGPT (`chatgpt.com`, `chat.openai.com`), Claude (`claude.ai`), and Gemini (`gemini.google.com`).
- Automatic synchronization is opt-in per conversation, requires a prior manual link, and
  only runs while the conversation tab is open.
- Automatic sync detects edits in the last two synced messages and in newer messages; older
  messages changed outside that window are only corrected by a manual full sync.
- The MCP server requires the core API to be running. Its write tools only create agent
  sessions and append reports; there are no approval, task-status or extraction tools.
- The MCP server supports stdio transport only and is intended for local coding agents.
- The extension does not yet display agent sessions or reports; feedback is available through
  the core API and MCP resources.
- Context extraction is rule-based and conservative; it may miss implicit requirements or
  decisions, and it only runs when triggered through the API or the extension button.
- Agent sessions and reports now have APIs and MCP tools. The `events` table still has no
  API and is not used yet.
- DOM changes in AI chat providers may require parser updates; the adapters read stable
  data attributes, semantic web component tags, and standard headers where possible.
- The parsers capture messages currently rendered in the active conversation tab. Scroll to load
  older messages before syncing long conversations if needed.
- The development token is ephemeral when `PRO_BRIDGE_LOCAL_TOKEN` is not set.
