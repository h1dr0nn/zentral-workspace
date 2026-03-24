# Testing Strategy

> Testing approach for Zentral, covering every layer from Rust unit tests through frontend component tests to full end-to-end scenarios.

> **Status:** draft
> **Last updated:** 2026-03-24

---

## Overview

Zentral follows the classic testing pyramid. The bulk of coverage comes from
fast, isolated unit tests. Integration tests verify cross-module behavior with
realistic (but mocked) external dependencies. E2E tests are reserved for
critical user journeys and run only in CI release pipelines.

```
            /  E2E  \            ~5 tests   (minutes)
           /----------\
          / Integration \        ~30 tests  (seconds)
         /----------------\
        /    Unit Tests     \    ~200 tests (milliseconds)
       /______________________\
```

Rationale:

- Unit tests are cheap to write, fast to run, and pinpoint failures precisely.
- Integration tests catch wiring bugs that unit tests miss, at moderate cost.
- E2E tests prove the full stack works but are slow and brittle, so the count
  stays low.

## Rust Unit Tests

All Rust unit tests live alongside the code they exercise, inside `#[cfg(test)]`
modules. Run the full suite with:

```bash
cargo test
```

### Agent Manager

Tests cover the complete lifecycle of agent instances.

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn create_agent_assigns_unique_id() {
        let mgr = AgentManager::new_test();
        let agent = mgr.create_agent("helper", "/tmp/project").await.unwrap();
        assert!(!agent.id.is_empty());
    }

    #[tokio::test]
    async fn delete_agent_removes_from_registry() {
        let mgr = AgentManager::new_test();
        let agent = mgr.create_agent("helper", "/tmp/project").await.unwrap();
        mgr.delete_agent(&agent.id).await.unwrap();
        assert!(mgr.get_agent(&agent.id).is_none());
    }

    #[tokio::test]
    async fn start_stop_lifecycle() {
        let mgr = AgentManager::new_test();
        let agent = mgr.create_agent("helper", "/tmp/project").await.unwrap();
        mgr.start_agent(&agent.id).await.unwrap();
        assert_eq!(mgr.get_agent(&agent.id).unwrap().status, AgentStatus::Running);
        mgr.stop_agent(&agent.id).await.unwrap();
        assert_eq!(mgr.get_agent(&agent.id).unwrap().status, AgentStatus::Stopped);
    }

    #[tokio::test]
    async fn stop_already_stopped_agent_is_noop() {
        let mgr = AgentManager::new_test();
        let agent = mgr.create_agent("helper", "/tmp/project").await.unwrap();
        // Agent starts in Stopped state; stopping again should not error.
        mgr.stop_agent(&agent.id).await.unwrap();
    }
}
```

### Skill Pool

CRUD operations, assignment to agents, and validation of skill definitions.

```rust
#[test]
fn create_skill_with_valid_definition() {
    let pool = SkillPool::new();
    let skill = pool.create("summarize", "Summarize a file").unwrap();
    assert_eq!(skill.name, "summarize");
}

#[test]
fn duplicate_skill_name_returns_error() {
    let pool = SkillPool::new();
    pool.create("summarize", "Summarize a file").unwrap();
    assert!(pool.create("summarize", "Another").is_err());
}

#[test]
fn assign_skill_to_agent() {
    let pool = SkillPool::new();
    let skill = pool.create("summarize", "Summarize a file").unwrap();
    pool.assign(&skill.id, "agent-001").unwrap();
    let assigned = pool.skills_for_agent("agent-001");
    assert_eq!(assigned.len(), 1);
}

#[test]
fn delete_skill_unassigns_from_agents() {
    let pool = SkillPool::new();
    let skill = pool.create("summarize", "Summarize a file").unwrap();
    pool.assign(&skill.id, "agent-001").unwrap();
    pool.delete(&skill.id).unwrap();
    assert!(pool.skills_for_agent("agent-001").is_empty());
}
```

### Secretary (Routing and Execution Plans)

The secretary module parses user intent and routes messages to the correct
agent. Tests verify both the routing logic and execution plan parsing.

```rust
#[test]
fn route_direct_mention_to_named_agent() {
    let router = Secretary::new(mock_agent_registry());
    let plan = router.route("@helper summarize README.md").unwrap();
    assert_eq!(plan.target_agent, "helper");
    assert_eq!(plan.message, "summarize README.md");
}

