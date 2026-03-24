# Data Flow Reference

> Step-by-step data flows for every major user action in Zentral, showing exactly which components participate and in what order.

> **Status:** draft
> **Last updated:** 2026-03-24

---

## Overview

This document traces data through the Zentral stack for all primary operations. Each flow follows the same layered path: React UI components interact with Zustand stores, call Rust command handlers via Tauri `invoke()`, and receive asynchronous updates via Tauri `emit()` events. Understanding these flows is essential for debugging, extending functionality, and maintaining consistency across the codebase.

All flows assume the app has completed startup (see Flow 10) and that the SQLite database is initialized.

```
┌─────────────────────────────────────────────────────────────────┐
│                     General Data Flow Pattern                    │
│                                                                  │
│  React Component                                                 │
│       │  user action                                             │
│       ▼                                                          │
│  invoke("command", args)  ───────►  Rust Command Handler         │
│                                          │                       │
│                                     Business Logic               │
│                                     (Manager / SQLite)           │
│                                          │                       │
│  listen("event")  ◄─────────────  emit("event", payload)        │
│       │                                                          │
│       ▼                                                          │
│  Zustand Store update ──► Component re-render                    │
└─────────────────────────────────────────────────────────────────┘
```

## Flow 1: User Sends Message to Agent (Direct)

A user types a message in the input bar and sends it to a specific agent that is not the secretary.

```
InputBar              Rust Commands        AgentManager           Claude CLI
  │                        │                    │                     │
  │ invoke("send_message") │                    │                     │
  │  { agent_id, text }    │                    │                     │
  │───────────────────────►│                    │                     │
  │                        │ dispatch(id, text) │                     │
  │                        │───────────────────►│                     │
  │                        │                    │ write to stdin      │
  │                        │                    │────────────────────►│
  │                        │                    │                     │
  │                        │                    │ stdout (NDJSON)     │
  │                        │                    │◄────────────────────│
  │                        │                    │                     │
  │                        │  emit("agent_output", payload)          │
  │◄─────────────────────────────────────────────                    │
  │                        │                    │                     │
  ▼                        │                    │                     │
chatStore.appendMessage()  │                    │                     │
  │                        │                    │                     │
  ▼                        │                    │                     │
ChatView re-render         │                    │                     │
```

### Steps

1. User types text in `InputBar` and presses Enter (or clicks Send).
2. `InputBar` calls `invoke("send_message", { agent_id, text })` via Tauri IPC.
3. Rust command handler `commands::agent::send_message()` receives the deserialized args.
4. Handler retrieves the agent's process handle from `AgentManager` state.
5. Handler writes the message text to the agent's stdin pipe followed by a newline.
6. Handler inserts the user message into `chat_history` in SQLite (role = "user").
7. The agent's stdout read loop (running on a background thread) receives response lines.
8. Each line is parsed as NDJSON. Valid JSON objects are deserialized into typed events: `text`, `tool_use`, `tool_result`, `error`, or `done`.
9. For each parsed event, `emit("agent_output", AgentOutputPayload { agent_id, event_type, content, timestamp })` fires.
10. Frontend listener in `chatStore` receives the event and calls `appendMessage()` to add or update the streaming message.
11. `ChatView` re-renders with the new content and auto-scrolls to the bottom.
12. When a `done` event arrives, `chatStore` marks the message as complete and the full response is persisted to SQLite.

## Flow 2: User Sends Message to Secretary

The secretary is a special orchestration agent that can answer directly or delegate to sub-agents.

