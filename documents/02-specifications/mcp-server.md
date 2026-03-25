# MCP Server -- Embedded Integration Bridge

> Zentral exposes its full feature set as an MCP (Model Context Protocol) server, allowing Claude Code and other MCP clients to directly interact with agents, schedules, workflows, knowledge, and all app state.

> **Status:** draft
> **Last updated:** 2026-03-25

---

## Motivation

Currently Zentral is a standalone desktop app. Users interact with it through the UI. But the real power comes when Claude Code (or any MCP-compatible tool) can **directly operate Zentral** -- creating schedules, dispatching agents, querying history, injecting knowledge -- all through natural language.

Example flow:
```
User (in Claude Code): "Schedule agent Koda to review PRs every morning at 9am"
  → Claude Code calls MCP tool `create_schedule`
  → Zentral creates the schedule, persists it, starts the cron
  → Done. No UI interaction needed.
```

This turns Zentral from a "tool you use" into a "tool that works for you" -- controllable from any MCP client.

## Architecture

### Transport: SSE (Server-Sent Events)

The MCP server is embedded directly in the Tauri Rust backend, running on `localhost:{port}` (default: `23847`). This gives it direct access to all managed state (agents, stores, SQLite) without IPC overhead.

```
┌─────────────────────────────────────────────────┐
│                  Zentral App                     │
│                                                  │
│  ┌──────────────┐     ┌──────────────────────┐  │
│  │  React UI    │     │  MCP Server (SSE)    │  │
│  │  (WebView)   │     │  localhost:23847     │  │
│  │              │     │                      │  │
│  │  Tauri IPC ──┼─────┤  Shared State:       │  │
│  │              │     │  - AgentManager      │  │
│  │              │     │  - SQLite            │  │
│  │              │     │  - Schedules         │  │
│  │              │     │  - Workflows         │  │
│  └──────────────┘     └──────────┬───────────┘  │
│                                   │              │
└───────────────────────────────────┼──────────────┘
                                    │
                    MCP Protocol (SSE / JSON-RPC)
                                    │
                    ┌───────────────▼───────────────┐
                    │  Claude Code / MCP Client     │
                    │                               │
                    │  .claude/settings.json:       │
                    │  "mcpServers": {              │
                    │    "zentral": {               │
                    │      "url": "http://          │
                    │        localhost:23847/mcp"    │
                    │    }                          │
                    │  }                            │
                    └───────────────────────────────┘
```

### Why SSE over stdio

| Aspect | stdio | SSE (chosen) |
|--------|-------|-------------|
| Requires separate binary | Yes | No |
| Access to app state | Indirect (socket/IPC) | Direct (shared memory) |
| Lifecycle | Claude Code manages process | App manages server |
| Multiple clients | One at a time | Multiple concurrent |
| Hot reload | Restart process | Server stays up |

### Port Configuration

- Default port: `23847` (configurable in Settings)
- Auto-start: MCP server starts when Zentral launches
- Toggle: can be enabled/disabled in Settings → Advanced
- Port conflict: auto-increment to next available port, emit notification

---

## MCP Tools

### Agent Management

#### `list_agents`
List all agents in the workspace.

```json
{
  "name": "list_agents",
  "description": "List all agents with their status, roles, skills, and project assignments",
  "inputSchema": {
    "type": "object",
    "properties": {
      "status": {
        "type": "string",
        "enum": ["online", "idle", "running", "error", "stopped", "queued"],
        "description": "Filter by agent status"
      },
      "project_id": {
        "type": "string",
        "description": "Filter agents assigned to a specific project"
      }
    }
  }
}
```

Returns: Array of `{ id, name, role, status, skills[], isSecretary, projectIds[] }`

#### `get_agent`
Get details of a specific agent.

```json
{
  "name": "get_agent",
  "inputSchema": {
    "type": "object",
    "properties": {
      "agent_id": { "type": "string" }
    },
    "required": ["agent_id"]
  }
}
```

#### `create_agent`
Create a new agent with role and skills.

```json
{
  "name": "create_agent",
  "inputSchema": {
    "type": "object",
    "properties": {
      "name": { "type": "string" },
      "role": { "type": "string" },
      "skills": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Skill IDs from the skill pool"
      }
    },
    "required": ["name", "role"]
  }
}
```

#### `update_agent`
Update an existing agent's configuration.

```json
{
  "name": "update_agent",
  "inputSchema": {
    "type": "object",
    "properties": {
      "agent_id": { "type": "string" },
      "name": { "type": "string" },
      "role": { "type": "string" },
      "skills": { "type": "array", "items": { "type": "string" } },
      "status": { "type": "string" }
    },
    "required": ["agent_id"]
  }
}
```

