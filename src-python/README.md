# src-python — Dev & Test Utilities

Python scripts for testing and debugging Zentral during development. These are **not** production code — they simulate backend components so you can develop and test individual subsystems in isolation.

## Setup

```bash
cd src-python
python -m venv .venv
.venv/Scripts/activate   # Windows
# source .venv/bin/activate  # Linux/macOS
pip install -r requirements.txt
```

Requires Python 3.12+.

---

## Scripts

### mock_claude_cli.py

Drop-in replacement for the real `claude` binary. Streams NDJSON on stdout matching the exact protocol from the streaming-protocol spec. Use it to test the Rust agent spawner and streaming parser without a Claude API key.

```bash
# Basic echo mode
echo "hello" | python mock_claude_cli.py -p --output-format stream-json

# Simulated lorem ipsum response with 50ms delay between chunks
echo "explain rust" | python mock_claude_cli.py -p --output-format stream-json --mock-mode lorem

# Simulate a tool invocation (Read file)
echo "read main.rs" | python mock_claude_cli.py -p --output-format stream-json --mock-mode tool_use

# Simulate CLI error (exits with code 1)
echo "fail" | python mock_claude_cli.py -p --output-format stream-json --mock-mode error

# Hang indefinitely (test timeout handling)
echo "hang" | python mock_claude_cli.py -p --output-format stream-json --mock-mode timeout
```

**Modes:** `echo` (default), `lorem`, `code`, `error`, `timeout`, `tool_use`

**Integration with Zentral:** Point the Rust spawner's `cli_path` to `python src-python/mock_claude_cli.py` instead of `claude`.

**Zero external dependencies** — uses only the Python standard library.

---

### stream_validator.py

Validates that Claude CLI NDJSON output conforms to the expected streaming protocol. Catches malformed JSON, missing fields, incorrect event sequencing, and type mismatches.

```bash
# Pipe real or mock CLI output
echo "test" | python mock_claude_cli.py -p --output-format stream-json | python stream_validator.py

# Validate a saved capture file
python stream_validator.py --replay captured_output.ndjson

# Strict mode — exits with code 1 on any error (useful in CI)
python stream_validator.py --strict --replay output.ndjson

# Generate a valid example stream for reference
python stream_validator.py --generate > example.ndjson
```

**Checks performed:**

- Valid JSON on every line
- `type` field present on every event
- Correct event sequence: `system` first, `result` last
- Required fields per event type (`content_block_delta` has `delta.text`, etc.)
- Content block lifecycle: `start` before deltas, `stop` after
- Prints summary stats: event counts, total text length, tokens, cost, session ID

---

### db_inspector.py

Interactive CLI for inspecting, seeding, and managing the `zentral.db` SQLite database. Much faster than a DB browser for common dev tasks.

```bash
# Apply schema to a fresh database
python db_inspector.py --db ./test.db migrate run

# Seed a complete test dataset (5 agents, 8 skills, 3 projects, 55+ messages, settings)
python db_inspector.py --db ./test.db seed full

# Inspect what's in the database
python db_inspector.py --db ./test.db inspect tables
python db_inspector.py --db ./test.db inspect agents
python db_inspector.py --db ./test.db inspect skills
python db_inspector.py --db ./test.db inspect messages <agent_id>
python db_inspector.py --db ./test.db inspect projects
python db_inspector.py --db ./test.db inspect settings
python db_inspector.py --db ./test.db inspect stats

# Seed specific data
python db_inspector.py --db ./test.db seed skills
python db_inspector.py --db ./test.db seed agents 10
python db_inspector.py --db ./test.db seed messages <agent_id> 50

# Wipe all data (keeps schema)
python db_inspector.py --db ./test.db seed clean
```

If `--db` is omitted, it auto-discovers the database at `%APPDATA%/com.zentral.app/zentral.db`.

---

### telegram_bot_tester.py

Tests the Telegram bot integration in three modes.

**Mock server** — starts a local HTTP server that implements the Telegram Bot API (`getUpdates`, `sendMessage`, `getMe`). Point the Rust bridge at `http://localhost:8443` to test polling without a real bot token.

```bash
python telegram_bot_tester.py --mode mock-server --port 8443 --chat-id 123456789
```

Type messages in the terminal to queue them as Telegram updates. Use `!chatid <id>` to change the sender (test the whitelist), `!quit` to stop.

**Client** — sends real messages to a Telegram bot and displays responses.

```bash
python telegram_bot_tester.py --mode client --token "123456:ABC-DEF..."
```

Type `!commands` to run the full test suite (`/start`, `/status`, `/agents`, `/ask ...`).

**Webhook debugger** — dumps any incoming Telegram webhook payloads.

```bash
python telegram_bot_tester.py --mode webhook-debug --port 8443
```

---

### ipc_event_simulator.py

WebSocket server that sends fake Tauri-style events to the frontend. Useful for building the chat UI without running the Rust backend.

```bash
# Interactive mode — pick events from a menu
python ipc_event_simulator.py --mode interactive --port 9999

# Auto-play demo scenario (simulates a full message-response cycle)
python ipc_event_simulator.py --mode scenario --scenario demo

# Play a custom scenario from a JSON file
python ipc_event_simulator.py --mode scenario --file my_scenario.json
```

The frontend connects to `ws://localhost:9999` and receives events in the format:

```json
{ "event": "agent:output:agent_mock_001", "payload": { "kind": "text", "content": "Hello..." } }
```

**Demo scenario simulates:** status change (running) -> system_init -> text streaming -> tool_use (Read) -> tool_result -> more text -> cost + tokens -> done -> status change (idle).

**Interactive menu:**

| Key | Event |
|-----|-------|
| 1 | Text |
| 2 | Tool use |
| 3 | Done |
| 4 | Error |
| 5 | Status: running |
| 6 | Status: idle |
| 7 | Run demo scenario |
| 8 | Aborted |

---

### agent_load_tester.py

Stress-tests the agent spawner by launching multiple mock CLI instances simultaneously. Measures spawn latency, time-to-first-token (TTFT), total response time, and generates a concurrency timeline.

```bash
# Spawn 5 agents with lorem mode
python agent_load_tester.py --count 5

# Spawn 10 agents with faster streaming
python agent_load_tester.py --count 10 --mock-mode echo --delay 0.01

# Chaos mode — randomly kills agents mid-stream
python agent_load_tester.py --count 8 --chaos

# Save results to JSON
python agent_load_tester.py --count 10 --output-json results.json
```

**Output includes:**

- Per-agent metrics: spawn latency, TTFT, total time, output size, exit code
- Aggregate stats: min/max/avg for TTFT and total time
- Concurrency timeline showing how many agents were active per 50ms bucket
- Memory usage per process (requires `psutil`)

---

## Dependency Map

| Script | External Deps | Stdlib Only? |
|--------|--------------|:---:|
| `mock_claude_cli.py` | — | yes |
| `stream_validator.py` | `colorama` | almost (fallback works without it) |
| `db_inspector.py` | `tabulate`, `faker` | almost (fallbacks for both) |
| `telegram_bot_tester.py` | `flask`, `requests` | no |
| `ipc_event_simulator.py` | `websockets` | no |
| `agent_load_tester.py` | `psutil` | almost (works without it, skips memory tracking) |

`mock_claude_cli.py` and `stream_validator.py` work out of the box with zero `pip install` needed.