```
InputBar            Rust Commands         Secretary Agent         Sub-Agent(s)
  │                      │                      │                     │
  │ invoke("dispatch_    │                      │                     │
  │   to_secretary")     │                      │                     │
  │  { text }            │                      │                     │
  │─────────────────────►│                      │                     │
  │                      │ dispatch(secretary,  │                     │
  │                      │   text)              │                     │
  │                      │─────────────────────►│                     │
  │                      │                      │                     │
  │                      │                      │ evaluate task       │
  │                      │                      │ (can I handle this  │
  │                      │                      │  myself, or         │
  │                      │                      │  delegate?)         │
  │                      │                      │                     │
  │                      │                      │───[if delegate]────►│
  │                      │                      │                     │
  │                      │                      │◄──sub-agent reply───│
  │                      │                      │                     │
  │                      │                      │ aggregate response  │
  │                      │                      │                     │
  │    emit("secretary_response", payload)      │                     │
  │◄────────────────────────────────────────────│                     │
  │                      │                      │                     │
  ▼                      │                      │                     │
chatStore update         │                      │                     │
  │                      │                      │                     │
  ▼                      │                      │                     │
ChatView re-render       │                      │                     │
```

### Steps

1. User types a message in `InputBar` with the secretary selected as the target.
2. `InputBar` calls `invoke("dispatch_to_secretary", { text })`.
3. Rust handler writes the message to the secretary agent's stdin.
4. The secretary evaluates the task against its system prompt and the skill pool registry.
5. If the secretary can handle the request itself, it responds directly (proceeds to step 8).
6. If delegation is needed, the secretary identifies which sub-agent(s) have the matching skills (see Flow 3).
7. The secretary collects sub-agent responses and composes a final aggregated response.
8. `emit("secretary_response", { text, delegated_to, sources })` fires.
9. Frontend listener updates `chatStore` with the secretary's response, including metadata about which agents contributed.
10. `ChatView` re-renders. If delegation occurred, the UI indicates which sub-agents were consulted.

## Flow 3: Secretary Delegates to Sub-Agent

Internal flow triggered when the secretary determines a task requires another agent's skills.

```
Secretary                  AgentManager              Sub-Agent Process
  │                             │                          │
  │ query skill_pool for        │                          │
  │ matching agent              │                          │
  │────────────────────────────►│                          │
  │                             │                          │
  │ matched: agent_id,          │                          │
  │ skill: "code-review"        │                          │
  │◄────────────────────────────│                          │
  │                             │                          │
  │ write task to sub-agent     │                          │
  │ stdin via AgentManager      │                          │
  │────────────────────────────►│                          │
  │                             │ write stdin              │
  │                             │─────────────────────────►│
  │                             │                          │
  │                             │ stdout NDJSON            │
  │                             │◄─────────────────────────│
  │                             │                          │
  │ collect sub-agent response  │                          │
  │◄────────────────────────────│                          │
  │                             │                          │
  │ aggregate into final reply  │                          │
  │                             │                          │
```

### Steps

1. Secretary's response includes a delegation directive (parsed from its NDJSON output or determined by the AgentManager's orchestration logic).
2. `AgentManager` queries the `skill_pool` table in SQLite to find agents with skills matching the task requirements.
3. If multiple agents match, the secretary selects the best fit based on skill specificity and agent availability (status = running).
4. `AgentManager` writes the delegated task (as a structured prompt) to the sub-agent's stdin.
5. The sub-agent processes the task and streams its response via stdout.
6. The background read loop for the sub-agent collects the full response (until a `done` event).
7. The collected response is forwarded back to the secretary's context.
8. The secretary incorporates the sub-agent's output into its own response.
9. If multiple sub-agents were consulted, the secretary aggregates all responses before emitting the final result.
10. The delegation chain is recorded in SQLite for auditability: `chat_history` entries include a `delegated_from` field.

## Flow 4: Telegram Message Arrives

A remote user sends a message via Telegram, which is routed through the secretary.

```
Telegram API        TelegramBot            AgentManager / Secretary
    │                    │                          │
    │  getUpdates()      │                          │
    │  (long poll)       │                          │
    │◄──────────────────►│                          │
    │                    │                          │
    │  Update { msg }    │                          │
    │───────────────────►│                          │
    │                    │ handle_update()           │
    │                    │ extract chat_id, text     │
    │                    │                          │
    │                    │ dispatch("secretary",    │
    │                    │   text)                  │
    │                    │─────────────────────────►│
    │                    │                          │
    │                    │                  (Secretary processes,
    │                    │                   may delegate - see
    │                    │                   Flows 2 & 3)
    │                    │                          │
    │                    │ response text            │
    │                    │◄─────────────────────────│
    │                    │                          │
    │  sendMessage()     │                          │
    │◄───────────────────│                          │
    │                    │                          │
    │                    │ emit("telegram_message", │
    │                    │   { chat_id, text,       │
    │                    │     response })          │
    │                    │─────────────────────────►│
    │                    │                       (to frontend)
    │                    │                          │
```

