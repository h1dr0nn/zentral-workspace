# Tauri Bridge -- IPC Contract

> Complete reference for all Tauri commands and events that form the communication contract between the React frontend and the Rust core in Zentral.

> **Status:** draft
> **Last updated:** 2026-03-24

---

## Overview

Zentral uses Tauri v2 IPC as the sole communication channel between the React frontend and the Rust backend. There are two mechanisms:

1. **Commands (invoke)** -- Frontend calls a named Rust function, receives a promise that resolves with the return value or rejects with an error string.
2. **Events (emit/listen)** -- Rust emits named events with JSON payloads; the frontend subscribes to them with listeners.

All data crosses the boundary as JSON. Rust structs derive `serde::Serialize` (and `Deserialize` for inputs). TypeScript interfaces mirror these structs.

```
React (TypeScript)                    Rust Core
+--------------------+               +--------------------+
|                    |  -- invoke --> |                    |
|  invoke("cmd", {})----Promise----->| #[tauri::command]  |
|                    |<-- resolve -- |  fn cmd() -> T     |
|                    |<-- reject --- |                    |
|                    |               |                    |
|  listen("event",  |<-- emit ----- |  app.emit("event", |
|    callback)       |    JSON       |    payload)        |
+--------------------+               +--------------------+
```

## Agent Commands

### create_agent

Creates a new agent, spawns its Claude CLI child process, and begins reading its output.

```rust
#[tauri::command]
async fn create_agent(
    manager: State<'_, Arc<Mutex<AgentManager>>>,
    pool: State<'_, Arc<Mutex<SkillPool>>>,
    app: AppHandle,
    name: String,
    model: Option<String>,
    system_prompt: Option<String>,
    skill_ids: Option<Vec<String>>,
) -> Result<AgentInfo, CommandError>
```

```typescript
import { invoke } from "@tauri-apps/api/core";

interface AgentInfo {
  id: string;
  name: string;
  model: string;
  status: "running" | "stopped" | "errored";
  skills: string[];
  created_at: string;
}

const agent = await invoke<AgentInfo>("create_agent", {
  name: "CodeReviewer",
  model: "claude-sonnet-4-20250514",
  systemPrompt: "You are a code reviewer.",
  skillIds: ["skill-lint", "skill-review"],
});
```

### delete_agent

Stops the agent process if running, removes it from the manager, and deletes its database record.

```rust
#[tauri::command]
async fn delete_agent(
    manager: State<'_, Arc<Mutex<AgentManager>>>,
    agent_id: String,
) -> Result<(), CommandError>
```

```typescript
await invoke("delete_agent", { agentId: "agent-abc123" });
```

### update_agent

Updates mutable fields on an existing agent. The agent does not need to be restarted for name or prompt changes to take effect on the next message.

```rust
#[tauri::command]
async fn update_agent(
    manager: State<'_, Arc<Mutex<AgentManager>>>,
    agent_id: String,
    name: Option<String>,
    model: Option<String>,
    system_prompt: Option<String>,
) -> Result<AgentInfo, CommandError>
```

```typescript
const updated = await invoke<AgentInfo>("update_agent", {
  agentId: "agent-abc123",
  name: "SeniorReviewer",
});
```

### list_agents

Returns all agents with their current status.

```rust
#[tauri::command]
async fn list_agents(
    manager: State<'_, Arc<Mutex<AgentManager>>>,
) -> Result<Vec<AgentInfo>, CommandError>
```

```typescript
const agents = await invoke<AgentInfo[]>("list_agents");
```

### send_message

Sends a user message to a specific agent. The agent's response arrives asynchronously via the `agent_output` event.

```rust
#[tauri::command]
async fn send_message(
    manager: State<'_, Arc<Mutex<AgentManager>>>,
    agent_id: String,
    content: String,
) -> Result<MessageId, CommandError>
```

```typescript
interface MessageId {
  id: string;
}

const msg = await invoke<MessageId>("send_message", {
  agentId: "agent-abc123",
  content: "Review this pull request.",
});
```

### stop_agent

Sends SIGTERM (Unix) or TerminateProcess (Windows) to the agent's child process. Status changes to `stopped`.

