# Streaming Protocol

> Defines how raw NDJSON output from Claude CLI child processes is parsed into typed UI events and delivered to the frontend via Tauri's IPC event system.

> **Status:** draft
> **Last updated:** 2026-03-24

---

## Overview

This specification defines how raw output from a Claude CLI child process is transformed into typed UI events that drive the frontend chat view. The streaming protocol is a cross-cutting concern that connects three subsystems:

| Subsystem | Role in the pipeline |
|---|---|
| Agent Spawner | Spawns the Claude CLI process and captures its stdout pipe. |
| Secretary Agent | Dispatches user messages to agents and monitors their streaming output. |
| Frontend Chat View | Receives typed events via the Tauri event bus and renders them incrementally. |

The protocol replaces HTTP-based streaming (fetch + ReadableStream) with Tauri's native IPC event system. There is no HTTP server involved. Raw bytes from the child process stdout are parsed into NDJSON, mapped to a Rust enum, emitted as Tauri events, and consumed by TypeScript listeners in the frontend.

---

## Claude CLI Output Format

When invoked with `--output-format stream-json`, the Claude CLI writes one JSON object per line to stdout (NDJSON). Each object contains a `type` field that determines its structure and semantics.

### Message Types

| type | Description | Key fields |
|---|---|---|
| `system` | Session initialization. Emitted once at the start of the stream. | `subtype`, `session_id` |
| `assistant` | Full or accumulated assistant response. Contains the complete message so far. | `message.content[]` (array of blocks with `type: "text"` or `type: "tool_use"`) |
| `content_block_delta` | Incremental text update during streaming. One delta per text fragment. | `delta.text` |
| `content_block_start` | Marks the beginning of a new content block. | `content_block.type`, `content_block.id` |
| `content_block_stop` | Marks the end of a content block. | `index` |
| `result` | Final result event. Signals that the response is complete. | `message`, `cost`, `usage`, `session_id` |

### Example Stream

A typical interaction produces the following NDJSON sequence:

```
{"type":"system","subtype":"init","session_id":"sess_abc123"}
{"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}
{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Here is"}}
{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" the answer"}}
{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" to your question."}}
{"type":"content_block_stop","index":0}
{"type":"assistant","message":{"content":[{"type":"text","text":"Here is the answer to your question."}]}}
{"type":"result","message":{"content":[{"type":"text","text":"Here is the answer to your question."}]},"session_id":"sess_abc123","cost":0.0042,"usage":{"input_tokens":150,"output_tokens":12}}
```

When the assistant invokes a tool, the stream includes tool_use blocks:

```
{"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_xyz","name":"Read","input":{}}}
{"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\"file_path\":"}}
{"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"\"/src/main.rs\"}"}}
{"type":"content_block_stop","index":1}
```

---

## Parsing Pipeline

Raw bytes from the Claude CLI stdout are transformed through four stages before reaching the frontend.

```
Claude CLI stdout (raw bytes)
  |
  v
+-------------------------------------------+
| Line Splitter                             |
| Buffer incomplete lines. Emit complete    |
| lines delimited by \n. Keep remainder     |
| for the next read cycle.                  |
+-------------------------------------------+
  |
  v  (one complete line per iteration)
+-------------------------------------------+
| JSON Parser                               |
| serde_json::from_str() on each line.      |
| Invalid JSON lines are logged and         |
| discarded. Empty lines are skipped.       |
+-------------------------------------------+
  |
  v  (serde_json::Value per line)
+-------------------------------------------+
| Event Mapper                              |
| Match on the "type" field. Convert        |
| NDJSON objects into AgentOutputEvent       |
| enum variants. Unknown types are ignored. |
+-------------------------------------------+
  |
  v  (AgentOutputEvent per line)
+-------------------------------------------+
| Event Emitter                             |
| Tauri app_handle.emit() sends the event   |
| to the frontend over IPC. Events are      |
| serialized to JSON automatically.         |
+-------------------------------------------+
  |
  v
Frontend TypeScript listener (chatStore)
```

The Line Splitter and JSON Parser run on a dedicated reader thread per agent (see [Agent Spawner](./agent-spawner.md) for thread management). The Event Emitter calls into the Tauri runtime, which serializes the event and delivers it to the webview process.

---

## AgentOutputEvent Enum (Rust)

All parsed stream data is normalized into a single Rust enum before emission. This decouples the frontend from the raw Claude CLI JSON format and provides a stable contract between backend and UI.