#### `delete_agent`
Remove an agent (cannot delete builtin agents).

```json
{
  "name": "delete_agent",
  "inputSchema": {
    "type": "object",
    "properties": {
      "agent_id": { "type": "string" }
    },
    "required": ["agent_id"]
  }
}
```

---

### Chat & Messaging

#### `send_message`
Send a message to a specific agent and receive the response.

```json
{
  "name": "send_message",
  "description": "Send a message to an agent. Returns the agent's response after streaming completes.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "agent_id": { "type": "string" },
      "message": { "type": "string" },
      "project_id": {
        "type": "string",
        "description": "Project context. Defaults to active project."
      }
    },
    "required": ["agent_id", "message"]
  }
}
```

Returns: `{ message_id, response_text, agent_id, duration_ms }`

#### `get_chat_history`
Retrieve chat history for an agent.

```json
{
  "name": "get_chat_history",
  "inputSchema": {
    "type": "object",
    "properties": {
      "agent_id": { "type": "string" },
      "project_id": { "type": "string" },
      "limit": { "type": "number", "default": 50 },
      "before_timestamp": { "type": "number" }
    },
    "required": ["agent_id"]
  }
}
```

---

### Projects

#### `list_projects`
List all registered projects.

```json
{
  "name": "list_projects",
  "inputSchema": { "type": "object", "properties": {} }
}
```

Returns: Array of `{ id, name, path, contextBadges[], lastOpenedAt }`

#### `get_active_project`
Get the currently active project.

#### `switch_project`
Switch the active project (all agents change CWD).

```json
{
  "name": "switch_project",
  "inputSchema": {
    "type": "object",
    "properties": {
      "project_id": { "type": "string" }
    },
    "required": ["project_id"]
  }
}
```

#### `create_project`
Register a new project by path.

```json
{
  "name": "create_project",
  "inputSchema": {
    "type": "object",
    "properties": {
      "name": { "type": "string" },
      "path": { "type": "string" },
      "context_badges": {
        "type": "array",
        "items": { "type": "string" }
      }
    },
    "required": ["name", "path"]
  }
}
```

---

### Skills

#### `list_skills`
List all available skills (builtin + custom).

```json
{
  "name": "list_skills",
  "inputSchema": {
    "type": "object",
    "properties": {
      "category": { "type": "string", "description": "Filter by category" }
    }
  }
}
```

#### `create_skill`
Create a custom skill.

```json
{
  "name": "create_skill",
  "inputSchema": {
    "type": "object",
    "properties": {
      "name": { "type": "string" },
      "description": { "type": "string" },
      "category": { "type": "string" },
      "prompt": { "type": "string", "description": "System prompt for skill execution" }
    },
    "required": ["name", "description", "category", "prompt"]
  }
}
```

#### `run_skill`
Execute a skill with a specific agent.

```json
{
  "name": "run_skill",
  "description": "Run a skill with the specified agent. The skill's system prompt is injected and the agent processes the user message.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "agent_id": { "type": "string" },
      "skill_id": { "type": "string" },
      "message": { "type": "string", "description": "User message / task for the skill" },
      "project_id": { "type": "string" }
    },
    "required": ["agent_id", "skill_id", "message"]
  }
}
```

---

### Schedules

#### `list_schedules`
List all schedules with status.

```json
{
  "name": "list_schedules",
  "inputSchema": {
    "type": "object",
    "properties": {
      "status": { "type": "string", "enum": ["active", "paused", "disabled"] }
    }
  }
}
```

#### `create_schedule`
Create a new scheduled task.

```json
{
  "name": "create_schedule",
  "description": "Schedule an agent to run a skill on a recurring basis",
  "inputSchema": {
    "type": "object",
    "properties": {
      "name": { "type": "string" },
      "agent_id": { "type": "string" },
      "skill_id": { "type": "string" },
      "frequency": { "type": "string", "enum": ["daily", "weekly", "monthly", "custom"] },
      "cron_expression": {
        "type": "string",
        "description": "Required when frequency is 'custom'. Standard cron syntax."
      },
      "prompt": { "type": "string", "description": "Task prompt for the agent" },
      "description": { "type": "string" },
      "project_id": { "type": "string" }
    },
    "required": ["name", "agent_id", "skill_id", "frequency", "prompt"]
  }
}
```

#### `update_schedule`
Update an existing schedule.

#### `toggle_schedule`
Toggle a schedule between active and paused.

```json
{
  "name": "toggle_schedule",
  "inputSchema": {
    "type": "object",
    "properties": {
      "schedule_id": { "type": "string" }
    },
    "required": ["schedule_id"]
  }
}
```

#### `delete_schedule`
Remove a schedule.

---

### Workflows

#### `list_workflows`
List all workflows.

