# Phase 6 -- MCP Integration Bridge

> Embeds an MCP server in the Zentral backend, exposing all app features as tools and resources for Claude Code and other MCP clients.

> **Status:** planned — specification complete, implementation not started
> **Last updated:** 2026-03-25
>
> **What works:** Full specification with 11 subtasks, tool schemas, and resource URIs defined. MCP SDK listed in dependencies.
> **What's missing:** Everything — no `src-tauri/src/mcp/` directory, no server code, no tools, no resources, no settings UI.

---

## Overview

Phase 6 turns Zentral from a standalone desktop app into a programmable platform. By embedding an MCP (Model Context Protocol) server directly in the Rust backend, any MCP-compatible client (Claude Code, IDE extensions, custom agents) can read and write Zentral state -- agents, schedules, workflows, knowledge, chat -- without touching the UI.

This is the "dog-fooding" phase: Claude Code can use Zentral's own agent infrastructure to build and improve Zentral itself.

## Tasks

### 6.1 -- MCP Server Core

Set up the embedded SSE MCP server with JSON-RPC protocol handling.

| Item | Detail |
|------|--------|
| Module | `src-tauri/src/mcp/` |
| Transport | SSE on `localhost:23847` |
| Dependencies | `axum`, `tokio`, `serde_json`, `tower` |
| Config | Port configurable in Settings |

Subtasks:

1. **Axum HTTP server** -- Start an axum server on a background Tokio task during Tauri `setup()`. Bind to `127.0.0.1:{port}`.
2. **SSE endpoint** -- `GET /mcp` returns an SSE stream. `POST /mcp` receives JSON-RPC requests. Follow MCP SSE transport spec.
3. **JSON-RPC dispatcher** -- Parse `initialize`, `tools/list`, `tools/call`, `resources/list`, `resources/read` methods. Route to handlers.
4. **Shared state bridge** -- Extract Tauri managed state into `Arc<AppState>` shared between Tauri commands and MCP handlers.
5. **Lifecycle management** -- Start server on app launch, graceful shutdown on app close. Handle port conflicts with auto-increment.
6. **Settings integration** -- Add `mcp_enabled: bool` and `mcp_port: u32` to `AppSettings`. Add UI toggle in Settings dialog.

Acceptance criteria:

- MCP server starts automatically with the app (if enabled)
- Claude Code can connect via `{ "url": "http://localhost:23847/mcp" }`
- `tools/list` returns the full tool catalog
- `resources/list` returns all resource URIs
- Server stops cleanly on app shutdown
- Port is configurable and conflict-resilient

---

### 6.2 -- Agent Tools

Expose agent CRUD operations as MCP tools.

| Tools | `list_agents`, `get_agent`, `create_agent`, `update_agent`, `delete_agent` |
|-------|------|
| Module | `src-tauri/src/mcp/tools/agents.rs` |
| State | Reads/writes `AgentManager` state |

Acceptance criteria:

- All agent operations work through MCP exactly as they do through the UI
- Builtin agents cannot be deleted via MCP
- Agent status changes emit Tauri events (UI updates in real-time)

---

### 6.3 -- Chat Tools

Expose messaging capabilities.

| Tools | `send_message`, `get_chat_history` |
|-------|------|
| Module | `src-tauri/src/mcp/tools/chat.rs` |
| Behavior | `send_message` blocks until streaming completes, returns full response |

Acceptance criteria:

- Messages sent via MCP appear in the chat UI
- Chat history is retrievable with pagination
- Agent responses are complete (not streaming chunks)

---

### 6.4 -- Project Tools

Expose project management.

| Tools | `list_projects`, `get_active_project`, `switch_project`, `create_project` |
|-------|------|
| Module | `src-tauri/src/mcp/tools/projects.rs` |

Acceptance criteria:

- Switching project via MCP updates all agents' CWD
- UI reflects project change immediately

---

### 6.5 -- Skill Tools

Expose skill catalog and execution.

| Tools | `list_skills`, `create_skill`, `run_skill` |
|-------|------|
| Module | `src-tauri/src/mcp/tools/skills.rs` |

Acceptance criteria:

- `run_skill` injects the skill's system prompt and sends the message to the specified agent
- Custom skills created via MCP are persisted and visible in UI
- Builtin skills cannot be modified or deleted

---

### 6.6 -- Schedule Tools

