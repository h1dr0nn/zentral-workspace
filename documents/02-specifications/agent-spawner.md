# Agent Spawner

> Subsystem responsible for creating Claude CLI child processes, wiring stdin/stdout/stderr pipes, parsing NDJSON streaming output, and monitoring process health.

> **Status:** draft
> **Last updated:** 2026-03-24

---

## Overview

The Agent Spawner is the subsystem responsible for creating, piping, and monitoring Claude CLI child processes inside Zentral. Every agent instance in the workspace maps to exactly one Claude CLI process. The spawner constructs the correct command-line invocation, wires up stdin/stdout/stderr pipes, parses the NDJSON streaming output, and watches the process for exit, crash, or timeout.

The module lives at `src-tauri/src/agent/spawner.rs` and is called by the Agent Manager whenever a new agent needs to come online or an existing agent must be restarted.

```
                     AgentManager
                          |
                          | spawn_agent(config)
                          v
                   +--------------+
                   | AgentSpawner |
                   +------+-------+
                          |
          +---------------+---------------+
          |               |               |
          v               v               v
   build_command()   pipe_io()     monitor_health()
          |               |               |
          v               v               v
   std::process::    stdin write     child.wait()
   Command::new()    stdout reader   exit detection
                     stderr capture  timeout / abort
```

---

## Spawn Command Construction

Every Claude CLI invocation is assembled from a base binary path, a set of flags, and an optional system prompt. The spawner never passes the user prompt as a command-line argument; all content goes through stdin to avoid `ENAMETOOLONG` errors on long inputs.

### Flag Reference

| Flag | Purpose | When included |
|---|---|---|
| `-p` | Prompt mode. Read input from stdin and exit after one response. | Always |
| `--output-format stream-json` | Emit NDJSON on stdout for real-time streaming. | Always |
| `--verbose` | Include metadata events (token counts, timing) in the stream. | Always |
| `--resume <session_id>` | Continue an existing conversation. Claude restores prior context. | When `session_id` is `Some` |
| `--system-prompt <text>` | Inject a system prompt that defines the agent role and skills. | When the agent has a role or skills configured |
| `--model <model>` | Override the default model. | When agent config specifies a non-default model |

### System Prompt Assembly

The system prompt is built from the agent's role and skill set. It is passed via the `--system-prompt` flag so that Claude CLI treats it as a persistent instruction rather than a user message.

```rust
fn build_system_prompt(config: &AgentConfig, skill_pool: &SkillPool) -> String {
    let mut parts = Vec::new();

    parts.push(format!("You are {}.", config.role));

    if !config.skills.is_empty() {
        let skill_names: Vec<&str> = config.skills.iter()
            .filter_map(|sid| skill_pool.get(sid).map(|s| s.name.as_str()))
            .collect();
        parts.push(format!("Your skills: {}.", skill_names.join(", ")));
    }

    parts.push("Work within the current project directory. \
                Be precise and concise.".to_string());

    parts.join(" ")
}
```

### Full Command Builder

```rust
use std::path::PathBuf;
use std::process::{Command, Stdio};

/// Configuration for a single spawn invocation.
pub struct SpawnRequest {
    /// Path to the Claude CLI binary. Defaults to "claude".
    pub cli_path: String,
    /// Working directory for the child process.
    pub cwd: PathBuf,
    /// Agent configuration (role, skills, model, etc.).
    pub agent_config: AgentConfig,
    /// Existing Claude session ID, if resuming a conversation.
    pub session_id: Option<String>,
    /// Assembled system prompt text.
    pub system_prompt: Option<String>,
}

fn build_command(req: &SpawnRequest) -> Command {
    let mut cmd = Command::new(&req.cli_path);

    cmd.current_dir(&req.cwd);

    // Core flags -- always present.
    cmd.arg("-p");
    cmd.args(["--output-format", "stream-json"]);
    cmd.arg("--verbose");

    // Session continuation.
    if let Some(ref sid) = req.session_id {
        cmd.args(["--resume", sid]);
    }

    // System prompt injection.
    if let Some(ref prompt) = req.system_prompt {
        cmd.args(["--system-prompt", prompt]);
    }

    // Model override.
    if let Some(ref model) = req.agent_config.model {
        cmd.args(["--model", model]);
    }

    // Pipe all three standard streams.
    cmd.stdin(Stdio::piped());
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    // Platform-specific: hide the console window on Windows.
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    cmd
}
```