### Steps

1. `TelegramBot` runs a long-polling loop on a dedicated Tokio task, calling `getUpdates` with a timeout.
2. Telegram API returns one or more `Update` objects containing new messages.
3. `TelegramBot::handle_update()` extracts `chat_id`, `text`, and sender metadata from each update.
4. The bot checks authorization: only allowed Telegram user IDs (configured in settings) can interact.
5. For authorized messages, the bot calls `AgentManager::dispatch("secretary", text)`.
6. The secretary processes the message identically to an in-app message (see Flows 2 and 3).
7. The secretary's final response text is collected.
8. `TelegramBot` calls `sendMessage(chat_id, response)` to reply on Telegram.
9. `emit("telegram_message", { direction: "inbound", chat_id, user_text, bot_response, timestamp })` fires so the in-app UI can display the Telegram conversation.
10. Frontend listener in the relevant store updates the Telegram message log displayed in the UI.
11. Both the inbound message and outbound response are persisted to `chat_history` with `source = "telegram"`.

## Flow 5: User Switches Project

User clicks a different project in the left sidebar.

```
LeftSidebar          Rust Commands       ProjectManager      AgentManager
    │                     │                    │                  │
    │ invoke("switch_     │                    │                  │
    │   project")         │                    │                  │
    │  { project_id }     │                    │                  │
    │────────────────────►│                    │                  │
    │                     │ set_active()       │                  │
    │                     │───────────────────►│                  │
    │                     │                    │                  │
    │                     │                    │ update SQLite    │
    │                     │                    │ (active_project) │
    │                     │                    │                  │
    │                     │ update_cwd(path)   │                  │
    │                     │───────────────────────────────────────►
    │                     │                    │                  │
    │                     │                    │       All agents get
    │                     │                    │       new CWD via
    │                     │                    │       environment
    │                     │                    │                  │
    │                     │ emit("project_changed", { id, path }) │
    │◄────────────────────────────────────────────────────────────│
    │                     │                    │                  │
    ▼                     │                    │                  │
Stores update:            │                    │                  │
  projectStore            │                    │                  │
  agentStore              │                    │                  │
  contextStore            │                    │                  │
    │                     │                    │                  │
    ▼                     │                    │                  │
Full UI re-render         │                    │                  │
```

### Steps

1. User clicks a project entry in `LeftSidebar`.
2. Frontend calls `invoke("switch_project", { project_id })`.
3. Rust handler retrieves project details from SQLite.
4. `ProjectManager::set_active(project_id)` updates the active project in managed state.
5. SQLite `settings` table is updated with the new `active_project_id`.
6. `AgentManager::update_cwd(path)` iterates all running agents and updates their working directory. For running Claude CLI processes, this may require restarting them with the new `--cwd` flag.
7. `emit("project_changed", { project_id, path, name })` fires.
8. Frontend listeners update multiple stores:
   - `projectStore` sets the new active project.
   - `agentStore` refreshes agent list (agents may be project-scoped).
   - `contextStore` re-scans the new project directory for context signals (git status, package.json, Cargo.toml, etc.).
9. The entire UI re-renders: sidebar highlights the new project, chat history loads for the new project context, and agent cards reflect updated CWD.

## Flow 6: User Creates New Agent

User opens the agent creation dialog and fills out the form.

