# Pro_Bridge

<p align="center">
  <strong>Local-first communication layer between AI chat applications and AI coding agents.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-5.9-blue.svg?style=flat-square" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Fastify-5.2-black.svg?style=flat-square" alt="Fastify" />
  <img src="https://img.shields.io/badge/MCP-1.32-purple.svg?style=flat-square" alt="Model Context Protocol" />
  <img src="https://img.shields.io/badge/SQLite-Drizzle_ORM-orange.svg?style=flat-square" alt="SQLite & Drizzle" />
  <img src="https://img.shields.io/badge/WXT-Chrome_MV3-green.svg?style=flat-square" alt="WXT Extension" />
  <img src="https://img.shields.io/badge/Vitest-172_Passing-brightgreen.svg?style=flat-square" alt="Tests" />
  <img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="License" />
</p>

---

## 💡 Overview

Developers regularly use **ChatGPT**, **Claude**, or **Gemini** to brainstorm architectures, plan databases, evaluate trade-offs, and design features.

Afterwards, they face a tedious, repetitive hurdle: **manually transferring that context** to coding agents like **Antigravity**, **Claude Code**, **Codex**, or **Cursor** through copy-pasting, writing prompts, or generating markdown summaries.

**Pro_Bridge** eliminates this friction. It connects browser-based AI chats directly to your local coding agents through a private, lightweight bridge:

1. **Capture**: Automatically synchronizes discussions from **ChatGPT**, **Claude**, and **Gemini** via a browser extension.
2. **Extract**: Deterministically identifies finalized decisions, technical requirements, constraints, dependencies, and actionable implementation tasks.
3. **Bridge**: Exposes that structured project knowledge to your coding agents through the **Model Context Protocol (MCP)**.
4. **Report**: Receives progress reports, modified file summaries, and blockers back from coding agents, keeping chat discussions aligned with reality.

> **Zero Cloud Backend. No Mandatory AI API Keys. 100% Local Storage on macOS.**

---

## ⚡ Key Features

- **🌐 Multi-Provider Browser Extension (Chrome & Brave)**
  - Native content script adapters for **ChatGPT** (`chatgpt.com`), **Claude** (`claude.ai`), and **Gemini** (`gemini.google.com`).
  - Supports modern dynamic layouts, dark mode, and Markdown message rendering.
  - One-click manual synchronization or automatic 60-second inactivity background sync.
- **🧠 Smart Context Engine**
  - Deterministic, rule-based extraction for requirements, constraints, dependencies, clarification questions, and technical decisions.
  - Three-state decision tracking: `proposed`, `confirmed`, `rejected`.
  - Every extracted item links back to its exact source conversation and message sequence.
- **🔌 Model Context Protocol (MCP) Server**
  - Built on the official `@modelcontextprotocol/sdk` TypeScript SDK over `stdio` transport.
  - Provides read tools and JSON resources for projects, context, conversations, and tasks.
  - Restricts agent writes strictly to append-only session reports and task updates (no arbitrary shell execution).
- **🔄 Two-Way Agent Feedback**
  - Agents report implementation status, completed tasks, modified files, and blockers back to Pro_Bridge.
  - Stored locally and queryable by future agent sessions or conversational review.
- **🔒 Security & Privacy by Design**
  - Loopback-only binding (`127.0.0.1`).
  - Constant-time bearer token validation (`crypto.timingSafeEqual`).
  - Browser extension origin validation with Chromium Private Network Access (PNA) preflight support.
  - SQLite database with automated migration and backup routines.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       BROWSER LAYER                         │
│   ChatGPT (chatgpt.com)  ·  Claude (claude.ai)  ·  Gemini   │
│                                                             │
│       ┌──────────────────────────────────────────────┐      │
│       │        Pro_Bridge Extension (WXT MV3)        │      │
│       │  DOM Parsers · Auto-Sync · Project Linker    │      │
│       └──────────────────────┬───────────────────────┘      │
└──────────────────────────────┼──────────────────────────────┘
                               │ Loopback HTTP + Bearer Token
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     LOCAL BRIDGE CORE                       │
│  Fastify API (127.0.0.1:4317)  ·  Zod Schema Validation     │
│  ─────────────────────────────────────────────────────────  │
│  ┌─────────────────────────┐     ┌───────────────────────┐  │
│  │  Smart Context Engine   │     │  SQLite + Drizzle ORM │  │
│  │ Requirements · Decisions│ ──▶ │ Conversations · Tasks │  │
│  │ Tasks · Dependencies    │     │ Reports · Checkpoints │  │
│  └─────────────────────────┘     └───────────────────────┘  │
└──────────────────────────────▲──────────────────────────────┘
                               │ Stdio JSON-RPC
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    MCP SERVER (stdio)                       │
│   Tools: list_projects, get_project_context, list_tasks...  │
│   Resources: probridge://projects/{id}/context, tasks...    │
│   Feedback: report_progress, report_blocker, complete_task  │
└──────────────────────────────▲──────────────────────────────┘
                               │ MCP Protocol
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    LOCAL CODING AGENTS                      │
│        Google Antigravity  ·  Claude Code  ·  Codex         │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Technology Stack