```rust
#[tauri::command]
async fn stop_agent(
    manager: State<'_, Arc<Mutex<AgentManager>>>,
    agent_id: String,
) -> Result<(), CommandError>
```

```typescript
await invoke("stop_agent", { agentId: "agent-abc123" });
```

### restart_agent

Stops and re-spawns the agent process, preserving its configuration.

```rust
#[tauri::command]
async fn restart_agent(
    manager: State<'_, Arc<Mutex<AgentManager>>>,
    app: AppHandle,
    agent_id: String,
) -> Result<AgentInfo, CommandError>
```

```typescript
const agent = await invoke<AgentInfo>("restart_agent", {
  agentId: "agent-abc123",
});
```

## Secretary Commands

### dispatch_to_secretary

Sends a high-level task to the Secretary agent, which decomposes it and dispatches sub-tasks to worker agents.

```rust
#[tauri::command]
async fn dispatch_to_secretary(
    secretary: State<'_, Arc<Mutex<SecretaryAgent>>>,
    app: AppHandle,
    task: String,
    context: Option<String>,
) -> Result<DispatchResult, CommandError>
```

```typescript
interface DispatchResult {
  dispatch_id: string;
  sub_tasks: SubTask[];
}

interface SubTask {
  id: string;
  agent_id: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "failed";
}

const result = await invoke<DispatchResult>("dispatch_to_secretary", {
  task: "Refactor the authentication module and write tests.",
  context: "The auth module is in src/auth/",
});
```

### get_secretary_status

Returns the current state of the Secretary, including active dispatches.

```rust
#[tauri::command]
async fn get_secretary_status(
    secretary: State<'_, Arc<Mutex<SecretaryAgent>>>,
) -> Result<SecretaryStatus, CommandError>
```

```typescript
interface SecretaryStatus {
  is_active: boolean;
  active_dispatches: DispatchResult[];
  total_completed: number;
}

const status = await invoke<SecretaryStatus>("get_secretary_status");
```

## Project Commands

### list_projects

```rust
#[tauri::command]
async fn list_projects(
    projects: State<'_, Arc<Mutex<ProjectManager>>>,
) -> Result<Vec<ProjectInfo>, CommandError>
```

```typescript
interface ProjectInfo {
  id: string;
  name: string;
  path: string;
  is_active: boolean;
  created_at: string;
}

const projects = await invoke<ProjectInfo[]>("list_projects");
```

### add_project

Registers a new project directory. Validates that the path exists on disk.

```rust
#[tauri::command]
async fn add_project(
    projects: State<'_, Arc<Mutex<ProjectManager>>>,
    name: String,
    path: String,
) -> Result<ProjectInfo, CommandError>
```

```typescript
const project = await invoke<ProjectInfo>("add_project", {
  name: "zentral",
  path: "/home/user/projects/zentral",
});
```

### switch_project

Sets the active project. New agents will use this project's directory as their working directory.

```rust
#[tauri::command]
async fn switch_project(
    projects: State<'_, Arc<Mutex<ProjectManager>>>,
    app: AppHandle,
    project_id: String,
) -> Result<ProjectInfo, CommandError>
```

```typescript
const active = await invoke<ProjectInfo>("switch_project", {
  projectId: "proj-xyz",
});
```

### remove_project

Removes a project from the registry. Does not delete files on disk. Fails if the project is currently active.

```rust
#[tauri::command]
async fn remove_project(
    projects: State<'_, Arc<Mutex<ProjectManager>>>,
    project_id: String,
) -> Result<(), CommandError>
```

```typescript
await invoke("remove_project", { projectId: "proj-xyz" });
```

### get_active_project

Returns the currently active project, or `null` if none is set.

```rust
#[tauri::command]
async fn get_active_project(
    projects: State<'_, Arc<Mutex<ProjectManager>>>,
) -> Result<Option<ProjectInfo>, CommandError>
```

```typescript
const active = await invoke<ProjectInfo | null>("get_active_project");
```

## Telegram Commands

### start_telegram_bot

Starts the Telegram long-polling loop. Requires a bot token to be configured.