```
AgentCreationDialog     Rust Commands       AgentManager        SQLite
       │                     │                   │                 │
       │ React Hook Form     │                   │                 │
       │ + Zod validate      │                   │                 │
       │                     │                   │                 │
       │ invoke("create_     │                   │                 │
       │   agent")           │                   │                 │
       │  { name, role,      │                   │                 │
       │    skills, model }  │                   │                 │
       │────────────────────►│                   │                 │
       │                     │ create(config)    │                 │
       │                     │──────────────────►│                 │
       │                     │                   │ INSERT agent    │
       │                     │                   │────────────────►│
       │                     │                   │                 │
       │                     │                   │ INSERT skills   │
       │                     │                   │────────────────►│
       │                     │                   │                 │
       │                     │                   │ spawn Claude CLI│
       │                     │                   │ process         │
       │                     │                   │                 │
       │                     │ emit("agent_status_changed",       │
       │                     │   { id, status: "running" })       │
       │◄─────────────────────────────────────────                │
       │                     │                   │                 │
       ▼                     │                   │                 │
  agentStore.addAgent()      │                   │                 │
       │                     │                   │                 │
       ▼                     │                   │                 │
  RightSidebar shows         │                   │                 │
  new agent card              │                   │                 │
```

### Steps

1. User opens `AgentCreationDialog` (from right sidebar or command palette).
2. User fills in agent name, role description, and selects skills from the skill pool.
3. React Hook Form validates the input with a Zod schema (name required, role non-empty, at least one skill selected).
4. On submit, the frontend calls `invoke("create_agent", { name, role, skills, model })`.
5. Rust handler creates a new `AgentConfig` struct with a generated UUID.
6. `AgentManager::create(config)` inserts the agent record into the `agents` table in SQLite.
7. Each assigned skill is inserted into the `agent_skills` junction table.
8. `AgentManager` spawns a new Claude CLI child process:
   ```rust
   Command::new("claude")
       .args(["--output-format", "stream-json", "-p", &system_prompt])
       .current_dir(&project_path)
       .stdin(Stdio::piped())
       .stdout(Stdio::piped())
       .stderr(Stdio::piped())
       .spawn()
   ```
9. A background task is spawned to read the process's stdout line by line.
10. `emit("agent_status_changed", { agent_id, status: "running", name })` fires.
11. Frontend `agentStore` adds the new agent to its list.
12. `RightSidebar` re-renders and displays the new agent card with a "running" status badge and assigned skill badges.

## Flow 7: Agent Output Streaming

Continuous flow of data from a Claude CLI process to the UI during a response.

```
Claude CLI stdout          AgentManager             Frontend
       │                        │                       │
       │ {"type":"text",        │                       │
       │  "content":"Hel"}      │                       │
       │───────────────────────►│                       │
       │                        │ parse NDJSON line     │
       │                        │ emit("agent_output")  │
       │                        │──────────────────────►│
       │                        │                       │ chatStore.
       │                        │                       │ appendMessage()
       │                        │                       │ ChatView
       │ {"type":"text",        │                       │ auto-scroll
       │  "content":"lo "}      │                       │
       │───────────────────────►│                       │
       │                        │ emit("agent_output")  │
       │                        │──────────────────────►│
       │                        │                       │ append text
       │                        │                       │
       │ {"type":"tool_use",    │                       │
       │  "name":"read_file"}   │                       │
       │───────────────────────►│                       │
       │                        │ emit("agent_output")  │
       │                        │──────────────────────►│
       │                        │                       │ render tool
       │                        │                       │ indicator
       │ {"type":"done"}        │                       │
       │───────────────────────►│                       │
       │                        │ emit("agent_output")  │
       │                        │──────────────────────►│
       │                        │                       │ mark complete
       │                        │                       │ persist to DB
```

### Steps

1. After a message is written to the agent's stdin, the Claude CLI begins producing output.
2. The background reader thread reads stdout line by line using `BufReader::read_line()`.
3. Each non-empty line is parsed as JSON. The parser expects NDJSON format (one JSON object per line).
4. Parsed objects are matched against known event types:

| Event Type | Description | UI Behavior |
|------------|-------------|-------------|
| `text` | Partial text content | Append to streaming message bubble |
| `tool_use` | Agent is invoking a tool | Show tool indicator with tool name |
| `tool_result` | Tool returned a result | Show result (collapsed by default) |
| `error` | Agent encountered an error | Show error banner in chat |
| `done` | Response is complete | Mark message complete, enable input |