### Spawn Entry Point

```rust
use std::process::Child;
use std::io::Write;

pub fn spawn_agent(req: SpawnRequest, user_message: &str) -> Result<Child> {
    let mut cmd = build_command(&req);
    let mut child = cmd.spawn().map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            Error::CliNotFound(req.cli_path.clone())
        } else {
            Error::SpawnFailed(e)
        }
    })?;

    // Write the user message to stdin, then close the pipe.
    // This signals Claude CLI that input is complete.
    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(user_message.as_bytes())?;
        stdin.flush()?;
        // Drop closes the pipe.
    }

    Ok(child)
}
```

---

## stdin / stdout / stderr Piping

All three standard streams are configured as `Stdio::piped()` at spawn time. Each stream has a dedicated handling strategy.

### stdin

The user message is written to stdin immediately after spawn, then the pipe is closed by dropping the handle. Closing stdin tells Claude CLI that all input has been received and it should begin generating a response.

```
User message bytes --> stdin pipe --> Claude CLI reads --> pipe closed (EOF)
```

For multi-turn conversations, stdin carries only the new message. Prior context is restored internally by Claude via the `--resume` flag.

### stdout

stdout is the primary data channel. Claude CLI emits NDJSON lines that must be parsed in real time. A dedicated reader thread consumes stdout to avoid blocking the main thread and to prevent the OS pipe buffer from filling up (which would deadlock the child).

```rust
use std::io::{BufRead, BufReader};

fn start_stdout_reader(
    stdout: std::process::ChildStdout,
    agent_id: AgentId,
    sender: Sender<AgentEvent>,
) -> std::thread::JoinHandle<()> {
    std::thread::Builder::new()
        .name(format!("agent-stdout-{}", agent_id.0))
        .spawn(move || {
            let reader = BufReader::new(stdout);
            let mut line_buffer = String::new();

            // See "Buffer Management" section for the chunk-safe variant.
            for line_result in reader.lines() {
                match line_result {
                    Ok(line) => {
                        if let Some(event) = parse_ndjson_line(&line, &agent_id) {
                            sender.send(event).ok();
                        }
                    }
                    Err(e) => {
                        sender.send(AgentEvent::Error {
                            id: agent_id.clone(),
                            message: format!("stdout read error: {}", e),
                            recoverable: false,
                        }).ok();
                        break;
                    }
                }
            }
        })
        .expect("failed to spawn stdout reader thread")
}
```

### stderr

stderr is captured in a background thread and accumulated into a buffer. When the process exits, the stderr contents are attached to the error event if the exit code is non-zero.

```rust
fn start_stderr_reader(
    stderr: std::process::ChildStderr,
    agent_id: AgentId,
) -> std::thread::JoinHandle<String> {
    std::thread::Builder::new()
        .name(format!("agent-stderr-{}", agent_id.0))
        .spawn(move || {
            let mut buf = String::new();
            let mut reader = BufReader::new(stderr);
            reader.read_to_string(&mut buf).ok();
            buf
        })
        .expect("failed to spawn stderr reader thread")
}
```

---

## Output Parsing

Claude CLI with `--output-format stream-json` emits one JSON object per line (NDJSON). Each object has a `type` field that determines its structure and meaning.

### Event Types

