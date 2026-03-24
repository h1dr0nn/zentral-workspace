# Agent Manager

> Central orchestration layer for AI agent lifecycle management, including creation, scheduling, monitoring, and teardown with concurrency control.

> **Status:** draft
> **Last updated:** 2026-03-24

---

## Overview

The Agent Manager is the central orchestration layer for all AI coding agents running inside Zentral. It owns the full lifecycle of every agent instance -- creation, scheduling, monitoring, and teardown -- while enforcing concurrency limits and broadcasting state changes to the frontend through Tauri events.

The module lives at `src-tauri/src/agent/manager.rs` and depends on the PTY subsystem for process spawning, the persistence layer for SQLite storage, and crossbeam channels for event distribution.

---

## AgentManager Struct

```rust
use crossbeam_channel::Sender;
use rusqlite::Connection;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

pub struct AgentManager {
    /// All known agents indexed by their unique ID.
    agents: HashMap<AgentId, AgentHandle>,

    /// Maximum number of agents allowed to run concurrently.
    /// Configurable at startup; defaults to 5.
    max_concurrent: usize,

    /// FIFO queue of agents waiting for a concurrency slot.
    pending_queue: VecDeque<AgentId>,

    /// Channel for broadcasting agent events to subscribers.
    event_sender: Sender<AgentEvent>,

    /// Shared SQLite connection for persistence.
    db: Arc<Mutex<Connection>>,

    /// Current working directory inherited by all agents.
    /// Updated when the active project changes.
    current_cwd: PathBuf,
}
```

Each `AgentHandle` wraps the runtime state for a single agent:

```rust
pub struct AgentHandle {
    pub config: AgentConfig,
    pub status: AgentStatus,
    pub child: Option<std::process::Child>,
    pub monitor_handle: Option<std::thread::JoinHandle<()>>,
}
```

---

## Agent State Machine

Every agent moves through a well-defined set of states. The diagram below shows all valid transitions:

```
                         create()
                            |
                            v
                      +-----------+
                      | Creating  |
                      +-----+-----+
                            |
              spawn ok      |      concurrency limit reached
           +----------------+----------------+
           |                                 |
           v                                 v
      +---------+                       +----------+
      | Online  |                       |  Queued  |
      +----+----+                       +-----+----+
           |                                  |
           |  (immediate)         slot freed  |
           v                                  |
      +---------+    start()    +-------------+
      |  Idle   |<--------------+
      +----+----+
           |
           |  input received / task assigned
           v
      +---------+
      | Running |
      +----+----+
           |
           +------------------+------------------+
           |                  |                  |
           | task complete    | error            | pause()
           v                  v                  v
      +---------+       +---------+        +---------+
      |  Idle   |       |  Error  |        | Paused  |
      +---------+       +----+----+        +----+----+
                              |                  |
                 auto-restart |     resume()     |
                 or manual    |                  |
                     +--------+------------------+
                     |
                     v
                +---------+
                |  Idle   |
                +---------+

      Any state except Creating
           |
           |  stop() / unexpected exit
           v
      +---------+
      | Stopped |
      +---------+
           |
           |  delete()
           v
      +---------+
      | Deleted |  (removed from HashMap and SQLite)
      +---------+
```

### State Definitions

| State    | Description                                                                 |
|----------|-----------------------------------------------------------------------------|
| Creating | Agent record inserted into SQLite; process spawn in progress.               |
| Queued   | Concurrency limit reached. Agent waits in FIFO queue for a slot.            |
| Online   | Process spawned successfully. Transitional state before entering Idle.      |
| Idle     | Agent process is alive but not executing a task. Ready to accept input.     |
| Running  | Agent is actively processing a task. PTY I/O is flowing.                    |
| Paused   | Agent process is alive but input is suppressed (not forwarded to PTY).      |
| Error    | Agent process exited unexpectedly or reported an unrecoverable fault.       |
| Stopped  | Agent process has been intentionally terminated via `stop()`.               |
| Deleted  | Agent removed from both in-memory state and SQLite. Terminal state.         |

### Transition Triggers