5. For each parsed event, `emit("agent_output", AgentOutputPayload { agent_id, event_type, content, tool_name, timestamp })` fires.
6. The frontend listener in `chatStore` processes each event:
   - `text`: calls `appendMessage()` which either creates a new assistant message or appends to the current streaming one.
   - `tool_use` / `tool_result`: adds tool activity entries to the message metadata.
   - `error`: sets an error state on the current message.
   - `done`: marks the message as `status: "complete"`.
7. `ChatView` re-renders on each store update. Auto-scroll keeps the latest content visible unless the user has scrolled up.
8. When `done` is received, the full assembled message is persisted to `chat_history` in SQLite.
9. If the stdout pipe closes unexpectedly (without a `done` event), the reader thread emits an `error` event and updates the agent's status.

## Flow 8: User Assigns Skill to Agent

User modifies an existing agent's skill set from the right sidebar.

```
RightSidebar          SkillPicker        Rust Commands         SQLite
     │                     │                  │                   │
     │ click edit on       │                  │                   │
     │ agent card          │                  │                   │
     │────────────────────►│                  │                   │
     │                     │                  │                   │
     │                     │ user selects     │                   │
     │                     │ new skill        │                   │
     │                     │                  │                   │
     │                     │ invoke("assign_  │                   │
     │                     │   skill")        │                   │
     │                     │  { agent_id,     │                   │
     │                     │    skill_id }    │                   │
     │                     │─────────────────►│                   │
     │                     │                  │ INSERT INTO       │
     │                     │                  │ agent_skills      │
     │                     │                  │──────────────────►│
     │                     │                  │                   │
     │                     │                  │ emit("agent_      │
     │                     │                  │   status_changed")│
     │◄───────────────────────────────────────│                   │
     │                     │                  │                   │
     ▼                     │                  │                   │
agentStore.updateAgent()   │                  │                   │
     │                     │                  │                   │
     ▼                     │                  │                   │
Agent card re-renders      │                  │                   │
with new skill badge       │                  │                   │
```

### Steps

1. User clicks the edit button on an agent card in `RightSidebar`.
2. A `SkillPicker` dropdown or modal opens, showing all available skills from the global skill pool.
3. Skills already assigned to the agent are shown as selected/checked.
4. User toggles a skill on (assign) or off (unassign).
5. On confirm, the frontend calls `invoke("assign_skill", { agent_id, skill_id })` (or `invoke("unassign_skill", ...)` for removal).
6. Rust handler validates that both the agent and skill exist in SQLite.
7. For assignment: `INSERT INTO agent_skills (agent_id, skill_id) VALUES (?, ?)`.
8. For removal: `DELETE FROM agent_skills WHERE agent_id = ? AND skill_id = ?`.
9. The agent's system prompt may be regenerated to include the new skill descriptions.
10. `emit("agent_status_changed", { agent_id, skills: [...updated list] })` fires.
11. Frontend `agentStore` updates the agent's skill list.
12. The agent card in `RightSidebar` re-renders, displaying the updated skill badges.

## Flow 9: Terminal Panel I/O

User interacts with the embedded terminal, which runs a system shell via PTY.

```
InputBar               Rust Commands         PTY Layer            System Shell
(terminal mode)              │                   │                     │
     │                       │                   │                     │
     │ invoke("write_to_    │                   │                     │
     │   terminal")          │                   │                     │
     │  { session_id, data } │                   │                     │
     │──────────────────────►│                   │                     │
     │                       │ pty_write(data)   │                     │
     │                       │──────────────────►│                     │
     │                       │                   │ write to master fd  │
     │                       │                   │────────────────────►│
     │                       │                   │                     │
     │                       │                   │ shell output        │
     │                       │                   │◄────────────────────│
     │                       │                   │                     │
     │                       │ emit("terminal_   │                     │
     │                       │   output")        │                     │
     │◄──────────────────────│                   │                     │
     │                       │                   │                     │
     ▼                       │                   │                     │
terminalStore.append()       │                   │                     │
     │                       │                   │                     │
     ▼                       │                   │                     │
TerminalPanel re-render      │                   │                     │
```