#[test]
fn route_without_mention_uses_default_agent() {
    let router = Secretary::new(mock_agent_registry());
    let plan = router.route("what files changed today?").unwrap();
    assert_eq!(plan.target_agent, "default");
}

#[test]
fn parse_execution_plan_with_multiple_steps() {
    let raw = r#"{"steps":[{"action":"read","path":"src/main.rs"},{"action":"summarize"}]}"#;
    let plan = ExecutionPlan::parse(raw).unwrap();
    assert_eq!(plan.steps.len(), 2);
}

#[test]
fn malformed_plan_returns_parse_error() {
    let raw = r#"{"steps": broken}"#;
    assert!(ExecutionPlan::parse(raw).is_err());
}
```

### Persistence (SQLite)

All persistence tests use `tempfile::TempDir` so each test gets an isolated
database that is cleaned up automatically.

```rust
#[test]
fn insert_and_retrieve_agent() {
    let dir = tempfile::tempdir().unwrap();
    let db = Database::open(dir.path().join("test.db")).unwrap();
    let agent = AgentRow { id: "a1".into(), name: "helper".into(), status: "stopped".into() };
    db.insert_agent(&agent).unwrap();
    let loaded = db.get_agent("a1").unwrap().unwrap();
    assert_eq!(loaded.name, "helper");
}

#[test]
fn update_agent_status() {
    let dir = tempfile::tempdir().unwrap();
    let db = Database::open(dir.path().join("test.db")).unwrap();
    let agent = AgentRow { id: "a1".into(), name: "helper".into(), status: "stopped".into() };
    db.insert_agent(&agent).unwrap();
    db.update_agent_status("a1", "running").unwrap();
    let loaded = db.get_agent("a1").unwrap().unwrap();
    assert_eq!(loaded.status, "running");
}

#[test]
fn delete_agent_cascade_removes_messages() {
    let dir = tempfile::tempdir().unwrap();
    let db = Database::open(dir.path().join("test.db")).unwrap();
    db.insert_agent(&AgentRow { id: "a1".into(), name: "h".into(), status: "stopped".into() }).unwrap();
    db.insert_message("a1", "hello").unwrap();
    db.delete_agent("a1").unwrap();
    assert!(db.messages_for_agent("a1").unwrap().is_empty());
}

#[test]
fn missing_agent_returns_none() {
    let dir = tempfile::tempdir().unwrap();
    let db = Database::open(dir.path().join("test.db")).unwrap();
    assert!(db.get_agent("nonexistent").unwrap().is_none());
}
```

### Streaming Parser (NDJSON)

Claude CLI outputs newline-delimited JSON. The streaming parser must handle
partial lines, buffer boundaries, and malformed input gracefully.

```rust
#[test]
fn parse_single_complete_line() {
    let mut parser = NdjsonParser::new();
    let events = parser.feed(b"{\"type\":\"text\",\"content\":\"hello\"}\n");
    assert_eq!(events.len(), 1);
    assert_eq!(events[0].content, "hello");
}

#[test]
fn parse_multiple_lines_in_one_chunk() {
    let mut parser = NdjsonParser::new();
    let data = b"{\"type\":\"text\",\"content\":\"a\"}\n{\"type\":\"text\",\"content\":\"b\"}\n";
    let events = parser.feed(data);
    assert_eq!(events.len(), 2);
}

#[test]
fn buffer_incomplete_line_across_chunks() {
    let mut parser = NdjsonParser::new();
    let events1 = parser.feed(b"{\"type\":\"tex");
    assert!(events1.is_empty());
    let events2 = parser.feed(b"t\",\"content\":\"hello\"}\n");
    assert_eq!(events2.len(), 1);
}

#[test]
fn skip_malformed_line_and_continue() {
    let mut parser = NdjsonParser::new();
    let data = b"not json\n{\"type\":\"text\",\"content\":\"ok\"}\n";
    let events = parser.feed(data);
    assert_eq!(events.len(), 1);
    assert_eq!(events[0].content, "ok");
}