```rust
use serde::Serialize;

/// A typed event emitted from the streaming pipeline to the frontend.
/// Serialized to JSON by Tauri's event system.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum AgentOutputEvent {
    /// Incremental text fragment. Append to the current message.
    Text {
        content: String,
    },

    /// The assistant is invoking a tool. Rendered as a tool execution block.
    ToolUse {
        tool_name: String,
        tool_input: serde_json::Value,
    },

    /// Result of a tool execution returned to the assistant.
    ToolResult {
        tool_use_id: String,
        output: String,
    },

    /// Stream initialization. Contains the Claude session ID for resumption.
    SystemInit {
        session_id: String,
    },

    /// Cumulative cost for this invocation.
    Cost {
        total_cost: f64,
    },

    /// Token usage for this invocation.
    TokenUsage {
        input_tokens: u64,
        output_tokens: u64,
    },

    /// An error occurred during streaming or process execution.
    Error {
        message: String,
    },

    /// The response completed normally.
    Done,

    /// The response was cancelled by the user.
    Aborted,
}
```

### Mapping from NDJSON Type to Enum Variant

| NDJSON `type` | Condition | AgentOutputEvent variant |
|---|---|---|
| `system` | `subtype == "init"` | `SystemInit` |
| `content_block_delta` | `delta.type == "text_delta"` | `Text` |
| `content_block_delta` | `delta.type == "input_json_delta"` | Buffered, emitted as `ToolUse` on `content_block_stop` |
| `content_block_start` | `content_block.type == "tool_use"` | Internal state: begin accumulating tool input |
| `content_block_stop` | Active tool_use block | `ToolUse` with accumulated input |
| `assistant` | -- | Ignored during streaming (deltas already emitted) |
| `result` | Always | `Cost` + `TokenUsage` + `Done` (three events emitted) |

### Tauri Emission

```rust
use tauri::Emitter;

fn emit_output_event(
    app_handle: &tauri::AppHandle,
    agent_id: &str,
    event: AgentOutputEvent,
) {
    let event_name = format!("agent:output:{}", agent_id);
    if let Err(e) = app_handle.emit(&event_name, &event) {
        log::error!("Failed to emit event for agent {}: {}", agent_id, e);
    }
}
```

Events are emitted on a per-agent channel (`agent:output:{agent_id}`) so the frontend can subscribe to a specific agent's stream without filtering.

---

## Frontend Event Handling

The frontend listens for agent output events using Tauri's event API. The `chatStore` (Zustand) processes each event type and updates the reactive state, which triggers re-renders in the chat view.

### TypeScript Listener

```typescript
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

interface AgentOutputEvent {
  kind: "text" | "tool_use" | "tool_result" | "system_init"
      | "cost" | "token_usage" | "error" | "done" | "aborted";
  content?: string;
  tool_name?: string;
  tool_input?: unknown;
  tool_use_id?: string;
  output?: string;
  session_id?: string;
  total_cost?: number;
  input_tokens?: number;
  output_tokens?: number;
  message?: string;
}

function subscribeToAgent(agentId: string): UnlistenFn {
  const unlisten = listen<AgentOutputEvent>(
    `agent:output:${agentId}`,
    (event) => {
      const payload = event.payload;

      switch (payload.kind) {
        case "text":
          chatStore.appendText(agentId, payload.content!);
          break;

        case "tool_use":
          chatStore.addToolExecution(agentId, {
            name: payload.tool_name!,
            input: payload.tool_input,
          });
          break;

        case "tool_result":
          chatStore.resolveToolExecution(agentId, {
            toolUseId: payload.tool_use_id!,
            output: payload.output!,
          });
          break;

        case "system_init":
          chatStore.setSessionId(agentId, payload.session_id!);
          break;

        case "cost":
          chatStore.updateCost(agentId, payload.total_cost!);
          break;

        case "token_usage":
          chatStore.updateTokens(agentId, {
            input: payload.input_tokens!,
            output: payload.output_tokens!,
          });
          break;

        case "error":
          chatStore.markError(agentId, payload.message!);
          toast.error(payload.message!);
          break;

        case "done":
          chatStore.markComplete(agentId);
          break;

        case "aborted":
          chatStore.markAborted(agentId);
          break;
      }
    },
  );

  return unlisten;
}
```

### Event-to-UI Mapping

| Event kind | chatStore action | UI effect |
|---|---|---|
| `text` | Append to current message content buffer | Re-render message with new text, streaming cursor visible |
| `tool_use` | Push tool execution entry to message block list | Show tool name and spinner indicator |
| `tool_result` | Update tool execution entry with output | Replace spinner with output preview |
| `system_init` | Store session ID for `--resume` on next turn | No visible change |
| `cost` | Update cost display in message footer | Show cost badge (e.g., "$0.0042") |
| `token_usage` | Update token counts in message footer | Show token count (e.g., "150 in / 12 out") |
| `error` | Mark message as errored, set error text | Show error toast via Sonner, red error indicator on message |
| `done` | Mark message complete, stop streaming state | Remove streaming cursor, enable input |
| `aborted` | Mark message as cancelled | Show "[Response cancelled]" label, enable input |