```rust
#[tauri::command]
async fn start_telegram_bot(
    bot: State<'_, Arc<Mutex<TelegramBot>>>,
    app: AppHandle,
) -> Result<(), CommandError>
```

```typescript
await invoke("start_telegram_bot");
```

### stop_telegram_bot

Stops the polling loop and disconnects.

```rust
#[tauri::command]
async fn stop_telegram_bot(
    bot: State<'_, Arc<Mutex<TelegramBot>>>,
) -> Result<(), CommandError>
```

```typescript
await invoke("stop_telegram_bot");
```

### get_telegram_status

```rust
#[tauri::command]
async fn get_telegram_status(
    bot: State<'_, Arc<Mutex<TelegramBot>>>,
) -> Result<TelegramStatus, CommandError>
```

```typescript
interface TelegramStatus {
  is_running: boolean;
  bot_username: string | null;
  last_update_id: number | null;
  connected_chats: number;
}

const status = await invoke<TelegramStatus>("get_telegram_status");
```

### set_telegram_config

Sets or updates the Telegram bot token and allowed chat IDs.

```rust
#[tauri::command]
async fn set_telegram_config(
    bot: State<'_, Arc<Mutex<TelegramBot>>>,
    db: State<'_, Arc<Database>>,
    token: String,
    allowed_chat_ids: Option<Vec<i64>>,
) -> Result<(), CommandError>
```

```typescript
await invoke("set_telegram_config", {
  token: "123456:ABC-DEF...",
  allowedChatIds: [12345678],
});
```

## Terminal / PTY Commands

### create_terminal_session

Allocates a PTY and spawns the user's default shell. Returns a session ID. Terminal output arrives via the `terminal_output` event.

```rust
#[tauri::command]
async fn create_terminal_session(
    app: AppHandle,
    rows: u16,
    cols: u16,
    cwd: Option<String>,
) -> Result<TerminalSession, CommandError>
```

```typescript
interface TerminalSession {
  session_id: string;
  shell: string;
  pid: number;
}

const session = await invoke<TerminalSession>("create_terminal_session", {
  rows: 24,
  cols: 80,
  cwd: "/home/user/projects",
});
```

### destroy_terminal_session

Kills the shell process and releases the PTY file descriptors.

```rust
#[tauri::command]
async fn destroy_terminal_session(
    session_id: String,
) -> Result<(), CommandError>
```

```typescript
await invoke("destroy_terminal_session", { sessionId: "sess-abc" });
```

### write_to_terminal

Writes raw bytes to the PTY stdin. Used for keyboard input, paste, and control sequences.

```rust
#[tauri::command]
async fn write_to_terminal(
    session_id: String,
    data: Vec<u8>,
) -> Result<(), CommandError>
```

```typescript
const encoder = new TextEncoder();
await invoke("write_to_terminal", {
  sessionId: "sess-abc",
  data: Array.from(encoder.encode("ls -la\n")),
});
```

### resize_terminal

Notifies the PTY of a terminal size change (e.g., when the user resizes the window).

```rust
#[tauri::command]
async fn resize_terminal(
    session_id: String,
    rows: u16,
    cols: u16,
) -> Result<(), CommandError>
```

```typescript
await invoke("resize_terminal", {
  sessionId: "sess-abc",
  rows: 40,
  cols: 120,
});
```

### get_terminal_snapshot

Returns the current visible state of the terminal grid, useful for re-rendering after the frontend reconnects.

```rust
#[tauri::command]
async fn get_terminal_snapshot(
    session_id: String,
) -> Result<TerminalSnapshot, CommandError>
```

```typescript
interface TerminalCell {
  char: string;
  fg: string;
  bg: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

interface TerminalSnapshot {
  rows: number;
  cols: number;
  cursor_row: number;
  cursor_col: number;
  cells: TerminalCell[][];
}

const snapshot = await invoke<TerminalSnapshot>("get_terminal_snapshot", {
  sessionId: "sess-abc",
});
```

## Config Commands

### get_settings

Returns the full application settings object.

```rust
#[tauri::command]
async fn get_settings(
    settings: State<'_, Arc<Mutex<AppSettings>>>,
) -> Result<AppSettings, CommandError>
```

