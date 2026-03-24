# Rust Core Architecture

> The Rust backend of Zentral provides agent lifecycle management, PTY handling, Telegram integration, and SQLite persistence -- all wired together through Tauri v2 managed state and async concurrency primitives.

> **Status:** draft
> **Last updated:** 2026-03-24

---

## Overview

Zentral is a Tauri v2 desktop application where the Rust core acts as the single backend process bundled inside the app. There is no separate server; the frontend communicates with Rust exclusively through Tauri IPC commands and events. The core is responsible for:

- Spawning and managing multiple Claude CLI agent child processes.
- Orchestrating agents through a Secretary agent that dispatches tasks.
- Maintaining a skill pool that defines what each agent can do.
- Running a Telegram bot via long polling for remote interaction.
- Persisting all state to a local SQLite database.
- Providing PTY sessions for interactive terminal access.

## Module Tree

```
src-tauri/src/
├── main.rs                  # Entry point, calls lib::run()
├── lib.rs                   # Tauri app builder, plugin registration, managed state setup
├── persistence.rs           # SQLite connection pool, migrations, queries
│
├── agent/
│   ├── mod.rs               # Re-exports, AgentEvent enum
│   ├── manager.rs           # AgentManager: CRUD, lifecycle, message routing
│   ├── secretary.rs         # SecretaryAgent: task dispatch, orchestration logic
│   ├── spawner.rs           # Child process spawning, stdio piping
│   ├── skill_pool.rs        # SkillPool: skill registry, assignment to agents
│   └── types.rs             # AgentConfig, AgentStatus, Skill, Message structs
│
├── telegram/
│   └── bot.rs               # TelegramBot: long-polling loop, message handlers
│
├── project/
│   └── workspace.rs         # Project registry, active project switching, paths
│
├── process/
│   └── pty.rs               # Platform PTY: nix on Unix, ConPTY on Windows
│
├── config/
│   └── mod.rs               # AppSettings, theme list, serialization to/from TOML
│
└── commands/
    ├── mod.rs               # Re-exports all command modules
    ├── agent.rs             # #[tauri::command] handlers for agent operations
    ├── session.rs           # Terminal/PTY session commands
    ├── project.rs           # Project management commands
    ├── telegram.rs          # Telegram bot control commands
    └── config.rs            # Settings and theme commands
```

### Module Responsibilities

| Module | Purpose |
|---|---|
| `agent/manager.rs` | Owns the `HashMap<AgentId, AgentHandle>`. Creates, stops, restarts agents. Routes messages to the correct child process stdin. |
| `agent/secretary.rs` | A special agent instance that receives high-level tasks and decomposes them into sub-tasks dispatched to worker agents. |
| `agent/spawner.rs` | Wraps `std::process::Command` to launch `claude` CLI processes with the correct environment, working directory, and stdio pipes. |
| `agent/skill_pool.rs` | Maintains a registry of skills (name, description, prompt template). Agents are assigned a subset of skills that constrain their behavior. |
| `telegram/bot.rs` | Runs a long-polling loop against the Telegram Bot API using `reqwest`. Converts incoming messages to internal commands and relays agent output back as Telegram replies. |
| `project/workspace.rs` | Tracks registered project directories. The active project determines the working directory for newly spawned agents. |
| `process/pty.rs` | Allocates a pseudo-terminal, spawns a shell inside it, and exposes read/write/resize operations. Platform-specific behind `#[cfg]` gates. |
| `persistence.rs` | Opens a SQLite database via `rusqlite`, runs migrations on startup, and provides typed query functions for agents, projects, skills, and settings. |
| `config/mod.rs` | Loads and saves `AppSettings` from a TOML file. Enumerates available theme files from the `themes/` directory. |
| `commands/*` | Thin `#[tauri::command]` functions that extract managed state, call into domain modules, and return serializable results or errors. |

## Thread Model

Zentral uses a hybrid concurrency model: Tokio async tasks for I/O-bound work, and dedicated OS threads for blocking or latency-sensitive loops.