### Steps

1. The terminal panel operates in a different input mode from the chat input. When the terminal tab is active, keystrokes are captured and sent to the PTY.
2. Each keystroke or paste event calls `invoke("write_to_terminal", { session_id, data })` where `data` is the raw byte sequence (including escape codes for special keys).
3. Rust handler looks up the PTY session by `session_id` in managed state.
4. The handler writes the raw bytes to the PTY master file descriptor:
   - On Windows: ConPTY `WritePseudoConsole` API.
   - On Unix/macOS: standard PTY master fd write.
5. The system shell (bash, zsh, PowerShell, etc.) processes the input and produces output.
6. A background read loop continuously reads from the PTY master fd.
7. Raw output bytes (including ANSI escape sequences for colors, cursor movement, etc.) are buffered.
8. `emit("terminal_output", { session_id, data: base64_encoded_bytes })` fires with the raw output.
9. Frontend listener passes the data to `terminalStore`, which feeds it to the terminal emulator (xterm.js or equivalent).
10. `TerminalPanel` re-renders with the updated terminal state.
11. Terminal resize events follow a similar path: `invoke("resize_terminal", { session_id, cols, rows })` updates the PTY window size.

## Flow 10: App Startup

The complete initialization sequence from process launch to rendered UI.

```
main.rs                    Tauri Setup              Frontend Mount
   │                           │                         │
   │ tauri::Builder::default() │                         │
   │──────────────────────────►│                         │
   │                           │                         │
   │                     init SQLite                     │
   │                     (run migrations)                │
   │                           │                         │
   │                     load settings                   │
   │                     from DB                         │
   │                           │                         │
   │                     register managed                │
   │                     state:                          │
   │                      - AgentManager                 │
   │                      - ProjectManager               │
   │                      - TelegramBot                  │
   │                      - Database                     │
   │                           │                         │
   │                     start Telegram bot              │
   │                     (if token configured)            │
   │                           │                         │
   │                     register all                    │
   │                     command handlers                │
   │                           │                         │
   │                     launch WebView                  │
   │                           │────────────────────────►│
   │                           │                         │
   │                           │    invoke("list_agents")│
   │                           │◄────────────────────────│
   │                           │    invoke("list_        │
   │                           │      projects")         │
   │                           │◄────────────────────────│
   │                           │    invoke("get_         │
   │                           │      settings")         │
   │                           │◄────────────────────────│
   │                           │                         │
   │                           │    responses             │
   │                           │────────────────────────►│
   │                           │                         │
   │                           │               populate stores
   │                           │               render UI
```

### Steps

1. `main.rs` calls `tauri::Builder::default()` to begin app construction.
2. The `setup` closure runs:
   - a. Resolves the app data directory (`tauri::api::path::app_data_dir`).
   - b. Opens or creates the SQLite database file at `{app_data}/zentral.db`.
   - c. Runs pending migrations to ensure the schema is up to date.
   - d. Loads settings from the `settings` table (Telegram token, active project, theme, etc.).
3. Managed state is initialized and registered:
   ```rust
   app.manage(DatabaseState::new(db_pool));
   app.manage(AgentManagerState::default());
   app.manage(ProjectManagerState::default());
   app.manage(TelegramBotState::default());
   ```
4. If a Telegram bot token exists in settings, the Telegram long-polling loop is spawned on a background Tokio task.
5. All Tauri command handlers are registered via `.invoke_handler(tauri::generate_handler![...])`.
6. Tauri launches the WebView and loads the React frontend.
7. React's `App.tsx` mounts and the `useEffect` initialization hook fires.
8. The frontend issues parallel initialization calls:
   - `invoke("list_agents")` -- returns all agents with their status and skills.
   - `invoke("list_projects")` -- returns all registered projects.
   - `invoke("get_settings")` -- returns app configuration (theme, Telegram status, etc.).