```typescript
interface AppSettings {
  theme: string;
  font_family: string;
  font_size: number;
  shell_path: string | null;
  telegram_token: string | null;
  telegram_allowed_chats: number[];
  secretary_model: string;
  default_agent_model: string;
}

const settings = await invoke<AppSettings>("get_settings");
```

### update_settings

Merges partial settings into the current configuration and persists to the database.

```rust
#[tauri::command]
async fn update_settings(
    settings: State<'_, Arc<Mutex<AppSettings>>>,
    db: State<'_, Arc<Database>>,
    patch: SettingsPatch,
) -> Result<AppSettings, CommandError>
```

```typescript
interface SettingsPatch {
  theme?: string;
  font_family?: string;
  font_size?: number;
  shell_path?: string | null;
  secretary_model?: string;
  default_agent_model?: string;
}

const updated = await invoke<AppSettings>("update_settings", {
  patch: { theme: "catppuccin-mocha", fontSize: 14 },
});
```

### list_themes

Enumerates available theme files from the `themes/` directory.

```rust
#[tauri::command]
async fn list_themes() -> Result<Vec<ThemeInfo>, CommandError>
```

```typescript
interface ThemeInfo {
  id: string;
  name: string;
  is_dark: boolean;
}

const themes = await invoke<ThemeInfo[]>("list_themes");
```

### set_theme

Applies a theme by ID and persists the choice.

```rust
#[tauri::command]
async fn set_theme(
    settings: State<'_, Arc<Mutex<AppSettings>>>,
    db: State<'_, Arc<Database>>,
    theme_id: String,
) -> Result<ThemeInfo, CommandError>
```

```typescript
const theme = await invoke<ThemeInfo>("set_theme", { themeId: "nord" });
```

## Skill Commands

### list_skills

Returns all skills in the pool.

```rust
#[tauri::command]
async fn list_skills(
    pool: State<'_, Arc<Mutex<SkillPool>>>,
) -> Result<Vec<SkillInfo>, CommandError>
```

```typescript
interface SkillInfo {
  id: string;
  name: string;
  description: string | null;
  prompt: string;
  created_at: string;
}

const skills = await invoke<SkillInfo[]>("list_skills");
```

### create_skill

Adds a new skill to the pool.

```rust
#[tauri::command]
async fn create_skill(
    pool: State<'_, Arc<Mutex<SkillPool>>>,
    db: State<'_, Arc<Database>>,
    name: String,
    description: Option<String>,
    prompt: String,
) -> Result<SkillInfo, CommandError>
```

```typescript
const skill = await invoke<SkillInfo>("create_skill", {
  name: "code-review",
  description: "Reviews code for correctness and style.",
  prompt: "You are a code reviewer. Analyze the given code...",
});
```

### delete_skill

Removes a skill from the pool and from all agents that had it assigned.

```rust
#[tauri::command]
async fn delete_skill(
    pool: State<'_, Arc<Mutex<SkillPool>>>,
    db: State<'_, Arc<Database>>,
    skill_id: String,
) -> Result<(), CommandError>
```

```typescript
await invoke("delete_skill", { skillId: "skill-lint" });
```

### assign_skill

Assigns a skill to an agent.

```rust
#[tauri::command]
async fn assign_skill(
    pool: State<'_, Arc<Mutex<SkillPool>>>,
    manager: State<'_, Arc<Mutex<AgentManager>>>,
    db: State<'_, Arc<Database>>,
    agent_id: String,
    skill_id: String,
) -> Result<(), CommandError>
```

```typescript
await invoke("assign_skill", {
  agentId: "agent-abc123",
  skillId: "skill-review",
});
```

### remove_skill_from_agent

Removes a skill assignment from an agent.

```rust
#[tauri::command]
async fn remove_skill_from_agent(
    pool: State<'_, Arc<Mutex<SkillPool>>>,
    db: State<'_, Arc<Database>>,
    agent_id: String,
    skill_id: String,
) -> Result<(), CommandError>
```

```typescript
await invoke("remove_skill_from_agent", {
  agentId: "agent-abc123",
  skillId: "skill-review",
});
```

## Events

Events flow from Rust to the frontend. The Rust side calls `app.emit(event_name, payload)` and the frontend subscribes with `listen`.