| `type` | Structure | Description |
|---|---|---|
| `system` | `{ type: "system", ... }` | Initialization event. Emitted once at the start. Contains metadata about the session. |
| `assistant` | `{ type: "assistant", message: { content: [...] } }` | Full assistant message. `content` is an array of blocks, each with `type: "text"` and a `text` field. |
| `content_block_delta` | `{ type: "content_block_delta", delta: { text: "..." } }` | Incremental text delta during streaming. Append `delta.text` to the running output. |
| `result` | `{ type: "result", result: "...", session_id: "..." }` | Final result event. Contains the complete response text and the Claude session ID for resumption. |

### Parsing Implementation

```rust
use serde::Deserialize;
use serde_json::Value;

/// A parsed event from the Claude CLI NDJSON stream.
#[derive(Debug)]
pub enum ClaudeStreamEvent {
    /// Initialization metadata.
    System { raw: Value },
    /// Incremental text fragment.
    Delta { text: String },
    /// Complete assistant message text blocks.
    AssistantMessage { texts: Vec<String> },
    /// Final result with session ID for resumption.
    Result { text: String, session_id: Option<String> },
}

fn parse_ndjson_line(line: &str, agent_id: &AgentId) -> Option<AgentEvent> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return None;
    }

    let value: Value = match serde_json::from_str(trimmed) {
        Ok(v) => v,
        Err(_) => {
            // Invalid JSON -- skip this line gracefully.
            log::debug!("Skipping non-JSON line from agent {}: {}", agent_id.0, trimmed);
            return None;
        }
    };

    let event_type = value.get("type")?.as_str()?;

    match event_type {
        "system" => {
            log::debug!("Agent {} stream initialized", agent_id.0);
            None // Internal bookkeeping only.
        }

        "content_block_delta" => {
            let text = value
                .pointer("/delta/text")?
                .as_str()?
                .to_string();

            Some(AgentEvent::Output {
                id: agent_id.clone(),
                stream: OutputStream::Stdout,
                data: text.into_bytes(),
            })
        }

        "assistant" => {
            let content = value.pointer("/message/content")?;
            let texts: Vec<String> = content.as_array()?
                .iter()
                .filter_map(|block| {
                    if block.get("type")?.as_str()? == "text" {
                        Some(block.get("text")?.as_str()?.to_string())
                    } else {
                        None
                    }
                })
                .collect();

            if texts.is_empty() {
                return None;
            }

            let combined = texts.join("");
            Some(AgentEvent::Output {
                id: agent_id.clone(),
                stream: OutputStream::Stdout,
                data: combined.into_bytes(),
            })
        }

        "result" => {
            // Extract session_id for future --resume usage.
            let session_id = value
                .get("session_id")
                .and_then(|v| v.as_str())
                .map(String::from);

            if let Some(sid) = session_id {
                Some(AgentEvent::SessionIdReceived {
                    id: agent_id.clone(),
                    session_id: sid,
                })
            } else {
                None
            }
        }

        _ => {
            // Unknown event type (e.g., rate_limit_event). Skip silently.
            log::trace!("Ignoring stream event type '{}' from agent {}", event_type, agent_id.0);
            None
        }
    }
}
```

---

## Buffer Management

stdout data arrives from the OS in arbitrarily-sized chunks that do not respect line boundaries. A raw `read()` call might return half a JSON line, two and a half lines, or any other split. The spawner must buffer incoming data and only parse complete lines delimited by `\n`.

This pattern is adapted from the tailclaude-bridge streaming implementation, which uses the same split-on-newline-and-keep-remainder strategy in its SSE proxy layer.

### Algorithm

```
buffer = ""

on_data(chunk):
    buffer += chunk
    lines = buffer.split("\n")
    buffer = lines.pop()          // keep last (possibly incomplete) fragment

    for line in lines:
        trimmed = line.trim()
        if trimmed is empty:
            continue
        try:
            parsed = JSON.parse(trimmed)
            handle(parsed)
        catch:
            skip                  // invalid JSON -- log and discard
```

### Rust Implementation