#[test]
fn empty_input_produces_no_events() {
    let mut parser = NdjsonParser::new();
    assert!(parser.feed(b"").is_empty());
}
```

### Telegram Module

Message parsing and command handling are tested with mocked HTTP responses.
No real Telegram API calls are made in unit tests.

```rust
#[test]
fn parse_text_message() {
    let json = r#"{"message":{"text":"/ask what is Rust?","chat":{"id":123}}}"#;
    let update: TelegramUpdate = serde_json::from_str(json).unwrap();
    assert_eq!(update.message.unwrap().text, "/ask what is Rust?");
}

#[test]
fn extract_command_and_payload() {
    let (cmd, payload) = parse_command("/ask what is Rust?");
    assert_eq!(cmd, "ask");
    assert_eq!(payload, "what is Rust?");
}

#[test]
fn plain_message_has_no_command() {
    let (cmd, payload) = parse_command("just a message");
    assert_eq!(cmd, "");
    assert_eq!(payload, "just a message");
}

#[tokio::test]
async fn send_message_calls_correct_endpoint() {
    let mut server = mockito::Server::new_async().await;
    let mock = server.mock("POST", "/bot123:TOKEN/sendMessage")
        .with_status(200)
        .with_body(r#"{"ok":true}"#)
        .create_async().await;

    let client = TelegramClient::new("123:TOKEN", &server.url());
    client.send_message(456, "hello").await.unwrap();
    mock.assert_async().await;
}
```

## Rust Integration Tests

Integration tests live in `src-tauri/tests/` and exercise multiple modules
together. They require a mock Claude CLI to simulate real agent interactions.

Run integration tests with:

```bash
cargo test --test integration
```

### Full Agent Lifecycle

```rust
#[tokio::test]
async fn agent_send_receive_lifecycle() {
    let mock_cli = MockClaudeCli::start().await;
    let app = TestApp::new_with_cli(mock_cli.path()).await;

    // Create agent
    let agent_id = app.create_agent("helper", "/tmp/project").await.unwrap();

    // Start agent
    app.start_agent(&agent_id).await.unwrap();

    // Send message and receive response
    let response = app.send_message(&agent_id, "hello").await.unwrap();
    assert!(!response.content.is_empty());

    // Stop agent
    app.stop_agent(&agent_id).await.unwrap();
    assert_eq!(app.agent_status(&agent_id).await, AgentStatus::Stopped);
}
```

### Project Switching with CWD Update

```rust
#[tokio::test]
async fn project_switch_updates_agent_cwd() {
    let mock_cli = MockClaudeCli::start().await;
    let app = TestApp::new_with_cli(mock_cli.path()).await;

    let agent_id = app.create_agent("helper", "/tmp/project-a").await.unwrap();
    app.switch_project(&agent_id, "/tmp/project-b").await.unwrap();

    let agent = app.get_agent(&agent_id).await.unwrap();
    assert_eq!(agent.cwd, "/tmp/project-b");
}
```

### Telegram Bot Start/Stop Cycle

```rust
#[tokio::test]
async fn telegram_bot_start_stop() {
    let mock_server = mockito::Server::new_async().await;
    // Mock getUpdates to return empty array
    mock_server.mock("POST", mockito::Matcher::Regex(r"/getUpdates".into()))
        .with_body(r#"{"ok":true,"result":[]}"#)
        .create_async().await;

    let bot = TelegramBot::new("fake:token", &mock_server.url());
    bot.start().await.unwrap();
    tokio::time::sleep(Duration::from_millis(100)).await;
    bot.stop().await.unwrap();
}
```

## Frontend Unit Tests

Frontend tests use Vitest as the test runner and `@testing-library/react` for
component rendering. Run with:

```bash
pnpm test
```

### Zustand Store Tests

Store tests verify state transitions without rendering any components.

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { useAgentStore } from "../stores/agentStore";

describe("agentStore", () => {
  beforeEach(() => {
    useAgentStore.setState({ agents: [], selectedAgentId: null });
  });

  it("adds an agent to the list", () => {
    useAgentStore.getState().addAgent({ id: "a1", name: "helper", status: "stopped" });
    expect(useAgentStore.getState().agents).toHaveLength(1);
  });

  it("selects an agent by id", () => {
    useAgentStore.getState().addAgent({ id: "a1", name: "helper", status: "stopped" });
    useAgentStore.getState().selectAgent("a1");
    expect(useAgentStore.getState().selectedAgentId).toBe("a1");
  });

  it("removes an agent and clears selection if it was selected", () => {
    useAgentStore.getState().addAgent({ id: "a1", name: "helper", status: "stopped" });
    useAgentStore.getState().selectAgent("a1");
    useAgentStore.getState().removeAgent("a1");
    expect(useAgentStore.getState().agents).toHaveLength(0);
    expect(useAgentStore.getState().selectedAgentId).toBeNull();
  });
});
```

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { useChatStore } from "../stores/chatStore";

describe("chatStore", () => {
  beforeEach(() => {
    useChatStore.setState({ messages: [], streaming: false });
  });

  it("appends a user message", () => {
    useChatStore.getState().addMessage({ role: "user", content: "hello" });
    expect(useChatStore.getState().messages).toHaveLength(1);
  });

  it("sets streaming flag during assistant response", () => {
    useChatStore.getState().setStreaming(true);
    expect(useChatStore.getState().streaming).toBe(true);
  });
});
```

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { useProjectStore } from "../stores/projectStore";

describe("projectStore", () => {
  beforeEach(() => {
    useProjectStore.setState({ projects: [], activeProjectId: null });
  });

  it("adds a project", () => {
    useProjectStore.getState().addProject({ id: "p1", name: "my-app", path: "/home/user/my-app" });
    expect(useProjectStore.getState().projects).toHaveLength(1);
  });

  it("switches active project", () => {
    useProjectStore.getState().addProject({ id: "p1", name: "my-app", path: "/home/user/my-app" });
    useProjectStore.getState().setActiveProject("p1");
    expect(useProjectStore.getState().activeProjectId).toBe("p1");
  });
});
```

### Component Render Tests

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AgentCard } from "../components/AgentCard";

describe("AgentCard", () => {
  it("renders agent name and status", () => {
    render(<AgentCard agent={{ id: "a1", name: "helper", status: "running" }} />);
    expect(screen.getByText("helper")).toBeDefined();
    expect(screen.getByText("running")).toBeDefined();
  });

  it("shows stop button when agent is running", () => {
    render(<AgentCard agent={{ id: "a1", name: "helper", status: "running" }} />);
    expect(screen.getByRole("button", { name: /stop/i })).toBeDefined();
  });
});
```

### Hook Tests

```typescript
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAgentEvents } from "../hooks/useAgentEvents";