#### `create_workflow`
Create a multi-step workflow.

```json
{
  "name": "create_workflow",
  "description": "Create a new workflow with ordered steps",
  "inputSchema": {
    "type": "object",
    "properties": {
      "name": { "type": "string" },
      "description": { "type": "string" },
      "project_id": { "type": "string" },
      "steps": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "agent_id": { "type": "string" },
            "skill_id": { "type": "string" },
            "label": { "type": "string" },
            "on_success": { "type": "string", "description": "Step ID to run on success" },
            "on_failure": { "type": "string", "description": "Step ID to run on failure" }
          },
          "required": ["agent_id", "skill_id", "label"]
        }
      }
    },
    "required": ["name", "steps"]
  }
}
```

#### `run_workflow`
Execute a workflow.

```json
{
  "name": "run_workflow",
  "description": "Start a workflow execution. Returns the run ID for tracking.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "workflow_id": { "type": "string" },
      "input_message": { "type": "string", "description": "Initial message passed to the first step" }
    },
    "required": ["workflow_id"]
  }
}
```

#### `get_workflow_status`
Check the status of a running workflow.

---

### Knowledge Base

#### `list_documents`
List knowledge documents with optional filtering.

```json
{
  "name": "list_documents",
  "inputSchema": {
    "type": "object",
    "properties": {
      "category": { "type": "string", "enum": ["notes", "references", "specs", "guidelines"] },
      "project_id": { "type": "string" },
      "search": { "type": "string", "description": "Search by title and tags" }
    }
  }
}
```

#### `create_document`
Add a document to the knowledge base.

```json
{
  "name": "create_document",
  "description": "Create a knowledge document that agents can reference during execution",
  "inputSchema": {
    "type": "object",
    "properties": {
      "title": { "type": "string" },
      "content": { "type": "string" },
      "category": { "type": "string", "enum": ["notes", "references", "specs", "guidelines"] },
      "tags": { "type": "array", "items": { "type": "string" } },
      "project_ids": { "type": "array", "items": { "type": "string" } },
      "agent_ids": { "type": "array", "items": { "type": "string" } }
    },
    "required": ["title", "content", "category"]
  }
}
```

#### `get_document`
Read a specific document's full content.

#### `update_document`
Update a document.

#### `delete_document`
Remove a document.

---

### Activity History

#### `get_history`
Query the activity history with filters.

```json
{
  "name": "get_history",
  "description": "Query agent activity history with optional filters",
  "inputSchema": {
    "type": "object",
    "properties": {
      "agent_id": { "type": "string" },
      "project_id": { "type": "string" },
      "event_type": {
        "type": "string",
        "enum": ["skill_run", "agent_start", "agent_stop", "workflow_run", "schedule_trigger", "error"]
      },
      "status": { "type": "string", "enum": ["success", "failure", "running", "cancelled"] },
      "limit": { "type": "number", "default": 50 },
      "search": { "type": "string" }
    }
  }
}
```

#### `get_stats`
Get summary statistics.

```json
{
  "name": "get_stats",
  "description": "Get workspace statistics: agent activity counts, success rates, most active agents",
  "inputSchema": {
    "type": "object",
    "properties": {
      "period": { "type": "string", "enum": ["today", "week", "month", "all"] }
    }
  }
}
```

---

### Settings

#### `get_settings`
Read current app settings.

#### `update_settings`
Modify app settings.

```json
{
  "name": "update_settings",
  "inputSchema": {
    "type": "object",
    "properties": {
      "theme": { "type": "string" },
      "max_concurrent_agents": { "type": "number" },
      "telegram_enabled": { "type": "boolean" },
      "mcp_port": { "type": "number" }
    }
  }
}
```

---

## MCP Resources

In addition to tools, the MCP server exposes read-only resources:

| Resource URI | Description |
|-------------|-------------|
| `zentral://agents` | Current agent list with status |
| `zentral://agents/{id}` | Single agent detail |
| `zentral://projects` | Project list |
| `zentral://projects/active` | Active project info |
| `zentral://skills` | Full skill catalog |
| `zentral://schedules` | Schedule list |
| `zentral://workflows` | Workflow list |
| `zentral://knowledge` | Knowledge document index |
| `zentral://knowledge/{id}` | Full document content |
| `zentral://history/recent` | Last 20 history events |
| `zentral://settings` | Current settings |
| `zentral://status` | App status summary (agents online, active project, pending schedules) |

Resources are useful for Claude Code to quickly understand workspace state without calling tools.

---

## Implementation Plan

### Rust Crate Dependencies

```toml
[dependencies]
# MCP server
rmcp = { version = "0.1", features = ["server", "transport-sse"] }
# Or build on lower-level:
axum = "0.7"                    # HTTP server for SSE
tokio = { version = "1", features = ["full"] }
tower = "0.4"
serde_json = "1"
```