The `BufReader::lines()` iterator handles line buffering internally, but when lower-level control is needed (for example, to emit partial data for progress indicators), the manual buffer approach is used:

```rust
use std::io::Read;

fn read_stdout_buffered(
    mut stdout: std::process::ChildStdout,
    agent_id: AgentId,
    sender: Sender<AgentEvent>,
) {
    let mut raw_buf = [0u8; 8192];
    let mut line_buffer = String::new();

    loop {
        let bytes_read = match stdout.read(&mut raw_buf) {
            Ok(0) => break,       // EOF -- process closed stdout.
            Ok(n) => n,
            Err(e) => {
                log::error!("stdout read error for agent {}: {}", agent_id.0, e);
                break;
            }
        };

        let chunk = String::from_utf8_lossy(&raw_buf[..bytes_read]);
        line_buffer.push_str(&chunk);

        // Split on newline, keep the last fragment.
        let mut lines: Vec<&str> = line_buffer.split('\n').collect();
        let remainder = lines.pop().unwrap_or("").to_string();

        for line in lines {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }

            if let Some(event) = parse_ndjson_line(trimmed, &agent_id) {
                sender.send(event).ok();
            }
        }

        line_buffer = remainder;
    }

    // Process any trailing content after EOF.
    let trimmed = line_buffer.trim();
    if !trimmed.is_empty() {
        if let Some(event) = parse_ndjson_line(trimmed, &agent_id) {
            sender.send(event).ok();
        }
    }
}
```

### Edge Cases

| Case | Handling |
|---|---|
| Chunk ends mid-line | Fragment stays in `line_buffer`, completed by next chunk. |
| Chunk contains multiple complete lines | All complete lines are parsed immediately. |
| Empty line (`\n\n`) | Skipped after trim check. |
| Invalid JSON on a complete line | Logged at debug level and discarded. Stream continues. |
| Non-UTF-8 bytes | `from_utf8_lossy` replaces invalid sequences with the Unicode replacement character. |
| Trailing content after EOF | Parsed as a final line. Handles the case where Claude CLI does not emit a trailing newline. |

---

## Session Continuation

Claude CLI supports multi-turn conversations through the `--resume` flag. When provided with a session ID, Claude restores the full conversation history from its local storage and treats the new stdin input as the next user turn.

### Session ID Lifecycle

```
First invocation (no --resume):
    spawn claude -p --output-format stream-json
    --> Claude generates a new session internally
    --> "result" event in the NDJSON stream contains "session_id": "abc123"
    --> Spawner extracts session_id and persists it to SQLite

Subsequent invocations (with --resume):
    spawn claude -p --output-format stream-json --resume abc123
    --> Claude restores the prior conversation
    --> New message is appended as the next turn
    --> "result" event may contain the same or updated session_id
```

### SQLite Storage

Session IDs are stored in the `agent_sessions` table, linked to the agent and the workspace session:

```sql
CREATE TABLE IF NOT EXISTS agent_sessions (
    agent_id    TEXT NOT NULL,
    session_id  TEXT NOT NULL,       -- Claude CLI session ID
    created_at  TEXT NOT NULL,       -- ISO 8601
    updated_at  TEXT NOT NULL,       -- ISO 8601
    PRIMARY KEY (agent_id),
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);
```

### Persistence Logic

```rust
impl AgentSpawner {
    /// Store or update the Claude session ID for an agent.
    fn persist_session_id(&self, agent_id: &AgentId, session_id: &str) -> Result<()> {
        let db = self.db.lock().unwrap();
        db.execute(
            "INSERT INTO agent_sessions (agent_id, session_id, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?3)
             ON CONFLICT(agent_id) DO UPDATE SET session_id = ?2, updated_at = ?3",
            rusqlite::params![
                agent_id.0.to_string(),
                session_id,
                Utc::now().to_rfc3339(),
            ],
        )?;
        Ok(())
    }

    /// Retrieve the stored session ID for an agent, if any.
    fn load_session_id(&self, agent_id: &AgentId) -> Result<Option<String>> {
        let db = self.db.lock().unwrap();
        let mut stmt = db.prepare(
            "SELECT session_id FROM agent_sessions WHERE agent_id = ?1"
        )?;
        let result = stmt.query_row(
            rusqlite::params![agent_id.0.to_string()],
            |row| row.get(0),
        ).optional()?;
        Ok(result)
    }
}
```