| From     | To       | Trigger                                                      |
|----------|----------|--------------------------------------------------------------|
| --       | Creating | `AgentManager::create()` called                             |
| Creating | Online   | Child process spawned successfully                           |
| Creating | Queued   | `active_count >= max_concurrent`                             |
| Queued   | Idle     | A slot is freed and this agent is next in the FIFO queue     |
| Online   | Idle     | Automatic transition after spawn confirmation                |
| Idle     | Running  | Input forwarded to agent or task assigned                    |
| Running  | Idle     | Agent completes current task                                 |
| Running  | Error    | Process exits with non-zero code or crashes                  |
| Running  | Paused   | `AgentManager::pause()` called                               |
| Paused   | Idle     | `AgentManager::resume()` called                              |
| Error    | Idle     | `AgentManager::restart()` called, or auto-restart fires      |
| Any      | Stopped  | `AgentManager::stop()` called or graceful shutdown initiated |
| Stopped  | Deleted  | `AgentManager::delete()` called                              |

---

## AgentConfig

The `AgentConfig` struct stores the declarative configuration for an agent. It maps 1:1 to a row in the `agents` SQLite table.

```rust
use chrono::{DateTime, Utc};
use uuid::Uuid;

/// Unique identifier for an agent instance.
#[derive(Debug, Clone, Hash, Eq, PartialEq)]
pub struct AgentId(pub Uuid);

/// Unique identifier for a skill an agent can perform.
#[derive(Debug, Clone, Hash, Eq, PartialEq)]
pub struct SkillId(pub String);

/// Persistent configuration for a single agent.
#[derive(Debug, Clone)]
pub struct AgentConfig {
    /// Unique agent identifier (UUID v4).
    pub id: AgentId,

    /// Human-readable name (e.g., "Backend Agent").
    pub name: String,

    /// Role or title describing the agent's purpose
    /// (e.g., "Senior Rust Engineer", "Frontend Specialist").
    pub role: String,

    /// Set of skills this agent is configured to use.
    pub skills: Vec<SkillId>,

    /// Session this agent belongs to. Links to the terminal session table.
    pub session_id: Uuid,

    /// Current lifecycle status.
    pub status: AgentStatus,

    /// When the agent record was created.
    pub created_at: DateTime<Utc>,

    /// When the agent record was last modified.
    pub updated_at: DateTime<Utc>,
}

/// All possible agent statuses, persisted to SQLite as TEXT.
#[derive(Debug, Clone, PartialEq)]
pub enum AgentStatus {
    Creating,
    Queued,
    Online,
    Idle,
    Running,
    Paused,
    Error,
    Stopped,
}
```

---

## Agent Lifecycle

### create

Insert a new agent record into SQLite and attempt to spawn the child process. If the concurrency limit has been reached, the agent enters the Queued state instead.

```rust
impl AgentManager {
    pub fn create(&mut self, name: String, role: String, skills: Vec<SkillId>) -> Result<AgentId> {
        let config = AgentConfig {
            id: AgentId(Uuid::new_v4()),
            name,
            role,
            skills,
            session_id: self.active_session_id(),
            status: AgentStatus::Creating,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        // Persist to SQLite before spawning.
        self.db_insert_agent(&config)?;

        let id = config.id.clone();

        if self.active_count() >= self.max_concurrent {
            // Concurrency limit reached -- enqueue.
            self.set_status(&id, AgentStatus::Queued)?;
            self.pending_queue.push_back(id.clone());
            return Ok(id);
        }

        // Spawn the child process.
        self.spawn_agent(config)?;
        Ok(id)
    }
}
```

### start

Transition a Stopped or Error agent back to Idle by spawning a new child process. Reuses the existing `AgentConfig`.

```rust
pub fn start(&mut self, id: &AgentId) -> Result<()> {
    let handle = self.agents.get(id).ok_or(Error::AgentNotFound)?;
    match handle.status {
        AgentStatus::Stopped | AgentStatus::Error => {}
        _ => return Err(Error::InvalidTransition),
    }
    let config = handle.config.clone();
    self.spawn_agent(config)
}
```

### pause

Suspend input forwarding without killing the process. The agent process remains alive but receives no new stdin bytes. Useful when the user wants to temporarily halt an agent without losing its in-memory state.