describe("useAgentEvents", () => {
  it("subscribes to events on mount and unsubscribes on unmount", () => {
    const subscribe = vi.fn(() => vi.fn());
    const { unmount } = renderHook(() => useAgentEvents(subscribe));
    expect(subscribe).toHaveBeenCalledOnce();
    unmount();
    // The unsubscribe function returned by subscribe should have been called.
  });
});
```

## E2E Tests

End-to-end tests verify the full application stack from the UI down through
Tauri commands to the Rust backend. Because they are slow and require a built
application binary, they run only on the release branch in CI.

### Framework

Zentral uses Playwright with the Tauri WebDriver adapter. The test binary is
built with `cargo tauri build --debug` and launched by Playwright before each
test suite.

### Scenarios

| Scenario | Steps | Expected outcome |
|----------|-------|------------------|
| App launch | Start app | Main window appears, no crashes |
| Add project | Click "Add Project", select directory | Project appears in sidebar |
| Create agent | Open agent panel, click "New Agent" | Agent card appears with "stopped" status |
| Send message | Select agent, type message, press Enter | Response streams into chat view |
| Full cycle | Create agent, send message, verify response, stop agent | Agent returns to "stopped" |

### Running E2E Tests

```bash
# Build the debug binary first
cargo tauri build --debug

# Run Playwright tests
pnpm exec playwright test --project=tauri
```

## Mocking the Claude CLI

Integration tests and CI pipelines must not call the real Claude CLI. Instead,
a mock script accepts the same flags and outputs predefined NDJSON responses.

### Mock Script (Bash)

Save as `tests/fixtures/mock-claude.sh` and make it executable.

```bash
#!/usr/bin/env bash
# mock-claude.sh — Drop-in replacement for `claude` CLI in tests.
# Accepts the same flags; outputs canned NDJSON to stdout.

set -euo pipefail