---

## Process Health Monitoring

Each spawned process is monitored by a dedicated thread that calls `child.wait()` to block until exit. This approach is simpler and more reliable than polling with `child.try_wait()` in a loop, and it consumes no CPU while waiting.

### Monitor Thread

```rust
fn spawn_process_monitor(
    agent_id: AgentId,
    mut child: Child,
    stderr_handle: std::thread::JoinHandle<String>,
    sender: Sender<AgentEvent>,
) -> std::thread::JoinHandle<()> {
    std::thread::Builder::new()
        .name(format!("agent-monitor-{}", agent_id.0))
        .spawn(move || {
            let exit_status = match child.wait() {
                Ok(status) => status,
                Err(e) => {
                    sender.send(AgentEvent::Error {
                        id: agent_id.clone(),
                        message: format!("wait() failed: {}", e),
                        recoverable: false,
                    }).ok();
                    return;
                }
            };

            // Collect stderr output from the capture thread.
            let stderr_output = stderr_handle.join().unwrap_or_default();

            if exit_status.success() {
                // Normal exit -- agent completed its task.
                sender.send(AgentEvent::StatusChanged {
                    id: agent_id.clone(),
                    status: AgentStatus::Idle,
                }).ok();
            } else {
                // Abnormal exit -- report error with stderr context.
                let code_str = exit_status.code()
                    .map(|c| c.to_string())
                    .unwrap_or_else(|| "signal".to_string());

                let message = if stderr_output.is_empty() {
                    format!("Claude CLI exited with code {}", code_str)
                } else {
                    format!(
                        "Claude CLI exited with code {}: {}",
                        code_str,
                        stderr_output.lines().last().unwrap_or("unknown error")
                    )
                };

                sender.send(AgentEvent::Error {
                    id: agent_id.clone(),
                    message,
                    recoverable: true,
                }).ok();
                sender.send(AgentEvent::StatusChanged {
                    id: agent_id.clone(),
                    status: AgentStatus::Error,
                }).ok();
            }
        })
        .expect("failed to spawn process monitor thread")
}
```

### Exit Classification

| Condition | Exit Code | Signal | Classification | Action |
|---|---|---|---|---|
| Task completed normally | 0 | -- | Success | Set status to Idle |
| Claude CLI error (auth, network, etc.) | 1 | -- | Recoverable error | Set status to Error, emit error event |
| CLI binary not found | -- | -- | Fatal (ENOENT) | Set status to Error, disable auto-restart |
| Process killed by user abort | -- | SIGKILL / TerminateProcess | Aborted | Set status to Idle, emit aborted event |
| Process killed by timeout | -- | SIGKILL / TerminateProcess | Timeout | Set status to Error, emit timeout event |
| Unexpected crash | Non-zero | SIGSEGV, etc. | Crash | Set status to Error, log stderr |

---

## Timeout Handling

Each agent invocation has a configurable timeout. If the Claude CLI process does not exit within the allowed duration, the spawner kills it and reports a timeout error.

### Configuration

| Parameter | Default | Range | Description |
|---|---|---|---|
| `agent_timeout_secs` | 1800 (30 min) | 30 -- 7200 | Maximum wall-clock time per invocation. |
| `grace_period_secs` | 5 | 1 -- 30 | Time between SIGTERM and SIGKILL on Unix. |

### Timeout Thread

A separate timer thread sleeps for the configured duration. If the process is still alive when the timer fires, it initiates a kill sequence.