```rust
pub fn pause(&mut self, id: &AgentId) -> Result<()> {
    let handle = self.agents.get_mut(id).ok_or(Error::AgentNotFound)?;
    if handle.status != AgentStatus::Running && handle.status != AgentStatus::Idle {
        return Err(Error::InvalidTransition);
    }
    handle.status = AgentStatus::Paused;
    self.db_update_status(id, AgentStatus::Paused)?;
    self.emit(AgentEvent::StatusChanged { id: id.clone(), status: AgentStatus::Paused });
    Ok(())
}
```

### stop

Terminate the agent process. On Unix this sends `SIGTERM`; on Windows it calls `TerminateProcess`. The monitor thread detects the exit and updates state.

```rust
pub fn stop(&mut self, id: &AgentId) -> Result<()> {
    let handle = self.agents.get_mut(id).ok_or(Error::AgentNotFound)?;
    if let Some(ref mut child) = handle.child {
        child.kill()?;
    }
    handle.child = None;
    self.set_status(id, AgentStatus::Stopped)?;
    self.try_drain_queue();
    Ok(())
}
```

### restart

Stop the agent process, then immediately start a fresh one. Equivalent to `stop()` followed by `start()`.

```rust
pub fn restart(&mut self, id: &AgentId) -> Result<()> {
    self.stop(id)?;
    self.start(id)
}
```

### delete

Stop the agent if it is still running, remove it from the in-memory HashMap, and delete the row from SQLite.

```rust
pub fn delete(&mut self, id: &AgentId) -> Result<()> {
    // Ensure the process is dead.
    if let Some(handle) = self.agents.get(id) {
        if handle.status != AgentStatus::Stopped {
            self.stop(id)?;
        }
    }
    self.agents.remove(id);
    self.db_delete_agent(id)?;
    self.emit(AgentEvent::Deleted { id: id.clone() });
    Ok(())
}
```

---

## Concurrency Control

Zentral enforces a configurable upper bound on concurrently running agents. The design is adapted from the FIFO semaphore pattern used in the tailclaude-bridge process pool.

### Parameters

| Parameter        | Default | Description                                        |
|------------------|---------|----------------------------------------------------|
| `max_concurrent` | 5       | Maximum agents in Online/Idle/Running/Paused state. |
| `max_queue`      | 20      | Maximum agents waiting in the Queued state.         |

### Algorithm

```
on create(agent):
    if active_count < max_concurrent:
        spawn(agent)
        set status -> Online
    else if queue_length < max_queue:
        set status -> Queued
        pending_queue.push_back(agent.id)
    else:
        return Error::QueueFull

on stop(agent) or on agent_exit:
    active_count -= 1
    try_drain_queue()

fn try_drain_queue():
    while active_count < max_concurrent and pending_queue is not empty:
        next_id = pending_queue.pop_front()      // FIFO order
        spawn(agents[next_id].config)
        set status -> Online
        active_count += 1
```

### Slot Counting

A slot is considered occupied when the agent status is one of: `Online`, `Idle`, `Running`, or `Paused`. Agents in `Creating`, `Queued`, `Stopped`, or `Error` do not consume a slot.

```rust
fn active_count(&self) -> usize {
    self.agents.values().filter(|h| matches!(
        h.status,
        AgentStatus::Online
            | AgentStatus::Idle
            | AgentStatus::Running
            | AgentStatus::Paused
    )).count()
}
```

---

## CWD Management

All agents inherit the working directory of the currently active project. When the user switches projects, the AgentManager updates every running agent.

### On Project Switch

```rust
pub fn update_cwd(&mut self, new_cwd: PathBuf) {
    self.current_cwd = new_cwd.clone();

    for (id, handle) in &self.agents {
        let dominated = matches!(
            handle.status,
            AgentStatus::Idle | AgentStatus::Running | AgentStatus::Paused
        );
        if dominated {
            // Platform-specific CWD update.
            // On Unix: write "cd <path>\n" to the agent's PTY stdin.
            // On Windows: same mechanism via ConPTY stdin pipe.
            if let Some(ref child) = handle.child {
                self.send_cwd_command(child, &new_cwd);
            }
            self.emit(AgentEvent::CwdChanged {
                id: id.clone(),
                cwd: new_cwd.clone(),
            });
        }
    }
}
```

### Behavior Details