```
+------------------------------------------------------+
|  Main Thread (Tauri/WebView event loop)              |
|  - Handles IPC command dispatch                      |
|  - Emits events to frontend                          |
+------------------------------------------------------+
        |
        v
+------------------------------------------------------+
|  Tokio Runtime (multi-threaded, started by Tauri)    |
|                                                      |
|  +-----------------------+  +---------------------+  |
|  | Agent stdout readers  |  | Secretary dispatch  |  |
|  | (one task per agent)  |  | loop (async task)   |  |
|  +-----------------------+  +---------------------+  |
|                                                      |
|  +-----------------------+  +---------------------+  |
|  | Telegram long-poll    |  | SQLite write queue  |  |
|  | loop (async task)     |  | (async task)        |  |
|  +-----------------------+  +---------------------+  |
+------------------------------------------------------+
        |
        v
+------------------------------------------------------+
|  Dedicated OS Threads                                |
|                                                      |
|  +-------------------------+                         |
|  | PTY read loops          |  One thread per open   |
|  | (std::thread::spawn)    |  terminal session.     |
|  +-------------------------+  Reads are blocking     |
|  |                         |  syscalls (read(2) /   |
|  | PTY write is done from  |  ReadFile on Windows). |
|  | Tokio via spawn_blocking|                        |
|  +-------------------------+                         |
+------------------------------------------------------+
```

### Why Dedicated Threads for PTY

PTY read operations are blocking system calls (`read(2)` on Unix, `ReadFile` on Windows via ConPTY). Running these inside a Tokio task would block the executor. Instead, each terminal session spawns a dedicated OS thread that reads in a tight loop and sends chunks over a `crossbeam_channel::Sender` to be picked up by an async task that emits `terminal_output` events to the frontend.

### Async Tasks Breakdown

| Task | Spawned When | Lifetime |
|---|---|---|
| Agent stdout reader | `create_agent` | Until agent process exits |
| Agent stderr reader | `create_agent` | Until agent process exits |
| Secretary dispatch loop | App startup | Entire app lifetime |
| Telegram polling loop | `start_telegram_bot` | Until `stop_telegram_bot` called |
| PTY-to-event bridge | `create_terminal_session` | Until terminal session destroyed |

## Managed State Pattern

Tauri v2 provides a dependency-injection mechanism via `app.manage()`. Zentral registers shared state structs at startup, and commands access them through function parameters.

### State Registration in lib.rs

```rust
use std::sync::Arc;
use parking_lot::Mutex;
use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let db = persistence::Database::open(app.path().app_data_dir()?)?;
            db.run_migrations()?;

            let agent_manager = AgentManager::new(db.clone());
            let skill_pool = SkillPool::load_from_db(&db)?;
            let secretary = SecretaryAgent::new(agent_manager.clone(), skill_pool.clone());
            let telegram_bot = TelegramBot::new();
            let project_manager = ProjectManager::load_from_db(&db)?;
            let settings = AppSettings::load_or_default(&db)?;

            app.manage(Arc::new(Mutex::new(agent_manager)));
            app.manage(Arc::new(Mutex::new(skill_pool)));
            app.manage(Arc::new(Mutex::new(secretary)));
            app.manage(Arc::new(Mutex::new(telegram_bot)));
            app.manage(Arc::new(Mutex::new(project_manager)));
            app.manage(Arc::new(Mutex::new(settings)));
            app.manage(Arc::new(db));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::agent::create_agent,
            commands::agent::delete_agent,
            commands::agent::list_agents,
            // ... all other commands
        ])
        .run(tauri::generate_context!())
        .expect("error while running Zentral");
}
```

### Accessing State in Commands

```rust
use std::sync::Arc;
use parking_lot::Mutex;
use tauri::State;

#[tauri::command]
async fn list_agents(
    manager: State<'_, Arc<Mutex<AgentManager>>>,
) -> Result<Vec<AgentInfo>, CommandError> {
    let mgr = manager.lock();
    Ok(mgr.list())
}
```

The `State<'_, Arc<Mutex<T>>>` extractor retrieves the managed instance by type. `parking_lot::Mutex` is used instead of `std::sync::Mutex` because it is faster under low contention, does not poison on panic, and its `MutexGuard` is `Send` -- which matters when holding a lock across `.await` points in limited scenarios.

### State Access Diagram