```rust
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

fn spawn_timeout_watcher(
    agent_id: AgentId,
    child_pid: u32,
    timeout: Duration,
    completed: Arc<AtomicBool>,
    sender: Sender<AgentEvent>,
) -> std::thread::JoinHandle<()> {
    std::thread::Builder::new()
        .name(format!("agent-timeout-{}", agent_id.0))
        .spawn(move || {
            std::thread::sleep(timeout);

            // Check if the process already finished.
            if completed.load(Ordering::SeqCst) {
                return;
            }

            log::warn!(
                "Agent {} (pid {}) exceeded timeout of {:?}, killing",
                agent_id.0, child_pid, timeout
            );

            kill_process(child_pid);

            sender.send(AgentEvent::Error {
                id: agent_id.clone(),
                message: format!("Agent timed out after {} seconds", timeout.as_secs()),
                recoverable: true,
            }).ok();
        })
        .expect("failed to spawn timeout watcher thread")
}

/// Signal the monitor thread that the process has completed naturally.
/// Called from the monitor thread on normal or error exit.
fn mark_completed(completed: &Arc<AtomicBool>) {
    completed.store(true, Ordering::SeqCst);
}
```

---

## Platform Differences

### Windows

On Windows, child processes are spawned with the `CREATE_NO_WINDOW` creation flag to prevent a visible console window from flashing on screen. Process termination uses `TerminateProcess`, which is immediate and ungraceful -- there is no equivalent of Unix signals for console processes.

```rust
#[cfg(windows)]
fn kill_process(pid: u32) {
    use windows_sys::Win32::System::Threading::{
        OpenProcess, TerminateProcess, PROCESS_TERMINATE,
    };
    use windows_sys::Win32::Foundation::CloseHandle;

    unsafe {
        let handle = OpenProcess(PROCESS_TERMINATE, 0, pid);
        if handle != 0 {
            TerminateProcess(handle, 1);
            CloseHandle(handle);
        }
    }
}
```

### Unix (Linux, macOS)

On Unix, the spawner first sends `SIGTERM` to allow Claude CLI to clean up (flush buffers, close files). If the process does not exit within the grace period, `SIGKILL` is sent as a non-catchable forced termination.

```rust
#[cfg(unix)]
fn kill_process(pid: u32) {
    use nix::sys::signal::{kill, Signal};
    use nix::unistd::Pid;

    let nix_pid = Pid::from_raw(pid as i32);

    // Phase 1: graceful termination request.
    if kill(nix_pid, Signal::SIGTERM).is_err() {
        return; // Process already gone.
    }

    // Phase 2: wait for grace period, then force-kill.
    std::thread::sleep(Duration::from_secs(5));

    // Check if still alive.
    if kill(nix_pid, Signal::SIGTERM).is_ok() {
        let _ = kill(nix_pid, Signal::SIGKILL);
    }
}
```

### Summary

| Aspect | Windows | Unix |
|---|---|---|
| Console visibility | `CREATE_NO_WINDOW` flag | Not applicable (no GUI) |
| Graceful stop | Close stdin pipe (hint) | `SIGTERM` |
| Force kill | `TerminateProcess` | `SIGKILL` |
| Grace period | Not applicable | Configurable (default 5s) |
| PID type | `u32` (DWORD) | `i32` (pid_t) |

---

## Abort Mechanism

When the user cancels a running agent response, the frontend sends an abort command through Tauri. The spawner must kill the child process immediately and clean up streaming state.

### Abort Flow

```
User clicks "Stop" in UI
        |
        v
Frontend calls invoke("abort_agent", { agentId })
        |
        v
Tauri command handler:
    1. Look up agent in AgentManager
    2. Call spawner.abort(agent_id)
        |
        v
AgentSpawner::abort():
    1. Kill the child process immediately (no grace period)
    2. Set completed flag to prevent timeout thread from firing
    3. Emit AgentEvent::Aborted { id }
    4. Set agent status to Idle (ready for next task)
        |
        v
Frontend receives "agent:aborted" event:
    1. Clear streaming output buffer
    2. Remove loading indicator
    3. Append "[Response cancelled]" marker
    4. Re-enable input
```