| Scenario                        | Action                                                       |
|---------------------------------|--------------------------------------------------------------|
| Agent is Idle                   | Send `cd <path>` via stdin immediately.                      |
| Agent is Running                | Queue the CWD update; apply when agent returns to Idle.      |
| Agent is Paused                 | Store new CWD; apply on resume.                              |
| Agent is Queued                 | New CWD is used at spawn time.                               |
| Agent is Stopped/Error          | No action. CWD will be set correctly on next start.          |

---

## Event Broadcasting

The AgentManager uses a crossbeam unbounded channel to decouple event production from consumption. A dedicated forwarding thread bridges the channel to Tauri's event system.

### Channel Setup

```rust
use crossbeam_channel::{unbounded, Receiver, Sender};

let (event_sender, event_receiver): (Sender<AgentEvent>, Receiver<AgentEvent>) = unbounded();
```

### Event Types

```rust
pub enum AgentEvent {
    /// Agent transitioned to a new status.
    StatusChanged {
        id: AgentId,
        status: AgentStatus,
    },

    /// Agent produced output on stdout/stderr.
    Output {
        id: AgentId,
        stream: OutputStream,
        data: Vec<u8>,
    },

    /// Agent encountered an error.
    Error {
        id: AgentId,
        message: String,
        recoverable: bool,
    },

    /// Agent was removed.
    Deleted {
        id: AgentId,
    },

    /// Working directory changed for an agent.
    CwdChanged {
        id: AgentId,
        cwd: PathBuf,
    },

    /// Agent was dequeued and is now spawning.
    Dequeued {
        id: AgentId,
    },
}

pub enum OutputStream {
    Stdout,
    Stderr,
}
```

### Forwarding Thread

A single background thread reads from the crossbeam channel and converts each event into a Tauri event that the React frontend can subscribe to.

```rust
fn start_event_forwarder(app: tauri::AppHandle, receiver: Receiver<AgentEvent>) {
    std::thread::Builder::new()
        .name("agent-event-forwarder".into())
        .spawn(move || {
            while let Ok(event) = receiver.recv() {
                let payload = serde_json::to_string(&event)
                    .expect("AgentEvent must be serializable");

                let event_name = match &event {
                    AgentEvent::StatusChanged { .. } => "agent:status-changed",
                    AgentEvent::Output { .. }        => "agent:output",
                    AgentEvent::Error { .. }         => "agent:error",
                    AgentEvent::Deleted { .. }       => "agent:deleted",
                    AgentEvent::CwdChanged { .. }    => "agent:cwd-changed",
                    AgentEvent::Dequeued { .. }      => "agent:dequeued",
                };

                let _ = app.emit(event_name, payload);
            }
        })
        .expect("failed to spawn event forwarder thread");
}
```

### Frontend Subscription (TypeScript)

```typescript
import { listen } from "@tauri-apps/api/event";

listen<AgentEvent>("agent:status-changed", (event) => {
  const { id, status } = event.payload;
  agentStore.updateStatus(id, status);
});

listen<AgentEvent>("agent:output", (event) => {
  const { id, stream, data } = event.payload;
  agentStore.appendOutput(id, stream, data);
});
```

---

## Process Monitoring

Each spawned agent gets a dedicated monitor thread that watches for process exit. This ensures prompt detection of crashes and enables auto-restart.

### Monitor Thread

```rust
fn spawn_monitor(
    id: AgentId,
    mut child: std::process::Child,
    sender: Sender<AgentEvent>,
    auto_restart: bool,
) -> std::thread::JoinHandle<()> {
    std::thread::Builder::new()
        .name(format!("agent-monitor-{}", id.0))
        .spawn(move || {
            let exit_status = child.wait().expect("failed to wait on agent process");

            if exit_status.success() {
                sender.send(AgentEvent::StatusChanged {
                    id: id.clone(),
                    status: AgentStatus::Stopped,
                }).ok();
            } else {
                sender.send(AgentEvent::Error {
                    id: id.clone(),
                    message: format!("exited with {}", exit_status),
                    recoverable: auto_restart,
                }).ok();
                sender.send(AgentEvent::StatusChanged {
                    id: id.clone(),
                    status: AgentStatus::Error,
                }).ok();
            }
        })
        .expect("failed to spawn monitor thread")
}
```

