# System Architecture

> Tauri v2 desktop application bundling a React frontend and Rust backend into a single binary, with IPC-based communication replacing HTTP endpoints.

> **Status:** draft
> **Last updated:** 2026-03-24

---

## Overview

Zentral is a desktop application built with Tauri v2 that bundles a React frontend and Rust backend into a single binary. Unlike Agentrooms (which requires separate frontend + backend processes), Zentral runs everything in one process — Tauri's Rust core handles all backend logic, IPC commands replace HTTP endpoints, and the React UI communicates via Tauri's invoke system.

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Zentral Desktop App                       │
│                          (Tauri v2 Bundle)                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │              React Frontend (WebView)                   │     │
│  │                                                         │     │
│  │  ┌──────────┐  ┌──────────────┐  ┌────────────────┐    │     │
│  │  │ Zustand   │  │ Components   │  │ Tauri invoke() │    │     │
│  │  │ Stores    │  │ (UI Layer)   │  │ (IPC Bridge)   │    │     │
│  │  └──────────┘  └──────────────┘  └───────┬────────┘    │     │
│  └──────────────────────────────────────────┼──────────────┘     │
│                                              │                    │
│                              Tauri IPC (JSON serialization)      │
│                                              │                    │
│  ┌──────────────────────────────────────────┼──────────────┐     │
│  │              Rust Core (Backend)          │              │     │
│  │                                           ▼              │     │
│  │  ┌────────────────────────────────────────────────┐     │     │
│  │  │              Command Handlers                  │     │     │
│  │  │  (agent, session, project, config, telegram)   │     │     │
│  │  └──────┬─────────┬──────────┬───────────┬───────┘     │     │
│  │         │         │          │           │              │     │
│  │  ┌──────▼───┐ ┌───▼────┐ ┌──▼─────┐ ┌──▼──────────┐  │     │
│  │  │ Agent    │ │ PTY    │ │Project │ │ Telegram    │  │     │
│  │  │ Manager  │ │ Layer  │ │Manager │ │ Bot         │  │     │
│  │  ├──────────┤ ├────────┤ ├────────┤ ├─────────────┤  │     │
│  │  │Secretary │ │Unix PTY│ │Workspace│ │Long Polling │  │     │
│  │  │Skill Pool│ │ConPTY  │ │Switching│ │Msg Queue    │  │     │
│  │  │Spawner   │ │        │ │        │ │             │  │     │
│  │  └──────────┘ └────────┘ └────────┘ └─────────────┘  │     │
│  │                                                       │     │
│  │  ┌────────────────────────────────────────────────┐   │     │
│  │  │              Persistence (SQLite)               │   │     │
│  │  │  agents | skills | projects | chat_history      │   │     │
│  │  └────────────────────────────────────────────────┘   │     │
│  └───────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────┘
                              │
                    Telegram Bot API
                    (Long Polling)
                              │
                              ▼
                    ┌──────────────────┐
                    │  Telegram User   │
                    │  (Remote Access) │
                    └──────────────────┘
```

## Why Tauri v2 Instead of Electron

| Aspect | Electron (Agentrooms) | Tauri v2 (Zentral) |
|--------|----------------------|-------------------|
| Bundle size | ~150MB+ | ~10-20MB |
| RAM usage | ~200-400MB | ~30-80MB |
| Backend | Separate Hono/Deno server | Built into Rust core |
| IPC | HTTP localhost + Electron IPC | Tauri invoke (direct) |
| Processes | 3+ (main, renderer, backend) | 1 (+ spawned agents) |
| Native API | Node.js bindings | Direct Rust FFI |

## Communication Patterns

### Frontend → Rust (Commands)

Frontend invokes Rust functions directly via Tauri's command system. No HTTP server needed.

```
Frontend: invoke("create_agent", { name, role, skills })
    ↓
Tauri IPC: serialize JSON → Rust handler
    ↓