### Module Structure

```
src-tauri/src/
├── mcp/
│   ├── mod.rs              # MCP server setup, start/stop
│   ├── server.rs           # SSE transport, JSON-RPC handling
│   ├── tools/
│   │   ├── mod.rs          # Tool registry
│   │   ├── agents.rs       # Agent CRUD tools
│   │   ├── chat.rs         # Messaging tools
│   │   ├── projects.rs     # Project tools
│   │   ├── skills.rs       # Skill tools
│   │   ├── schedules.rs    # Schedule tools
│   │   ├── workflows.rs    # Workflow tools
│   │   ├── knowledge.rs    # Knowledge tools
│   │   ├── history.rs      # History tools
│   │   └── settings.rs     # Settings tools
│   └── resources/
│       ├── mod.rs          # Resource registry
│       └── providers.rs    # Resource URI handlers
```

### State Sharing

The MCP server shares Tauri's managed state via `Arc<Mutex<>>`:

```rust
// In lib.rs
let shared_state = Arc::new(AppState {
    agents: Mutex::new(AgentManager::new()),
    db: Mutex::new(Database::open(db_path)),
    settings: Mutex::new(AppSettings::default()),
    // ...
});

// Tauri uses it
app.manage(shared_state.clone());

// MCP server uses same reference
mcp::start_server(shared_state.clone(), port).await;
```

### Startup Flow

```
Zentral launches
  → Tauri app initializes
  → Managed state created
  → MCP server starts on background thread
    → Binds to localhost:23847
    → Registers all tools + resources
    → Ready for connections
  → React UI loads
  → UI settings show MCP server status + port
```

### Frontend Integration

The Settings UI shows MCP server status:

```
┌─ Settings ─────────────────────────────────┐
│                                             │
│  MCP Server                                 │
│  ┌─────────────────────────────────────┐   │
│  │ Status:  ● Running                  │   │
│  │ Port:    23847                       │   │
│  │ URL:     http://localhost:23847/mcp  │   │
│  │                                      │   │
│  │ [Copy Config]  [Restart]  [Stop]     │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Claude Code config (click to copy):        │
│  ┌─────────────────────────────────────┐   │
│  │ {                                    │   │
│  │   "mcpServers": {                   │   │
│  │     "zentral": {                    │   │
│  │       "url": "http://localhost:     │   │
│  │              23847/mcp"             │   │
│  │     }                               │   │
│  │   }                                  │   │
│  │ }                                    │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

---

## Security

- **Localhost only**: MCP server binds to `127.0.0.1`, not `0.0.0.0`
- **No authentication** (v1): since it's localhost-only, same trust model as Claude Code itself
- **Future**: optional bearer token for remote access scenarios
- **Rate limiting**: basic rate limiting to prevent accidental infinite loops
- **Read-only mode**: optional flag to disable mutation tools (useful for monitoring)

---

## Usage Examples

### Claude Code Configuration

```json
// .claude/settings.json
{
  "mcpServers": {
    "zentral": {
      "url": "http://localhost:23847/mcp"
    }
  }
}
```

### Natural Language Workflows

```
User: "Set up Koda to review all PRs every morning at 9am"

Claude Code:
  1. Calls list_agents → finds agent-koda
  2. Calls list_skills → finds review-pr skill
  3. Calls create_schedule:
     {
       name: "Morning PR Review",
       agent_id: "agent-koda",
       skill_id: "review-pr",
       frequency: "daily",
       cron_expression: "0 9 * * *",
       prompt: "Review all open PRs in the current project"
     }
  4. Returns: "Done! Koda will review PRs every day at 9:00 AM."
```

```
User: "What did my agents do today?"

Claude Code:
  1. Calls get_history { period: "today" }
  2. Calls get_stats { period: "today" }
  3. Returns summary of agent activity
```

```
User: "Create a deployment workflow: Prova runs tests, then Vex commits if tests pass"

Claude Code:
  1. Calls create_workflow:
     {
       name: "Deploy Pipeline",
       steps: [
         { agent_id: "agent-prova", skill_id: "test", label: "Run Tests" },
         { agent_id: "agent-vex", skill_id: "commit", label: "Commit Changes",
           on_failure: null }
       ]
     }
  2. Returns: "Workflow 'Deploy Pipeline' created with 2 steps."
```

---

## References

- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [System Architecture](../01-architecture/system-architecture.md)
- [Agent Manager](agent-manager.md)
- [Schedules](schedules.md)
- [Workflows](workflows.md)
- [Knowledge Base](knowledge-base.md)
- [Activity History](activity-history.md)