### Auto-Restart Policy

| Condition                               | Action                                   |
|-----------------------------------------|------------------------------------------|
| Exit code non-zero, `auto_restart=true` | Wait 2 seconds, then call `start()`.     |
| Exit code non-zero, `auto_restart=false`| Set status to Error. Wait for user.      |
| Exit code zero (normal exit)            | Set status to Stopped. Free the slot.    |
| Three consecutive crashes within 60s    | Disable auto-restart, emit Error event.  |

Auto-restart is disabled by default and can be enabled per-agent in the agent configuration UI.

---

## Graceful Shutdown

When the Zentral application exits, the AgentManager must terminate all child processes cleanly before the main process ends.

### Shutdown Sequence

```
App exit signal received
        |
        v
AgentManager::shutdown() called
        |
        v
Iterate all agents where child.is_some()
        |
        +--- For each agent:
        |        |
        |        v
        |    Send SIGTERM (Unix) / TerminateProcess (Windows)
        |
        v
Start 10-second deadline timer
        |
        v
Poll all child processes in a loop (100ms interval)
        |
        +--- All exited before deadline?
        |        |
        |        Yes --> Done. All processes cleaned up.
        |
        +--- Deadline reached with processes still alive?
                 |
                 v
            Force-kill remaining (SIGKILL / TerminateProcess)
            Log warning for each force-killed agent
```

### Implementation

```rust
impl AgentManager {
    pub fn shutdown(&mut self) {
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(10);

        // Phase 1: request graceful termination.
        for handle in self.agents.values_mut() {
            if let Some(ref mut child) = handle.child {
                #[cfg(unix)]
                {
                    use nix::sys::signal::{kill, Signal};
                    use nix::unistd::Pid;
                    let _ = kill(Pid::from_raw(child.id() as i32), Signal::SIGTERM);
                }
                #[cfg(windows)]
                {
                    let _ = child.kill(); // TerminateProcess on Windows
                }
            }
        }

        // Phase 2: wait for processes to exit.
        loop {
            let all_exited = self.agents.values_mut().all(|h| {
                match h.child.as_mut() {
                    None => true,
                    Some(c) => c.try_wait().map(|s| s.is_some()).unwrap_or(false),
                }
            });

            if all_exited || std::time::Instant::now() >= deadline {
                break;
            }

            std::thread::sleep(std::time::Duration::from_millis(100));
        }

        // Phase 3: force-kill any stragglers.
        for (id, handle) in &mut self.agents {
            if let Some(ref mut child) = handle.child {
                if child.try_wait().ok().flatten().is_none() {
                    log::warn!("Force-killing agent {}", id.0);
                    let _ = child.kill();
                    let _ = child.wait();
                }
            }
            handle.child = None;
        }
    }
}
```

### Platform Notes

| Platform | Graceful Signal | Force Kill        | Notes                                    |
|----------|-----------------|-------------------|------------------------------------------|
| Linux    | `SIGTERM`       | `SIGKILL`         | Uses `nix` crate for signal delivery.    |
| macOS    | `SIGTERM`       | `SIGKILL`         | Same as Linux.                           |
| Windows  | `TerminateProcess` | `TerminateProcess` | No graceful equivalent; immediate kill. |

On Windows, `TerminateProcess` is used for both phases because there is no direct equivalent of `SIGTERM` for console processes. If the agent process is a CLI tool that reads stdin, writing an EOF (closing the stdin pipe) is attempted first as a softer shutdown hint.

---

## SQLite Integration

### Table Schema

```sql
CREATE TABLE IF NOT EXISTS agents (
    id          TEXT PRIMARY KEY,       -- UUID v4
    name        TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT '',
    skills      TEXT NOT NULL DEFAULT '[]',  -- JSON array of skill IDs
    session_id  TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'Creating',
    auto_restart INTEGER NOT NULL DEFAULT 0,  -- boolean: 0 or 1
    created_at  TEXT NOT NULL,          -- ISO 8601 timestamp
    updated_at  TEXT NOT NULL,          -- ISO 8601 timestamp
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_agents_session ON agents(session_id);
CREATE INDEX idx_agents_status  ON agents(status);
```

