# Claude CLI Internals

> This document covers the technical details of the Claude Code CLI that are relevant for spawning, managing, and parsing output from Claude processes within Zentral.

> **Status:** draft
> **Last updated:** 2026-03-24

---

## Overview

Claude Code CLI is distributed as an npm package.

### Global npm Install

```bash
npm install -g @anthropic-ai/claude-code
```

After installation the `claude` binary is available on the system PATH. Verify with:

```bash
claude --version
```

### Binary Location

On most systems the binary resolves to the npm global bin directory:

- Linux/macOS: `~/.npm-global/bin/claude` or `/usr/local/bin/claude`
- Windows: `%APPDATA%\npm\claude.cmd`

Zentral should resolve the binary path at startup using `which claude` (Unix) or `where claude` (Windows) and cache the result.

## Key CLI Flags

The following flags are used by Zentral when spawning Claude processes.

| Flag | Purpose | Example |
|------|---------|---------|
| `-p` | Prompt mode (non-interactive, single turn) | `claude -p "explain this error"` |
| `--resume <id>` | Continue an existing session by ID | `claude --resume abc123 -p "next step"` |
| `--output-format stream-json` | Emit NDJSON streaming output to stdout | Required for real-time UI updates |
| `--system-prompt <text>` | Override the system prompt | Agent role and skill injection |
| `--verbose` | Enable verbose output with additional event types | Debugging and detailed logging |
| `--model <name>` | Select which Claude model to use | `claude -p --model claude-sonnet-4-6 "hello"` |
| `--allowedTools <list>` | Restrict which tools the agent can use | `claude -p --allowedTools "Read,Write,Bash"` |
| `--max-turns <n>` | Limit the number of agentic turns | `claude -p --max-turns 10 "refactor this"` |

### Combining Flags for Zentral

A typical Zentral agent spawn command looks like:

```bash
claude -p \
  --output-format stream-json \
  --system-prompt "You are a backend specialist. Focus on Rust code." \
  --model claude-sonnet-4-6 \
  --max-turns 20 \
  --allowedTools "Read,Write,Bash,Grep,Glob" \
  "Implement the session persistence layer"
```

For resuming a previous session:

```bash
claude --resume ses_abc123def456 \
  -p \
  --output-format stream-json \
  "Continue with the database migration"
```

## NDJSON Output Format

When `--output-format stream-json` is specified, Claude CLI emits newline-delimited JSON objects to stdout. Each line is a self-contained JSON object with a `type` field.

### Message Type: system

Emitted once at the start of a session. Contains the session ID needed for `--resume`.

```json
{
  "type": "system",
  "subtype": "init",
  "session_id": "ses_abc123def456",
  "tools": ["Read", "Write", "Bash", "Grep", "Glob"],
  "model": "claude-sonnet-4-6"
}
```

### Message Type: assistant

Emitted when the assistant produces a complete message. Contains an array of content blocks.

```json
{
  "type": "assistant",
  "message": {
    "id": "msg_01XYZ",
    "role": "assistant",
    "content": [
      {
        "type": "text",
        "text": "I'll start by reading the configuration file."
      },
      {
        "type": "tool_use",
        "id": "toolu_01ABC",
        "name": "Read",
        "input": {
          "file_path": "/home/user/project/config.toml"
        }
      }
    ],
    "model": "claude-sonnet-4-6",
    "stop_reason": "tool_use"
  }
}
```

### Message Type: content_block_delta

Emitted during streaming for incremental text updates. Zentral uses these to update the UI in real time.

```json
{
  "type": "content_block_delta",
  "index": 0,
  "delta": {
    "type": "text_delta",
    "text": "Let me analyze "
  }
}
```

### Message Type: result

Emitted once at the end of a completed run. Contains the final text, cost information, and usage statistics.

```json
{
  "type": "result",
  "subtype": "success",
  "session_id": "ses_abc123def456",
  "result": "I've completed the refactoring. The changes include...",
  "cost_usd": 0.0342,
  "duration_ms": 14520,
  "duration_api_ms": 12800,
  "num_turns": 5,
  "usage": {
    "input_tokens": 12450,
    "output_tokens": 3200,
    "cache_read_input_tokens": 8000,
    "cache_creation_input_tokens": 4000
  }
}
```

### Parsing Strategy

Zentral reads stdout line by line. Each line is parsed as JSON and dispatched by type:

1. `system` -- store the `session_id` for future `--resume` calls.
2. `assistant` -- iterate over `content` blocks. Render text blocks in the UI and display tool use blocks as activity indicators.
3. `content_block_delta` -- append `delta.text` to the current text block for real-time streaming display.
4. `result` -- mark the agent as idle, record cost and usage in the database.

## Session Files

Claude CLI persists session data to disk so that conversations can be resumed.

### Storage Location

Sessions are stored under the user's home directory:

- Linux/macOS: `~/.claude/sessions/`
- Windows: `%USERPROFILE%\.claude\sessions\`

Each session is stored as a directory named by session ID containing JSONL message logs.

### How Resume Works

When `--resume <session_id>` is passed, Claude CLI:

1. Loads the message history from the session directory.
2. Reconstructs the conversation context including all previous tool uses and results.
3. Appends the new prompt (from `-p`) as a user message.
4. Continues the conversation with full context.

This is how Zentral maintains long-running agent conversations across multiple invocations without re-sending the entire history.

### Session ID Management

Zentral must store the `session_id` from the initial `system` message in its SQLite database, associated with the agent and project. This mapping enables:

- Resuming agent conversations after Zentral restarts.
- Displaying session history in the UI.
- Tracking cost per session and per agent.

## Authentication

Claude CLI requires authentication to call the Anthropic API.

### API Key

The simplest method. Set the environment variable before spawning the process:

```bash
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx claude -p "hello"
```

Zentral stores the API key in its encrypted configuration and injects it into the environment of each spawned Claude process. The key is never written to disk in plaintext outside the config store.

### OAuth Credentials

Claude CLI also supports OAuth-based authentication via a credentials file:

- Location: `~/.claude-credentials.json`
- Used by Agentrooms and some CI/CD setups.
- Contains access tokens that refresh automatically.

For Zentral, the API key approach is recommended because:

- It is simpler to manage programmatically.
- It avoids dependency on browser-based OAuth flows.
- It works in headless and remote environments.
- Each agent can use a different key if needed for billing isolation.

## Rate Limits

Anthropic enforces rate limits based on API tier. These directly affect how many concurrent agents Zentral can run.

### Tier Limits

| Tier | Requests/min | Input tokens/min | Output tokens/min |
|------|-------------|-------------------|-------------------|
| Free | 5 | 20,000 | 4,000 |
| Build (Tier 1) | 50 | 40,000 | 8,000 |
| Build (Tier 2) | 1,000 | 80,000 | 16,000 |
| Build (Tier 3) | 2,000 | 160,000 | 32,000 |
| Build (Tier 4) | 4,000 | 400,000 | 80,000 |
| Scale | Custom | Custom | Custom |

Note: These limits are approximate and subject to change. Check the Anthropic documentation for current values.

### Impact on Concurrent Agents

Each agent turn consumes one request and some amount of input and output tokens. With three concurrent agents on a Tier 1 key, the effective limit is roughly 16 requests per minute per agent, which is sufficient for most workflows.

Zentral should implement:

- A request queue that respects rate limits across all agents sharing a key.
- Backoff logic when 429 (rate limit) responses are received.
- Per-agent rate tracking visible in the UI so users can see which agents are consuming their quota.

## Cost Tracking

The `result` message includes a `cost_usd` field that represents the total API cost for that run.

### Per-Agent Cost Accounting

Zentral stores each `result` message's cost data in SQLite:

```json
{
  "agent_id": "backend-specialist",
  "session_id": "ses_abc123def456",
  "cost_usd": 0.0342,
  "input_tokens": 12450,
  "output_tokens": 3200,
  "timestamp": "2026-03-24T10:30:00Z"
}
```

This enables:

- Per-agent spending dashboards.
- Project-level cost aggregation.
- Budget alerts when spending exceeds a configured threshold.
- Historical cost trends for capacity planning.

### Cache Tokens

The `usage` object distinguishes between `cache_read_input_tokens` and `cache_creation_input_tokens`. Cached reads are cheaper than fresh input tokens. Zentral should display cache hit rates to help users understand cost efficiency.

## Limitations

### Context Window

Each Claude session has a finite context window (typically 200K tokens). Long-running agent sessions will eventually hit this limit. When context is exhausted, the session must be summarized and a new session started. Zentral should monitor token usage from `result` messages and warn users when a session approaches the limit.

### One Process Per Conversation

Each Claude CLI process handles exactly one conversation thread. There is no multiplexing. To run three agents concurrently, Zentral must spawn three separate processes. This is by design and simplifies isolation, but means process management overhead scales linearly with agent count.

### No Cross-Session Context Sharing

Claude sessions are fully isolated. Agent A cannot read Agent B's conversation history through the CLI. Any context sharing between agents must be orchestrated by Zentral's secretary, which extracts relevant information from one agent's output and injects it into another agent's prompt.

### stdin Behavior in Prompt Mode

When using `-p` mode, Claude CLI reads the prompt from the `-p` argument and begins processing. However, stdin must be closed (or piped from `/dev/null`) to signal that no further interactive input will arrive. Failure to close stdin can cause the process to hang.

```bash
echo "" | claude -p --output-format stream-json "your prompt here"
```

Or when spawning from Rust:

```bash
# Pseudocode for Tauri/Rust
let child = Command::new("claude")
    .args(["-p", "--output-format", "stream-json", prompt])
    .stdin(Stdio::null())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .spawn();
```

### Process Lifecycle

Claude CLI processes can run for extended periods during complex agentic tasks. Zentral must handle:

- Graceful shutdown by sending SIGTERM and waiting for the process to finish its current turn.
- Forced termination with SIGKILL after a timeout if SIGTERM is not respected.
- Orphan process cleanup on application exit.
- Crash recovery by checking for running Claude processes on startup.

## References

- [Competitor Analysis](./competitor-analysis.md)
- [Agent Adapters Specification](../03-specifications/agent-adapters.md)
- [Agent Detection Specification](../03-specifications/agent-detection.md)
- [System Architecture](../02-architecture/system-architecture.md)
- [Session Management Specification](../03-specifications/session-management.md)
