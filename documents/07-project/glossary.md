# Glossary

> All terms used across the Zentral documentation, listed in alphabetical order.

> **Status:** draft
> **Last updated:** 2026-03-24

---

## Overview

| Term | Definition |
|------|-----------|
| Agent | A Claude CLI child process with an assigned role and set of skills. Each agent runs in its own PTY and maintains a separate session. |
| Agent Manager | Rust module (`agent::manager`) responsible for the full agent lifecycle: create, start, stop, restart, and delete. Holds agent state behind `Arc<Mutex<T>>` and exposes Tauri commands. |
| CLI | Command Line Interface. Zentral spawns Claude CLI processes as agents; users may also interact with agents through the Telegram bot CLI-style interface. |
| ConPTY | Windows Console Pseudo Terminal API. The platform-specific backend Zentral uses to spawn and communicate with child processes on Windows. |
| Crossbeam | Rust crate providing multi-producer, multi-consumer channels and other concurrency primitives. Used for internal message passing between the PTY reader thread and the Tauri event loop. |
| CWD | Current Working Directory. Every agent inherits the project CWD so that file-relative commands resolve correctly. |
| Dispatch | The act of routing a task from the secretary agent to a specific worker agent based on skill matching and availability. |
| Execution Plan | A structured, multi-step plan created by the secretary when a user request is too complex for a single agent. The plan lists ordered tasks, assigned agents, and expected outputs. |
| IPC | Inter-Process Communication. In Zentral this refers to the Tauri command/event system that bridges the React frontend and the Rust backend. |
| Long Polling | Telegram Bot API technique where an HTTP request (`getUpdates`) blocks until new messages are available or a timeout expires. Zentral uses this to receive Telegram messages without a webhook or public server. |
| Managed State | A Tauri pattern for sharing data across command handlers. Zentral wraps shared structures in `Arc<Mutex<T>>` (or `Arc<RwLock<T>>`) and registers them with `tauri::Builder::manage`. |
| NDJSON | Newline-Delimited JSON. A streaming format where each line is a self-contained JSON object. Used to parse incremental output from the Claude CLI `--output-format stream-json` flag. |
| PTY | Pseudo Terminal. A virtual terminal device that allows Zentral to spawn shell and CLI processes, send input, and capture output as if running in a real terminal. |
| Secretary | A special orchestrator agent that receives all user requests first. It analyzes the request, builds an execution plan if needed, dispatches tasks to worker agents, and aggregates results. |
| Session | A Claude CLI conversation thread identified by a unique `session_id`. Sessions preserve context across messages and can be resumed after an agent restart. |
| Skill | A capability tag assigned to an agent (e.g., `testing`, `docker`, `frontend`). Skills determine which tasks the secretary may dispatch to a given agent. |
| Skill Pool | The global registry of all available skills. The secretary consults the skill pool when deciding which agent is best suited for a task. |
| SQLite | Embedded relational database engine. Zentral uses SQLite for local persistence of sessions, agent configurations, execution history, and user preferences. |
| Tauri | A Rust-based desktop application framework that renders the UI through the operating system WebView. Zentral uses Tauri v2 to combine a React frontend with a Rust backend in a single lightweight binary. |
| Zustand | A lightweight React state management library. Zentral uses Zustand stores to hold frontend state (agents, sessions, settings) and to react to events pushed from the Rust backend. |

## References

- [Vision and Goals](vision-and-goals.md)
- [System Architecture](../02-architecture/system-architecture.md)
- [Agent Adapters](../03-specifications/agent-adapters.md)
- [Session Management](../03-specifications/session-management.md)