### Implementation

```rust
impl AgentSpawner {
    pub fn abort(&mut self, agent_id: &AgentId) -> Result<()> {
        let handle = self.handles.get_mut(agent_id)
            .ok_or(Error::AgentNotFound)?;

        // Kill the child process immediately.
        if let Some(ref mut child) = handle.child {
            #[cfg(windows)]
            {
                let _ = child.kill();
            }
            #[cfg(unix)]
            {
                // Use SIGKILL directly -- no grace period on user-initiated abort.
                use nix::sys::signal::{kill, Signal};
                use nix::unistd::Pid;
                let _ = kill(
                    Pid::from_raw(child.id() as i32),
                    Signal::SIGKILL,
                );
            }
            let _ = child.wait(); // Reap the zombie.
        }

        // Prevent the timeout thread from firing.
        if let Some(ref completed) = handle.completed_flag {
            completed.store(true, Ordering::SeqCst);
        }

        handle.child = None;

        self.sender.send(AgentEvent::Aborted {
            id: agent_id.clone(),
        }).ok();

        self.sender.send(AgentEvent::StatusChanged {
            id: agent_id.clone(),
            status: AgentStatus::Idle,
        }).ok();

        Ok(())
    }
}
```

### Frontend Handler (TypeScript)

```typescript
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

// Abort a running agent response.
async function abortAgent(agentId: string): Promise<void> {
  await invoke("abort_agent", { agentId });
}

// Listen for abort confirmation.
listen<{ id: string }>("agent:aborted", (event) => {
  const { id } = event.payload;
  agentStore.clearStreamingState(id);
  agentStore.appendSystemMessage(id, "[Response cancelled]");
  agentStore.updateStatus(id, "Idle");
});
```

---

## Full Orchestration

The complete spawn sequence ties together all subsystems. The following shows the order of operations when the Agent Manager dispatches a task to the spawner.

```
AgentManager::send_message(agent_id, message)
        |
        v
SpawnRequest {
    cli_path: config.claude_path,       // "claude" or custom
    cwd: manager.current_cwd,
    agent_config: agent.config,
    session_id: load_session_id(id)?,   // None for first turn
    system_prompt: build_system_prompt(config, skills),
}
        |
        v
build_command(req) --> Command with all flags
        |
        v
child = cmd.spawn()?
        |
        +--- write message to stdin, close pipe
        |
        +--- take stdout --> spawn stdout reader thread
        |                    (buffer + NDJSON parse + emit events)
        |
        +--- take stderr --> spawn stderr capture thread
        |
        +--- spawn monitor thread (child.wait())
        |        |
        |        +--- on exit: mark_completed, emit status event
        |
        +--- spawn timeout thread (sleep + kill if not completed)
        |
        v
Agent status: Running
Events flow to frontend via Tauri event bus
        |
        v
On "result" event: extract session_id, persist to SQLite
On normal exit:    status -> Idle, free for next task
On error exit:     status -> Error, stderr attached
On timeout:        kill process, status -> Error
On user abort:     kill process, status -> Idle
```

---

## References

- [Agent Manager](./agent-manager.md) -- lifecycle orchestration, concurrency control, and event broadcasting
- [Secretary Agent](./secretary-agent.md) -- task routing and delegation to spawned agents
- [Skill Pool](./skill-pool.md) -- skill definitions injected into agent system prompts
- [Session Management](../03-specifications/session-management.md) -- terminal session lifecycle and persistence
- [PTY Handling](../03-specifications/pty-handling.md) -- low-level process spawning infrastructure
- [tailclaude-bridge](../../tailclaude-bridge/) -- reference implementation for Claude CLI streaming and buffer management