Expose schedule management.

| Tools | `list_schedules`, `create_schedule`, `update_schedule`, `toggle_schedule`, `delete_schedule` |
|-------|------|
| Module | `src-tauri/src/mcp/tools/schedules.rs` |

Acceptance criteria:

- Schedules created via MCP are picked up by the scheduling engine
- Cron expressions are validated before acceptance
- Toggle works bidirectionally (MCP ↔ UI)

---

### 6.7 -- Workflow Tools

Expose workflow management and execution.

| Tools | `list_workflows`, `create_workflow`, `run_workflow`, `get_workflow_status` |
|-------|------|
| Module | `src-tauri/src/mcp/tools/workflows.rs` |

Acceptance criteria:

- Workflows created via MCP are visible and runnable from UI
- `run_workflow` returns a run ID for status polling
- `get_workflow_status` shows step-by-step progress

---

### 6.8 -- Knowledge Tools

Expose knowledge base operations.

| Tools | `list_documents`, `create_document`, `get_document`, `update_document`, `delete_document` |
|-------|------|
| Module | `src-tauri/src/mcp/tools/knowledge.rs` |

Acceptance criteria:

- Documents created via MCP are injected into agent context during spawning
- Search works across title, tags, and content
- Category filtering works correctly

---

### 6.9 -- History & Stats Tools

Expose activity history and statistics.

| Tools | `get_history`, `get_stats` |
|-------|------|
| Module | `src-tauri/src/mcp/tools/history.rs` |

Acceptance criteria:

- History query supports all filter combinations
- Stats aggregate correctly for each time period
- MCP tool calls themselves are optionally logged to history

---

### 6.10 -- MCP Resources

Expose read-only resource URIs for quick state inspection.

| Module | `src-tauri/src/mcp/resources/` |
|--------|------|
| URIs | `zentral://agents`, `zentral://projects/active`, `zentral://skills`, `zentral://schedules`, `zentral://workflows`, `zentral://knowledge`, `zentral://history/recent`, `zentral://settings`, `zentral://status` |

Acceptance criteria:

- All resources return current state as JSON
- `zentral://status` provides a quick overview (agents online, active project, pending schedules, recent errors)
- Resources are read-only (mutations require tools)

---

### 6.11 -- Settings UI for MCP

Add MCP server controls to the Settings dialog.

| Component | Location |
|-----------|----------|
| MCP settings section | `GeneralTab.tsx` or new `McpTab.tsx` |
| Fields | Enable/disable toggle, port input, status indicator, copy config button |

Acceptance criteria:

- Users can enable/disable the MCP server from Settings
- Port is editable with validation (1024-65535)
- "Copy Config" button copies Claude Code MCP config JSON to clipboard
- Status shows: Running / Stopped / Error with port number
- Restart button available when config changes

---

## Implementation Order

```
6.1 MCP Server Core          ← Foundation, must be first
  ↓
6.2 Agent Tools               ← Core feature
6.4 Project Tools              ← Independent, parallel with 6.2
  ↓
6.3 Chat Tools                ← Depends on agent tools working
6.5 Skill Tools               ← Depends on agent tools working
  ↓
6.6 Schedule Tools            ← Can be parallel
6.7 Workflow Tools            ← Can be parallel
6.8 Knowledge Tools           ← Can be parallel
6.9 History Tools             ← Can be parallel
  ↓
6.10 MCP Resources            ← After all tools, resources are read projections
6.11 Settings UI              ← Last, polish
```

Estimated duration: 3-4 weeks (assumes SQLite persistence from earlier phases is in place).

## Definition of Done

Phase 6 is complete when:

1. MCP server starts with the app and accepts Claude Code connections.
2. All 25+ tools are functional and match their schemas.
3. All resource URIs return current state.
4. State changes via MCP are reflected in the UI in real-time.
5. State changes via the UI are visible to MCP clients.
6. Settings UI provides MCP server controls and config export.
7. No regressions in existing features.
8. Security: server binds to localhost only, no external exposure.

## References

- [MCP Server Specification](../02-specifications/mcp-server.md)
- [Roadmap Overview](roadmap.md)
- [Phase 5 Automation](phase-5-automation.md)
- [System Architecture](../01-architecture/system-architecture.md)
- [MCP Protocol Specification](https://spec.modelcontextprotocol.io/)