### Event Summary

| Event Name | Payload Type | Emitted When |
|---|---|---|
| `agent_output` | `AgentOutputPayload` | Agent writes to stdout |
| `agent_status_changed` | `AgentStatusPayload` | Agent starts, stops, exits, or errors |
| `agent_error` | `AgentErrorPayload` | Agent writes to stderr or encounters a runtime error |
| `secretary_dispatch` | `SecretaryDispatchPayload` | Secretary creates sub-tasks and assigns them |
| `secretary_response` | `SecretaryResponsePayload` | A sub-task completes or the entire dispatch finishes |
| `telegram_message` | `TelegramMessagePayload` | An incoming Telegram message is received |
| `telegram_status` | `TelegramStatusPayload` | Bot connection state changes |
| `terminal_output` | `TerminalOutputPayload` | PTY produces output bytes |
| `terminal_exited` | `TerminalExitedPayload` | Shell process inside PTY exits |
| `project_changed` | `ProjectChangedPayload` | Active project switches |

### Event Payloads

```typescript
// Agent events
interface AgentOutputPayload {
  agent_id: string;
  data: number[]; // raw bytes, decode as UTF-8
  timestamp: string;
}

interface AgentStatusPayload {
  agent_id: string;
  status: "running" | "stopped" | "errored";
  exit_code: number | null;
}

interface AgentErrorPayload {
  agent_id: string;
  message: string;
  timestamp: string;
}

// Secretary events
interface SecretaryDispatchPayload {
  dispatch_id: string;
  task: string;
  sub_tasks: SubTask[];
}

interface SecretaryResponsePayload {
  dispatch_id: string;
  sub_task_id: string;
  agent_id: string;
  status: "completed" | "failed";
  result: string | null;
}

// Telegram events
interface TelegramMessagePayload {
  chat_id: number;
  from_username: string | null;
  text: string;
  timestamp: string;
}

interface TelegramStatusPayload {
  is_running: boolean;
  error: string | null;
}

// Terminal events
interface TerminalOutputPayload {
  session_id: string;
  data: number[]; // raw bytes
}

interface TerminalExitedPayload {
  session_id: string;
  exit_code: number | null;
}

// Project events
interface ProjectChangedPayload {
  project: ProjectInfo;
}
```

### Frontend Listener Pattern

```typescript
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

// In a React component or Zustand store
let unlisten: UnlistenFn;

async function setupListeners() {
  unlisten = await listen<AgentOutputPayload>("agent_output", (event) => {
    const { agent_id, data } = event.payload;
    const text = new TextDecoder().decode(new Uint8Array(data));
    appendToAgentLog(agent_id, text);
  });
}

// Cleanup on unmount
function teardown() {
  unlisten?.();
}
```

### Rust Emit Pattern

```rust
use tauri::Emitter;

// Inside an async task reading agent stdout
fn emit_agent_output(app: &AppHandle, agent_id: &str, data: &[u8]) {
    let payload = AgentOutputPayload {
        agent_id: agent_id.to_string(),
        data: data.to_vec(),
        timestamp: chrono::Utc::now().to_rfc3339(),
    };
    app.emit("agent_output", &payload).ok();
}
```

## Serialization

All data crossing the IPC boundary is serialized as JSON via `serde`.

### Rust to TypeScript Type Mapping

| Rust Type | JSON | TypeScript |
|---|---|---|
| `String` | `"string"` | `string` |
| `i32`, `i64` | `123` | `number` |
| `u16`, `u32` | `123` | `number` |
| `f64` | `1.5` | `number` |
| `bool` | `true` / `false` | `boolean` |
| `Option<T>` | `value` or `null` | `T \| null` |
| `Vec<T>` | `[...]` | `T[]` |
| `Vec<u8>` | `[1, 2, 3]` | `number[]` |
| `HashMap<String, T>` | `{...}` | `Record<string, T>` |
| `()` | `null` | `void` (invoke resolves to `null`) |

### Naming Convention

Rust struct fields use `snake_case`. Serde serializes them as `snake_case` in JSON. The TypeScript side uses the same `snake_case` keys. Tauri command arguments, however, are converted from `snake_case` in Rust to `camelCase` in the TypeScript `invoke` call by Tauri's built-in argument deserialization.