### CRUD Operations

```rust
impl AgentManager {
    /// Insert a new agent row.
    fn db_insert_agent(&self, config: &AgentConfig) -> Result<()> {
        let db = self.db.lock().unwrap();
        db.execute(
            "INSERT INTO agents (id, name, role, skills, session_id, status, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![
                config.id.0.to_string(),
                config.name,
                config.role,
                serde_json::to_string(&config.skills)?,
                config.session_id.to_string(),
                config.status.as_str(),
                config.created_at.to_rfc3339(),
                config.updated_at.to_rfc3339(),
            ],
        )?;
        Ok(())
    }

    /// Update the status column and touch updated_at.
    fn db_update_status(&self, id: &AgentId, status: AgentStatus) -> Result<()> {
        let db = self.db.lock().unwrap();
        db.execute(
            "UPDATE agents SET status = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![
                status.as_str(),
                Utc::now().to_rfc3339(),
                id.0.to_string(),
            ],
        )?;
        Ok(())
    }

    /// Load all agents for a given session.
    fn db_load_session_agents(&self, session_id: &Uuid) -> Result<Vec<AgentConfig>> {
        let db = self.db.lock().unwrap();
        let mut stmt = db.prepare(
            "SELECT id, name, role, skills, session_id, status, created_at, updated_at
             FROM agents WHERE session_id = ?1 ORDER BY created_at ASC"
        )?;
        let rows = stmt.query_map(
            rusqlite::params![session_id.to_string()],
            |row| AgentConfig::from_row(row),
        )?;
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }

    /// Delete an agent row permanently.
    fn db_delete_agent(&self, id: &AgentId) -> Result<()> {
        let db = self.db.lock().unwrap();
        db.execute(
            "DELETE FROM agents WHERE id = ?1",
            rusqlite::params![id.0.to_string()],
        )?;
        Ok(())
    }

    /// Update an agent's name, role, or skills.
    fn db_update_config(&self, config: &AgentConfig) -> Result<()> {
        let db = self.db.lock().unwrap();
        db.execute(
            "UPDATE agents SET name = ?1, role = ?2, skills = ?3, updated_at = ?4
             WHERE id = ?5",
            rusqlite::params![
                config.name,
                config.role,
                serde_json::to_string(&config.skills)?,
                Utc::now().to_rfc3339(),
                config.id.0.to_string(),
            ],
        )?;
        Ok(())
    }
}
```

### Status Serialization

The `AgentStatus` enum is stored as plain text in SQLite. Conversion is handled via `as_str()` and `FromStr`:

```rust
impl AgentStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            AgentStatus::Creating => "Creating",
            AgentStatus::Queued   => "Queued",
            AgentStatus::Online   => "Online",
            AgentStatus::Idle     => "Idle",
            AgentStatus::Running  => "Running",
            AgentStatus::Paused   => "Paused",
            AgentStatus::Error    => "Error",
            AgentStatus::Stopped  => "Stopped",
        }
    }
}

impl std::str::FromStr for AgentStatus {
    type Err = Error;

    fn from_str(s: &str) -> Result<Self> {
        match s {
            "Creating" => Ok(AgentStatus::Creating),
            "Queued"   => Ok(AgentStatus::Queued),
            "Online"   => Ok(AgentStatus::Online),
            "Idle"     => Ok(AgentStatus::Idle),
            "Running"  => Ok(AgentStatus::Running),
            "Paused"   => Ok(AgentStatus::Paused),
            "Error"    => Ok(AgentStatus::Error),
            "Stopped"  => Ok(AgentStatus::Stopped),
            _          => Err(Error::InvalidStatus(s.to_string())),
        }
    }
}
```

---

## References

- [Agent Detection Engine](../03-specifications/agent-detection.md) -- passive detection of agents in terminal sessions
- [Agent Adapters](../03-specifications/agent-adapters.md) -- per-agent parser modules and the AgentAdapter trait
- [Session Management](../03-specifications/session-management.md) -- terminal session lifecycle and persistence
- [PTY Handling](../03-specifications/pty-handling.md) -- process spawning and byte stream management
- [Wit Protocol](../03-specifications/wit-protocol.md) -- structured IPC between agents and Zentral