| Component             | Technology                             | Rationale                                                         |
| :-------------------- | :------------------------------------- | :---------------------------------------------------------------- |
| **Browser Extension** | TypeScript, WXT, Vite, React           | Manifest V3 compliance, isolated content scripts, fast HMR        |
| **Backend Core**      | Node.js (22+), Fastify, TypeScript     | Low-overhead loopback API with fast serialization                 |
| **Database & ORM**    | SQLite (`better-sqlite3`), Drizzle ORM | Zero-config local storage with clean migration path to PostgreSQL |
| **Agent Protocol**    | `@modelcontextprotocol/sdk` (MCP)      | Industry standard for coding agent tool and resource discovery    |
| **Validation**        | Zod (v4 beta)                          | Runtime type validation for API envelopes and MCP arguments       |
| **Monorepo & Build**  | pnpm workspaces, tsup, Vitest          | Fast caching, strict dependencies, 100% unit test coverage        |

---

## 📁 Repository Structure

```text
Pro_Bridge/
├── apps/
│   ├── core/                  # Fastify local backend & Drizzle database layer
│   │   ├── drizzle/           # Generated SQL migrations
│   │   └── src/               # Services, repositories, routes, plugins
│   ├── extension/             # WXT Chrome Manifest V3 browser extension
│   │   ├── src/entrypoints/   # Content scripts (ChatGPT, Claude, Gemini) & popup
│   │   └── src/lib/           # Extension API client & auto-sync engine
│   └── mcp-server/            # Model Context Protocol stdio server
│       └── src/               # Tools, resources, and core API client
├── packages/
│   ├── shared-types/          # Canonical domain and transport types
│   ├── validation/            # Zod schemas for all models and requests
│   ├── conversation-parser/   # DOM adapters for ChatGPT, Claude, and Gemini
│   └── context-engine/        # Deterministic context and decision extractor
├── package.json               # Root monorepo workspace configuration
├── pnpm-workspace.yaml        # Workspace package definitions
└── README.md
```

---

## 🚀 Quick Start

### 1. Prerequisites

- macOS
- Node.js `>= 22.18.0` (`node --version`)
- pnpm `>= 12.0.0` (`npm install --global pnpm@12.16.1`)

### 2. Installation & Build

```bash
# Clone the repository
git clone https://github.com/PrathamMevada23/Pro_Bridge.git
cd Pro_Bridge

# Install workspace dependencies
pnpm install

# Configure environment for the core server
cp apps/core/.env.example apps/core/.env

# Generate a secure local token and save it to PRO_BRIDGE_LOCAL_TOKEN in apps/core/.env
openssl rand -hex 32

# Build all packages and applications
pnpm build
```

### 3. Start the Local Core API

```bash
# Starts the Fastify API server on 127.0.0.1:4317 in watch mode
pnpm dev
```

Verify that the server is healthy:

```bash
curl http://127.0.0.1:4317/health
# {"status":"ok","service":"pro-bridge-core","version":"0.1.0",...}
```

---

## 🧩 Loading the Browser Extension

1. In **Chrome** or **Brave**, navigate to `chrome://extensions` (or `brave://extensions`).
2. Toggle on **Developer mode** in the top-right corner.
3. Click **Load unpacked** and select:
   ```text
   /path/to/Pro_Bridge/apps/extension/.output/chrome-mv3
   ```
4. Open any saved conversation on:
   - **ChatGPT**: `https://chatgpt.com/c/<id>`
   - **Claude**: `https://claude.ai/chat/<id>`
   - **Gemini**: `https://gemini.google.com/app/<id>`