Rust: commands::agent::create_agent()
    ↓
Return: AgentInfo { id, name, role, status }
```

### Rust → Frontend (Events)

Rust emits events that frontend listens to. Used for streaming agent output, status changes, Telegram messages.

```
Rust: app.emit("agent_output", AgentOutputPayload { ... })
    ↓
Frontend: listen("agent_output", callback)
```

### Agent Process Communication

Each agent is a Claude CLI child process managed by the Agent Manager.

```
Agent Manager
  ├─ spawn("claude", ["--resume", session_id, "-p", prompt])
  ├─ stdin: write user messages
  ├─ stdout: stream agent responses → parse → emit events
  ├─ stderr: capture errors
  └─ lifecycle: start, pause, stop, restart
```

## Managed State

Tauri manages shared state across all commands:

```rust
// In lib.rs setup
app.manage(AgentManagerState::default())    // All agents + secretary
app.manage(ProjectManagerState::default())  // Project list + active project
app.manage(TelegramBotState::default())     // Bot connection + message queue
app.manage(DatabaseState::new(db_path))     // SQLite connection pool
```

## Data Flow Summary

### User sends message in-app
```
ChatInput → invoke("send_message", { agent_id, message })
  → AgentManager.dispatch(agent_id, message)
    → If secretary: secretary evaluates, may delegate
    → If direct agent: write to agent's stdin
  → Agent stdout → parse → emit("agent_output", ...)
  → Frontend listener → update chat store → re-render
```

### User sends message via Telegram
```
Telegram API → Long polling loop receives Update
  → TelegramBot.handle_message(text)
    → AgentManager.dispatch("secretary", text)
      → Secretary processes, may delegate to other agents
    → Collect response
  → TelegramBot.send_reply(chat_id, response)
  → Also emit("telegram_message", ...) for in-app display
```

### User switches project
```
LeftSidebar click → invoke("switch_project", { path })
  → ProjectManager.set_active(path)
  → AgentManager.update_cwd(path)  // All agents get new CWD
  → ProjectManager.detect_context(path)  // Detect project type
  → emit("project_changed", ...)
  → Frontend updates sidebar + context
```

## Module Dependency Graph

```
lib.rs (entry point)
  ├── commands/        ← Tauri command handlers (thin layer)
  │   ├── agent.rs     → agent::manager, agent::secretary
  │   ├── project.rs   → project::workspace
  │   ├── telegram.rs  → telegram::bot
  │   ├── session.rs   → session (terminal PTY sessions)
  │   └── config.rs    → config, persistence
  │
  ├── agent/
  │   ├── manager.rs   → spawner, skill_pool, types
  │   ├── secretary.rs → manager (delegates to other agents)
  │   ├── spawner.rs   → process::pty (spawns Claude CLI)
  │   ├── skill_pool.rs→ types
  │   └── types.rs     (AgentConfig, AgentStatus, Skill, etc.)
  │
  ├── telegram/
  │   └── bot.rs       → agent::manager (forwards messages)
  │
  ├── project/
  │   └── workspace.rs → persistence (project list)
  │
  ├── process/
  │   └── pty.rs       → platform-specific PTY
  │
  ├── config/
  │   └── mod.rs       → persistence
  │
  └── persistence.rs   → SQLite (all data storage)
```

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| All-in-one Tauri bundle | No separate backend process, simpler deployment, lower resource usage |
| SQLite over JSONL | Structured queries for agents/skills/history, unlike Agentrooms' flat files |
| Long polling over webhook | No need for external server or port exposure for Telegram |
| Secretary as special agent | Single orchestration point, cleaner than Agentrooms' mention-based routing |
| Project-centric CWD | All agents share CWD from active project, simpler than per-agent paths |
| Crossbeam channels for events | High-throughput internal messaging between threads |
| Tauri IPC over HTTP | Lower latency, no port conflicts, built-in security |