```
Frontend (React)
    |
    | invoke("create_agent", { name, skills })
    v
Tauri IPC Router
    |
    | deserialize args, resolve State<T> extractors
    v
commands::agent::create_agent(
    manager: State<Arc<Mutex<AgentManager>>>,
    pool: State<Arc<Mutex<SkillPool>>>,
    app: AppHandle,
)
    |
    | manager.lock() -> &mut AgentManager
    | pool.lock() -> &SkillPool
    v
AgentManager::create(...)  -->  spawner::spawn_claude_process(...)
    |                                  |
    | stores handle in HashMap         | returns ChildProcess with stdio
    v                                  v
    Ok(AgentInfo { id, name, status })
```

## Error Handling

Zentral uses a two-tier error strategy:

1. **Library errors** (`thiserror`) -- Typed, specific enums for each domain module.
2. **Application errors** (`anyhow`) -- Used at the top level and in setup code where granular types add no value.
3. **Command errors** -- A wrapper that implements `serde::Serialize` so Tauri can send errors to the frontend as JSON.

### Error Type Hierarchy

```rust
// agent/types.rs -- domain-specific errors
#[derive(Debug, thiserror::Error)]
pub enum AgentError {
    #[error("agent not found: {0}")]
    NotFound(String),

    #[error("agent already running: {0}")]
    AlreadyRunning(String),

    #[error("failed to spawn process: {0}")]
    SpawnFailed(#[from] std::io::Error),

    #[error("skill not found: {0}")]
    SkillNotFound(String),
}

// persistence.rs
#[derive(Debug, thiserror::Error)]
pub enum DbError {
    #[error("database error: {0}")]
    Sqlite(#[from] rusqlite::Error),

    #[error("migration failed: {0}")]
    Migration(String),
}

// commands/mod.rs -- serializable command error
#[derive(Debug, thiserror::Error)]
pub enum CommandError {
    #[error("{0}")]
    Agent(#[from] AgentError),

    #[error("{0}")]
    Db(#[from] DbError),

    #[error("{0}")]
    Telegram(#[from] TelegramError),

    #[error("{0}")]
    Other(#[from] anyhow::Error),
}

impl serde::Serialize for CommandError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}
```

### Error Propagation Flow

```
Rust domain module          Command handler           Frontend
+------------------+     +-------------------+     +-----------------+
| AgentError       | --> | CommandError      | --> | JSON string     |
| DbError          |     | (impl Serialize)  |     | in reject()     |
| TelegramError    |     |                   |     | promise          |
+------------------+     +-------------------+     +-----------------+
   thiserror enums          #[from] converts         catch(e => ...)
                            to CommandError
```

Every `#[tauri::command]` function returns `Result<T, CommandError>` where `T: Serialize`. Tauri serializes the `Ok` variant as JSON for the resolved promise and the `Err` variant (via the `Serialize` impl on `CommandError`) as a string for the rejected promise.

## Concurrency

### Internal Event Bus

Zentral uses `crossbeam_channel` for synchronous, multi-producer-multi-consumer communication between threads and tasks. This is preferred over Tokio channels for the PTY read threads because those threads are not running inside the Tokio runtime.

```rust
use crossbeam_channel::{bounded, Sender, Receiver};

pub enum InternalEvent {
    AgentOutput { agent_id: String, data: Vec<u8> },
    AgentExited { agent_id: String, code: Option<i32> },
    TerminalOutput { session_id: String, data: Vec<u8> },
    TerminalExited { session_id: String },
    TelegramIncoming { chat_id: i64, text: String },
}

// Created at startup, cloned into producers
let (event_tx, event_rx): (Sender<InternalEvent>, Receiver<InternalEvent>) = bounded(256);
```

An async bridge task runs on Tokio, receiving from the crossbeam channel and emitting Tauri events:

```rust
async fn event_bridge(rx: Receiver<InternalEvent>, app: AppHandle) {
    loop {
        match tokio::task::spawn_blocking({
            let rx = rx.clone();
            move || rx.recv()
        }).await {
            Ok(Ok(event)) => match event {
                InternalEvent::AgentOutput { agent_id, data } => {
                    app.emit("agent_output", AgentOutputPayload { agent_id, data }).ok();
                }
                InternalEvent::AgentExited { agent_id, code } => {
                    app.emit("agent_status_changed", StatusPayload {
                        agent_id, status: "exited".into(), exit_code: code,
                    }).ok();
                }
                // ... other variants
            },
            _ => break,
        }
    }
}
```