5. Click the **Pro_Bridge** extension icon in your browser toolbar.
6. Click the ⚙️ **Settings** icon and ensure your local token matches `PRO_BRIDGE_LOCAL_TOKEN` from `apps/core/.env`.
7. Select or create a project, then click **Link conversation** and **Sync messages**!

---

## 🤖 Connecting to Coding Agents via MCP

### Antigravity Configuration

Add the `pro-bridge` server to your global Antigravity MCP settings at `~/.gemini/config/mcp_config.json`:

```json
{
  "mcpServers": {
    "pro-bridge": {
      "command": "node",
      "args": ["/absolute/path/to/Pro_Bridge/apps/mcp-server/dist/index.js"],
      "env": {
        "PRO_BRIDGE_API_URL": "http://127.0.0.1:4317",
        "PRO_BRIDGE_LOCAL_TOKEN": "<YOUR_PRO_BRIDGE_LOCAL_TOKEN>"
      }
    }
  }
}
```

### Claude Code / Cursor / Codex Configuration

In your agent's MCP configuration file (e.g. `claude_desktop_config.json` or `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "pro-bridge": {
      "command": "node",
      "args": ["/absolute/path/to/Pro_Bridge/apps/mcp-server/dist/index.js"],
      "env": {
        "PRO_BRIDGE_API_URL": "http://127.0.0.1:4317",
        "PRO_BRIDGE_LOCAL_TOKEN": "<YOUR_PRO_BRIDGE_LOCAL_TOKEN>"
      }
    }
  }
}
```

---

## 🛠️ MCP Tools Reference

Once connected, your coding agent has access to the following tools:

| Category           | Tool                  | Description                                                              |
| :----------------- | :-------------------- | :----------------------------------------------------------------------- |
| **Projects**       | `list_projects`       | Lists all local projects and repository links                            |
| **Context**        | `get_project_context` | Retrieves extracted requirements, decisions, and tasks                   |
|                    | `list_requirements`   | Filters requirements by kind (`requirement`, `constraint`, `dependency`) |
|                    | `list_decisions`      | Inspects architectural decisions (`proposed`, `confirmed`, `rejected`)   |
|                    | `list_tasks`          | Retrieves implementation tasks by status and approval                    |
| **Conversations**  | `list_conversations`  | Lists captured chats linked to the project                               |
|                    | `list_messages`       | Reads chronological message history with incremental sequence paging     |
| **Agent Feedback** | `report_progress`     | Submits agent implementation updates, summaries, and modified files      |
|                    | `report_completion`   | Reports a completed task with modified file manifest                     |
|                    | `report_blocker`      | Logs an architectural issue or blocker back to the project               |
|                    | `start_agent_session` | Opens an agent session tracking continuous development                   |
|                    | `end_agent_session`   | Closes an active agent session                                           |

---

## 💻 Available Scripts

| Command                       | Action                                                             |
| :---------------------------- | :----------------------------------------------------------------- |
| `pnpm dev`                    | Starts the core API with file watching                             |
| `pnpm build`                  | Builds all packages, core API, extension, and MCP server           |
| `pnpm verify`                 | Comprehensive verification: build, typecheck, lint, and unit tests |
| `pnpm test:unit`              | Runs all 172 unit tests across 7 workspace packages                |
| `pnpm test:coverage`          | Generates V8 test coverage reports                                 |
| `pnpm lint` / `pnpm lint:fix` | Validates or automatically fixes ESLint rules                      |
| `pnpm format`                 | Formats the codebase with Prettier                                 |
| `pnpm db:generate`            | Generates new SQL migrations from schema changes                   |
| `pnpm db:migrate`             | Applies pending Drizzle migrations to SQLite                       |

---

## 🔒 Security Model

- **Loopback Enforcement**: The core API binds exclusively to `127.0.0.1`. Non-loopback interfaces are rejected at startup.
- **Timing-Safe Auth**: Protected routes verify tokens using `crypto.timingSafeEqual` to eliminate timing attacks.
- **Private Network Access (PNA)**: Fastify returns `Access-Control-Allow-Private-Network: true` to satisfy Chromium security policies for extension-to-localhost communication.
- **Safe Sandboxing**: The MCP server restricts agent operations to project context and append-only report logs. No arbitrary system commands or shell execution tools are exposed.
- **Local SQLite**: Your conversations, decisions, and tasks never leave your machine.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