9. Responses populate Zustand stores: `agentStore`, `projectStore`, `settingsStore`.
10. Event listeners are registered for all async events: `agent_output`, `agent_status_changed`, `project_changed`, `telegram_message`, `terminal_output`.
11. The UI renders: left sidebar shows projects, right sidebar shows agents, center shows chat or terminal.
12. If agents were previously running, `AgentManager` may optionally respawn them based on persisted state.

## Flow 11: User Stops or Restarts Agent

User clicks stop or restart on an agent card.

### Stop Flow

```
RightSidebar         Rust Commands        AgentManager         OS Process
     │                    │                    │                    │
     │ invoke("stop_      │                    │                    │
     │   agent")          │                    │                    │
     │  { agent_id }      │                    │                    │
     │───────────────────►│                    │                    │
     │                    │ stop(agent_id)     │                    │
     │                    │───────────────────►│                    │
     │                    │                    │ kill(pid)          │
     │                    │                    │───────────────────►│
     │                    │                    │                    │ X
     │                    │                    │ update status      │
     │                    │                    │ in SQLite          │
     │                    │                    │                    │
     │                    │ emit("agent_status_changed",           │
     │                    │   { id, status: "stopped" })           │
     │◄───────────────────────────────────────│                    │
     │                    │                    │                    │
     ▼                    │                    │                    │
agentStore update         │                    │                    │
status badge → "stopped"  │                    │                    │
```

### Restart Flow

```
RightSidebar         Rust Commands        AgentManager
     │                    │                    │
     │ invoke("restart_   │                    │
     │   agent")          │                    │
     │  { agent_id }      │                    │
     │───────────────────►│                    │
     │                    │ stop(agent_id)     │
     │                    │───────────────────►│
     │                    │                    │ kill old process
     │                    │                    │
     │                    │ spawn(agent_id)    │
     │                    │───────────────────►│
     │                    │                    │ new Claude CLI
     │                    │                    │ process started
     │                    │                    │
     │                    │ emit("agent_status_changed",
     │                    │   { id, status: "running" })
     │◄───────────────────────────────────────│
     │                    │                    │
     ▼                    │                    │
agentStore update         │                    │
status badge → "running"  │                    │
```

### Steps (Stop)

1. User clicks the stop button on an agent card in `RightSidebar`.
2. Frontend calls `invoke("stop_agent", { agent_id })`.
3. Rust handler retrieves the agent's process handle from `AgentManager`.
4. `AgentManager::stop(agent_id)` sends SIGTERM (Unix) or `TerminateProcess` (Windows) to the child process.
5. The handler waits briefly for graceful shutdown, then sends SIGKILL if the process has not exited.
6. The stdout reader thread detects the closed pipe and terminates.
7. Agent status is updated to `"stopped"` in the `agents` table in SQLite.
8. `emit("agent_status_changed", { agent_id, status: "stopped" })` fires.
9. Frontend `agentStore` updates the agent's status. The agent card shows a "stopped" badge and the stop button changes to a start/restart button.

### Steps (Restart)

1. User clicks the restart button on an agent card.
2. Frontend calls `invoke("restart_agent", { agent_id })`.
3. Rust handler executes a stop (steps 3-7 above) followed by a spawn.
4. `AgentManager` reads the agent's configuration from SQLite (name, role, skills, system prompt).
5. A new Claude CLI process is spawned with the same configuration and current project CWD.
6. A new stdout reader thread is started.
7. Agent status is updated to `"running"` in SQLite.
8. `emit("agent_status_changed", { agent_id, status: "running" })` fires.
9. Frontend updates accordingly.

## Flow 12: User Aborts Agent Response

User cancels a response that is currently streaming.