### Tokio Usage

All network I/O (Telegram HTTP requests via `reqwest`) and agent process I/O (reading stdout/stderr) runs on the Tokio runtime that Tauri starts automatically. Commands marked `async` are dispatched onto this runtime.

```
+-------------------------------------------------+
|  crossbeam_channel (bounded, 256)               |
|                                                 |
|  Producers:              Consumer:              |
|  - PTY read threads      - event_bridge task    |
|  - Agent stdout readers    (Tokio spawn)        |
|  - Telegram poll task                           |
+-------------------------------------------------+
          |
          v
+-------------------------------------------------+
|  Tauri app.emit(...)                            |
|  -> serialized JSON to WebView                  |
+-------------------------------------------------+
```

## Key Crate Dependencies

| Crate | Version | Role |
|---|---|---|
| `tauri` | 2.x | Application framework, IPC, window management, bundling |
| `tokio` | 1.x | Async runtime for network I/O, agent process I/O, timers |
| `rusqlite` | 0.31+ | SQLite database access with bundled SQLite |
| `serde` | 1.x | Serialization/deserialization for IPC payloads, config files |
| `serde_json` | 1.x | JSON serialization for Tauri command returns and events |
| `crossbeam-channel` | 0.5 | Multi-producer channel for PTY threads and internal event bus |
| `reqwest` | 0.12+ | HTTP client for Telegram Bot API (async, with rustls) |
| `thiserror` | 2.x | Derive macro for typed error enums in domain modules |
| `anyhow` | 1.x | Flexible error type for app-level setup and one-off errors |
| `nix` | 0.29+ | Unix PTY allocation (`openpty`), signal handling, `ioctl` for resize |
| `windows` | 0.58+ | Windows ConPTY API bindings (`CreatePseudoConsole`, `ResizePseudoConsole`) |
| `compact_str` | 0.8+ | Stack-allocated short strings, used for agent IDs and skill names to reduce heap allocations |
| `parking_lot` | 0.12 | Faster `Mutex` and `RwLock` replacements, non-poisoning, used for all managed state |
| `toml` | 0.8+ | Parsing and writing TOML config and theme files |
| `uuid` | 1.x | Generating unique IDs for agents, sessions, and skills |
| `chrono` | 0.4 | Timestamps for messages, session logs, and persistence |

### Platform-Specific Dependencies

```toml
# Cargo.toml

[target.'cfg(unix)'.dependencies]
nix = { version = "0.29", features = ["term", "pty", "signal"] }

[target.'cfg(windows)'.dependencies]
windows = { version = "0.58", features = [
    "Win32_System_Console",
    "Win32_Foundation",
    "Win32_Security",
    "Win32_System_Threading",
] }
```

## SQLite Schema Overview

Persistence is handled by `rusqlite` with a bundled SQLite build. Migrations run automatically on startup.

```sql
CREATE TABLE agents (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    model       TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
    system_prompt TEXT,
    project_id  TEXT REFERENCES projects(id),
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE skills (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    description TEXT,
    prompt      TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE agent_skills (
    agent_id    TEXT REFERENCES agents(id) ON DELETE CASCADE,
    skill_id    TEXT REFERENCES skills(id) ON DELETE CASCADE,
    PRIMARY KEY (agent_id, skill_id)
);

CREATE TABLE projects (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    path        TEXT NOT NULL,
    is_active   INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE messages (
    id          TEXT PRIMARY KEY,
    agent_id    TEXT REFERENCES agents(id) ON DELETE CASCADE,
    role        TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content     TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL
);
```

## References

- [System Architecture](./system-architecture.md)
- [Tauri Bridge](./tauri-bridge.md)
- [Tauri v2 Documentation](https://v2.tauri.app)
- [Tokio Runtime Documentation](https://docs.rs/tokio)
- [rusqlite Documentation](https://docs.rs/rusqlite)
- [crossbeam-channel Documentation](https://docs.rs/crossbeam-channel)