RESUME_ID=""
PROMPT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --resume) RESUME_ID="$2"; shift 2 ;;
    --output-format) shift 2 ;;  # consume but ignore
    -p|--print) PROMPT="$2"; shift 2 ;;
    *) PROMPT="$1"; shift ;;
  esac
done

# Emit a realistic NDJSON stream
cat <<'NDJSON'
{"type":"assistant","message":{"id":"msg_mock","type":"message","role":"assistant","content":[],"model":"claude-sonnet-4-20250514","stop_reason":null}}
{"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}
{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello from the mock CLI."}}
{"type":"content_block_stop","index":0}
{"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":8}}
{"type":"result","subtype":"success","session_id":"session_mock","cost_usd":0.001,"duration_ms":50,"duration_api_ms":40,"is_error":false,"num_turns":1}
NDJSON
```

### Mock Script (Python)

For environments where bash is unavailable (Windows CI without Git Bash).

```python
#!/usr/bin/env python3
"""mock_claude.py — Mock Claude CLI for tests."""
import sys
import json

RESPONSES = [
    {"type": "assistant", "message": {"id": "msg_mock", "role": "assistant", "content": [], "model": "claude-sonnet-4-20250514", "stop_reason": None}},
    {"type": "content_block_start", "index": 0, "content_block": {"type": "text", "text": ""}},
    {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": "Hello from the mock CLI."}},
    {"type": "content_block_stop", "index": 0},
    {"type": "message_delta", "delta": {"stop_reason": "end_turn"}, "usage": {"output_tokens": 8}},
    {"type": "result", "subtype": "success", "session_id": "session_mock", "cost_usd": 0.001, "duration_ms": 50, "duration_api_ms": 40, "is_error": False, "num_turns": 1},
]

for line in RESPONSES:
    print(json.dumps(line), flush=True)
```

### Using the Mock in Tests

```rust
struct MockClaudeCli {
    path: PathBuf,
}

impl MockClaudeCli {
    async fn start() -> Self {
        let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("tests/fixtures/mock-claude.sh");
        // Ensure the script is executable (Unix)
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = std::fs::metadata(&path).unwrap().permissions();
            perms.set_mode(0o755);
            std::fs::set_permissions(&path, perms).unwrap();
        }
        Self { path }
    }

    fn path(&self) -> &Path {
        &self.path
    }
}
```

## CI Integration

The CI pipeline runs on every push and pull request. E2E tests run only on the
release branch to keep feedback fast on feature branches.

```yaml
# .github/workflows/ci.yml (excerpt)
jobs:
  test-rust:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - name: Run Rust unit tests
        run: cargo test --manifest-path src-tauri/Cargo.toml
      - name: Run Rust integration tests
        run: cargo test --manifest-path src-tauri/Cargo.toml --test integration

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - name: Run frontend tests
        run: pnpm test -- --run

  e2e:
    if: github.ref == 'refs/heads/release'
    needs: [test-rust, test-frontend]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: cargo tauri build --debug
      - name: Run E2E tests
        run: pnpm exec playwright test --project=tauri
```

## Coverage

### Rust Coverage

Use `cargo-tarpaulin` to measure line coverage of Rust code.

```bash
# Install once
cargo install cargo-tarpaulin

# Run coverage
cargo tarpaulin --manifest-path src-tauri/Cargo.toml --out html --output-dir coverage/rust
```

### Frontend Coverage

Vitest has built-in coverage support via `v8` or `istanbul`.

```bash
pnpm test -- --run --coverage
```

### Coverage Configuration

```typescript
// vite.config.ts (test section)
export default defineConfig({
  test: {
    environment: "jsdom",
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "coverage/frontend",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.d.ts", "src/main.tsx"],
    },
  },
});
```

### Targets

| Layer | Tool | Minimum target |
|-------|------|----------------|
| Rust | cargo-tarpaulin | 60% line coverage |
| Frontend | vitest --coverage | 60% line coverage |

Coverage reports are generated in CI and uploaded as artifacts. The thresholds
are enforced as warnings for now; they will become hard gates once the codebase
stabilizes past the initial development phase.

## References

- [Vitest documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [cargo-tarpaulin](https://github.com/xd009642/tarpaulin)
- [Playwright with Tauri](https://tauri.app/develop/tests/)
- [mockito crate](https://docs.rs/mockito)
- [tempfile crate](https://docs.rs/tempfile)