---

## Backpressure

Tauri's event system uses an internal queue to buffer events between the Rust backend and the webview frontend. There is no explicit backpressure mechanism exposed to application code. If the frontend cannot consume events fast enough, they accumulate in the queue.

For typical Claude CLI output this is not a problem. However, very long outputs (large code generation, verbose tool results) can produce thousands of `content_block_delta` events in rapid succession.

### Batching Strategy

To reduce IPC overhead on high-throughput streams, the backend batches consecutive text deltas into a single emission at a fixed interval.

```rust
use std::time::{Duration, Instant};

const BATCH_INTERVAL: Duration = Duration::from_millis(50);

struct TextBatcher {
    buffer: String,
    last_flush: Instant,
}

impl TextBatcher {
    fn new() -> Self {
        Self {
            buffer: String::new(),
            last_flush: Instant::now(),
        }
    }

    /// Append a text delta. Returns Some(batched_text) if the batch
    /// interval has elapsed, None otherwise.
    fn push(&mut self, text: &str) -> Option<String> {
        self.buffer.push_str(text);

        if self.last_flush.elapsed() >= BATCH_INTERVAL {
            self.flush()
        } else {
            None
        }
    }

    /// Force-flush any buffered text. Called on Done/Aborted/Error.
    fn flush(&mut self) -> Option<String> {
        if self.buffer.is_empty() {
            return None;
        }
        self.last_flush = Instant::now();
        Some(std::mem::take(&mut self.buffer))
    }
}
```

The batcher is integrated into the stdout reader loop. On each `content_block_delta`, the text is pushed into the batcher. When the batcher returns `Some`, a single `Text` event is emitted with the accumulated content. On stream termination (`Done`, `Aborted`, `Error`), the batcher is flushed to ensure no text is lost.

---

## Abort Mechanism

When the user cancels a running agent response, the following sequence executes end-to-end:

```
User clicks "Stop" button
        |
        v
Frontend: invoke("stop_agent", { agentId })
        |
        v
Tauri command handler (Rust)
        |
        v
AgentSpawner::abort(agent_id)
        |
        +--- Kill child process (SIGKILL / TerminateProcess)
        |
        +--- Reap zombie (child.wait())
        |
        +--- Set completed flag (prevents timeout thread from firing)
        |
        v
Child stdout closes (EOF)
        |
        v
Stdout reader thread detects EOF
        |
        +--- Flush text batcher (emit remaining text)
        |
        +--- Exit reader loop
        |
        v
Event Emitter: emit Aborted event
        |
        v
Frontend receives Aborted event
        |
        +--- chatStore.markAborted(agentId)
        |       - Set message.streaming = false
        |       - Set message.status = "aborted"
        |
        +--- Remove streaming cursor animation
        |
        +--- Append "[Response cancelled]" label
        |
        +--- Re-enable input bar
        |
        v
Agent status: Idle (ready for next task)
```

The abort is immediate. There is no grace period for user-initiated cancellation (unlike timeout-triggered kills on Unix, which send SIGTERM first). The rationale is that the user expects instant feedback when clicking Stop.

### Tauri Command

```rust
#[tauri::command]
async fn stop_agent(
    state: tauri::State<'_, AgentManagerState>,
    agent_id: String,
) -> Result<(), String> {
    let mut manager = state.lock().map_err(|e| e.to_string())?;
    manager.spawner.abort(&AgentId(agent_id))
        .map_err(|e| e.to_string())
}
```

---

## Error Scenarios

| Scenario | Detection | Recovery |
|---|---|---|
| Invalid JSON line | `serde_json::from_str` returns `Err` | Skip line, log warning at debug level. Stream continues. |
| Process crash | `child.wait()` returns non-zero exit code | Emit `Error` event with exit code and last stderr line. Set agent status to Error. |
| Timeout | Timer thread fires before `completed` flag is set | Kill process, emit `Error("Agent timed out after N seconds")`. Set agent status to Error. |
| Empty output | Process exits with zero exit code but no `content_block_delta` events received | Emit `Error("No response received from Claude CLI")`. |
| CLI not found | `Command::spawn` returns `ErrorKind::NotFound` | Emit `Error("Claude CLI not found")`. Do not attempt restart. |
| Broken pipe (stdin) | `write_all` to stdin returns `Err` | Emit `Error("Failed to send message to Claude CLI")`. Kill process. |
| Non-UTF-8 stdout | Byte sequence fails UTF-8 validation | `String::from_utf8_lossy` replaces invalid bytes with the Unicode replacement character. Parsing continues. |
| Network error in CLI | Claude CLI writes error JSON to stdout, exits non-zero | Parse error message from stderr, emit `Error` event. |