```rust
// Rust command
#[tauri::command]
async fn create_agent(
    name: String,
    system_prompt: Option<String>,  // snake_case in Rust
) -> Result<AgentInfo, CommandError>
```

```typescript
// TypeScript call -- camelCase for arguments
await invoke("create_agent", {
  name: "Coder",
  systemPrompt: "You write code.",  // camelCase in invoke
});
```

```typescript
// Return value fields stay snake_case
const agent = await invoke<AgentInfo>("create_agent", { name: "Coder" });
console.log(agent.created_at); // snake_case in response
```

## Error Handling

When a `#[tauri::command]` function returns `Err(CommandError)`, Tauri serializes the error using its `Serialize` implementation and rejects the frontend promise.

### Error Flow

```
Rust                                  TypeScript
+-----------------------------------+
| fn cmd() -> Result<T, CommandError>|
|   return Err(AgentError::NotFound) |
+-----------------------------------+
        |
        | Tauri serializes CommandError via Serialize impl
        | -> "agent not found: agent-xyz"
        v
+-----------------------------------+
| invoke("cmd", {...})              |
|   .catch((error: string) => {     |
|     // error = "agent not found..." |
|   });                              |
+-----------------------------------+
```

### Frontend Error Handling Pattern

```typescript
try {
  const agent = await invoke<AgentInfo>("create_agent", { name: "" });
} catch (error) {
  // error is a string from CommandError::to_string()
  if (typeof error === "string") {
    showNotification({ type: "error", message: error });
  }
}
```

### Command Return Type Summary

| Command | Ok Type | Error Conditions |
|---|---|---|
| `create_agent` | `AgentInfo` | Spawn failed, invalid skill IDs |
| `delete_agent` | `()` | Agent not found |
| `update_agent` | `AgentInfo` | Agent not found |
| `list_agents` | `Vec<AgentInfo>` | Database error |
| `send_message` | `MessageId` | Agent not found, agent not running |
| `stop_agent` | `()` | Agent not found, already stopped |
| `restart_agent` | `AgentInfo` | Agent not found, spawn failed |
| `dispatch_to_secretary` | `DispatchResult` | Secretary not active, no available agents |
| `get_secretary_status` | `SecretaryStatus` | -- |
| `list_projects` | `Vec<ProjectInfo>` | Database error |
| `add_project` | `ProjectInfo` | Path does not exist, duplicate name |
| `switch_project` | `ProjectInfo` | Project not found |
| `remove_project` | `()` | Project not found, project is active |
| `get_active_project` | `Option<ProjectInfo>` | Database error |
| `start_telegram_bot` | `()` | No token configured, already running |
| `stop_telegram_bot` | `()` | Not running |
| `get_telegram_status` | `TelegramStatus` | -- |
| `set_telegram_config` | `()` | Invalid token format |
| `create_terminal_session` | `TerminalSession` | PTY allocation failed |
| `destroy_terminal_session` | `()` | Session not found |
| `write_to_terminal` | `()` | Session not found, write failed |
| `resize_terminal` | `()` | Session not found |
| `get_terminal_snapshot` | `TerminalSnapshot` | Session not found |
| `get_settings` | `AppSettings` | Database error |
| `update_settings` | `AppSettings` | Validation error |
| `list_themes` | `Vec<ThemeInfo>` | Filesystem error |
| `set_theme` | `ThemeInfo` | Theme not found |
| `list_skills` | `Vec<SkillInfo>` | Database error |
| `create_skill` | `SkillInfo` | Duplicate name |
| `delete_skill` | `()` | Skill not found |
| `assign_skill` | `()` | Agent or skill not found |
| `remove_skill_from_agent` | `()` | Assignment not found |

## References

- [Rust Core Architecture](./rust-core.md)
- [System Architecture](./system-architecture.md)
- [Tauri v2 Commands Documentation](https://v2.tauri.app/develop/calling-rust/)
- [Tauri v2 Events Documentation](https://v2.tauri.app/develop/calling-rust/#events)
- [serde Documentation](https://serde.rs)