```
ChatView             Rust Commands        AgentManager         Claude CLI
   │                      │                    │                    │
   │ (streaming in        │                    │                    │
   │  progress...)        │                    │                    │
   │                      │                    │                    │
   │ click cancel         │                    │                    │
   │                      │                    │                    │
   │ invoke("stop_agent") │                    │                    │
   │  { agent_id }        │                    │                    │
   │─────────────────────►│                    │                    │
   │                      │ stop(agent_id)     │                    │
   │                      │───────────────────►│                    │
   │                      │                    │ kill(pid)          │
   │                      │                    │───────────────────►│
   │                      │                    │                    │ X
   │                      │                    │                    │
   │                      │ emit("agent_output",                   │
   │                      │   { type: "aborted" })                 │
   │◄─────────────────────────────────────────│                    │
   │                      │                    │                    │
   ▼                      │                    │                    │
chatStore.markAborted()   │                    │                    │
   │                      │                    │                    │
   ▼                      │                    │                    │
ChatView shows            │                    │                    │
"cancelled" indicator     │                    │                    │
   │                      │                    │                    │
   │                      │ (optionally respawn│                    │
   │                      │  agent process)    │                    │
   │                      │                    │                    │
   │                      │ emit("agent_status_changed",           │
   │                      │   { id, status: "running" })           │
   │◄─────────────────────────────────────────│                    │
```

### Steps

1. While an agent response is streaming (text events arriving in `chatStore`), the user clicks the cancel/abort button in `ChatView`.
2. Frontend calls `invoke("stop_agent", { agent_id })`.
3. Rust handler kills the Claude CLI child process (same mechanism as Flow 11 stop).
4. The stdout reader thread detects the broken pipe.
5. Before cleaning up, `AgentManager` emits `emit("agent_output", { agent_id, event_type: "aborted", timestamp })`.
6. Frontend `chatStore` receives the `aborted` event:
   - The current streaming message is marked with `status: "aborted"`.
   - Any partial text already received is preserved (not discarded).
   - The message is persisted to SQLite with the aborted status.
7. `ChatView` re-renders: the message bubble shows a "cancelled" indicator (e.g., a strikethrough footer or muted styling).
8. The input bar is re-enabled so the user can send new messages.
9. `AgentManager` automatically respawns the agent process so it is ready for the next interaction. This spawn uses the same configuration but starts a fresh Claude CLI session.
10. `emit("agent_status_changed", { agent_id, status: "running" })` fires once the new process is ready.
11. The user can immediately send a new message to the agent without manual restart.

## Cross-Flow Summary Table

| Flow | Trigger | IPC Command | Emitted Events | Stores Updated |
|------|---------|-------------|-----------------|----------------|
| 1. Direct message | InputBar submit | `send_message` | `agent_output` | chatStore |
| 2. Secretary message | InputBar submit | `dispatch_to_secretary` | `secretary_response` | chatStore |
| 3. Delegation | Secretary logic | (internal) | `agent_output` | chatStore |
| 4. Telegram inbound | Telegram API poll | (internal) | `telegram_message` | chatStore |
| 5. Switch project | LeftSidebar click | `switch_project` | `project_changed` | projectStore, agentStore, contextStore |
| 6. Create agent | AgentCreationDialog | `create_agent` | `agent_status_changed` | agentStore |
| 7. Streaming output | Agent stdout | (continuous) | `agent_output` | chatStore |
| 8. Assign skill | RightSidebar edit | `assign_skill` | `agent_status_changed` | agentStore |
| 9. Terminal I/O | InputBar (term mode) | `write_to_terminal` | `terminal_output` | terminalStore |
| 10. App startup | Process launch | `list_agents`, `list_projects`, `get_settings` | (none) | all stores |
| 11. Stop/restart agent | RightSidebar button | `stop_agent` / `restart_agent` | `agent_status_changed` | agentStore |
| 12. Abort response | ChatView cancel | `stop_agent` | `agent_output` (aborted), `agent_status_changed` | chatStore, agentStore |

## References

- [System Architecture](./system-architecture.md)
- [Tauri Bridge](../02-specifications/tauri-bridge.md)
- [Agent Adapters](../02-specifications/agent-adapters.md)
- [Session Management](../02-specifications/session-management.md)
- [PTY Handling](../02-specifications/pty-handling.md)
- [Terminal Emulator](../02-specifications/terminal-emulator.md)