### Error Event Rendering

Errors are displayed in two places:

1. **Chat message** -- the current assistant message is marked with an error state and displays the error text inline.
2. **Toast notification** -- a Sonner toast appears at the top of the viewport with the error summary. The toast auto-dismisses after 5 seconds.

---

## Message Accumulation

For the chat UI, streaming text events are accumulated into a single assistant message object. The message transitions through three states during its lifecycle.

### Message States

```
             Text event received
                    |
                    v
+----------+    +------------+    Done/Error/Aborted
|  pending  |--->| streaming  |------------------------+
+----------+    +------------+                         |
                    |   ^                              v
                    |   |                        +-----------+
                    +---+                        | complete  |
                 (more Text events)              +-----------+
```

| State | `streaming` flag | `status` field | Input bar |
|---|---|---|---|
| pending | `true` | `"pending"` | Disabled |
| streaming | `true` | `"streaming"` | Disabled (Stop button visible) |
| complete | `false` | `"done"` / `"error"` / `"aborted"` | Enabled |

### Accumulation Logic (chatStore)

```typescript
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming: boolean;
  status: "pending" | "streaming" | "done" | "error" | "aborted";
  toolExecutions: ToolExecution[];
  cost: number | null;
  tokens: { input: number; output: number } | null;
}

// Called on each Text event.
function appendText(agentId: string, text: string): void {
  const message = getCurrentStreamingMessage(agentId);
  message.content += text;
  message.status = "streaming";
}

// Called on Done event.
function markComplete(agentId: string): void {
  const message = getCurrentStreamingMessage(agentId);
  message.streaming = false;
  message.status = "done";
}

// Called on Error event.
function markError(agentId: string, errorMessage: string): void {
  const message = getCurrentStreamingMessage(agentId);
  message.streaming = false;
  message.status = "error";
  message.content += `\n\n[Error: ${errorMessage}]`;
}

// Called on Aborted event.
function markAborted(agentId: string): void {
  const message = getCurrentStreamingMessage(agentId);
  message.streaming = false;
  message.status = "aborted";
}
```

### Rendering

The chat view renders the message content using a Markdown renderer. While `streaming` is `true`, a blinking cursor is appended after the last character. Tool execution blocks are rendered inline between text segments in the order they appear in the stream.

---

## Comparison with Agentrooms

Agentrooms is a web-based multi-agent workspace that also wraps the Claude CLI. Both projects parse the same NDJSON output format, but differ in transport.

| Aspect | Zentral | Agentrooms |
|---|---|---|
| Runtime | Tauri v2 (desktop) | Node.js + browser (web) |
| Transport | Tauri IPC events (`app_handle.emit`) | HTTP NDJSON streaming (`fetch` + `ReadableStream`) |
| Proxy layer | None. Rust reads stdout directly. | Express server acts as SSE/NDJSON proxy between CLI and browser. |
| Frontend consumption | `listen()` from `@tauri-apps/api/event` | `getReader().read()` on a `ReadableStream` |
| Backpressure | Handled internally by Tauri event queue | Handled by HTTP chunked transfer encoding |
| Abort | `invoke("stop_agent")` kills child process | HTTP request cancellation via `AbortController` |
| Latency | Lower (no HTTP overhead, no serialization to HTTP response) | Higher (HTTP framing, SSE parsing) |
| Complexity | Simpler (no HTTP server, no CORS, no port management) | More complex (server process, port allocation, CORS config) |

The key advantage of the Tauri approach is the elimination of the HTTP layer. Events flow directly from the Rust backend to the webview without serialization to an HTTP response, parsing SSE frames, or managing fetch lifecycle. The frontend code is simpler because `listen()` provides a callback-based API rather than requiring manual stream reader loops.

---

## References

- [Agent Spawner](./agent-spawner.md) -- process lifecycle, stdout/stderr piping, NDJSON parsing, and buffer management
- [Agent Manager](./agent-manager.md) -- orchestration layer that dispatches messages to the spawner
- [Secretary Agent](./secretary-agent.md) -- routing authority that decides which agent handles a message
- [Skill Pool](./skill-pool.md) -- skill definitions injected into agent system prompts
- [tailclaude-bridge](../../tailclaude-bridge/) -- reference HTTP-based NDJSON streaming implementation
