# Rust Crate Selection Guide

> This document catalogues every Rust crate used by Zentral, explains why it was chosen over alternatives, and notes platform-specific considerations. It also lists crates that were evaluated but deliberately excluded.

> **Status:** draft
> **Last updated:** 2026-03-24

---

## Overview

| Crate | Version | Purpose | Why chosen |
|-------|---------|---------|------------|
| tauri | 2 | Desktop framework | Core requirement for the application shell |
| tauri-plugin-dialog | 2 | Native file dialogs | Project directory picker in the UI |
| tauri-plugin-process | 2 | Process management | Graceful app lifecycle (restart, exit) |
| tauri-plugin-log | 2 | Logging bridge | Structured logging from Rust to frontend console |
| tokio | 1 (full) | Async runtime | Telegram polling, subprocess I/O, async channels |
| rusqlite | 0.31+ | SQLite | Local persistence for agents, skills, messages |
| serde | 1 | Serialization | IPC payloads, config files, database rows |
| serde_json | 1 | JSON | NDJSON stream parsing, Tauri command return values |
| crossbeam-channel | 0.5 | MPMC channels | Internal event bus between modules |
| reqwest | 0.12+ | HTTP client | Telegram Bot API calls |
| thiserror | 2 | Error derive macro | Typed domain errors with zero boilerplate |
| anyhow | 1 | Error handling | Top-level error propagation in commands |
| nix | 0.29 | Unix APIs | PTY creation and signal handling on Linux/macOS |
| windows | 0.58 | Windows APIs | ConPTY creation on Windows |
| parking_lot | 0.12 | Sync primitives | Faster Mutex/RwLock than std, no poisoning |
| log | 0.4 | Logging facade | Uniform logging API across all modules |
| env_logger | 0.11 | Logger implementation | Human-readable log output during development |
| uuid | 1 | UUID generation | Unique IDs for agents, skills, messages |
| chrono | 0.4 | Date/time | Timestamps on messages and audit events |
| dirs | 6 | Platform directories | Locating config and data directories per OS |

## Detailed Crate Rationale

### tauri 2

Tauri is the application framework. It provides the webview shell, IPC between
Rust and the React frontend, window management, and the build/bundle pipeline.
Version 2 is required for the new plugin system, mobile support groundwork, and
improved security model with capability-based permissions.

There is no realistic alternative for a Rust-backed desktop app with a web
frontend. Electron was rejected for its memory footprint and lack of Rust
integration. Wry/Tao could be used directly but would require reimplementing
everything Tauri provides out of the box.

### tauri-plugin-dialog 2

Provides native OS file and directory picker dialogs. Used when the user adds a
project directory. The native dialog integrates with the OS file browser rather
than requiring a custom in-app file tree.

### tauri-plugin-process 2

Exposes process lifecycle commands (exit, restart) to the frontend. Used for
the "Restart app" menu item and graceful shutdown sequences that need to clean
up running agents before the process exits.

### tauri-plugin-log 2

Bridges the Rust `log` facade to the Tauri frontend, allowing log messages to
appear in the browser dev console during development. In production builds, logs
are written to a file in the platform data directory.

### tokio 1 (full feature set)

Zentral needs a full async runtime for several concurrent tasks:

- Telegram long-polling loop
- Reading stdout/stderr from Claude CLI subprocesses
- Async SQLite operations (via `spawn_blocking`)
- Timers and sleep for retry logic

The `full` feature flag is used to include `tokio::process`, `tokio::time`,
`tokio::sync`, and `tokio::fs`. While `async-std` is a viable alternative,
tokio has broader ecosystem support: reqwest, tauri, and most async crates
default to tokio.

### rusqlite 0.31+

SQLite is the persistence layer for agents, skills, messages, and configuration.
`rusqlite` provides a thin, safe wrapper around the SQLite C library with good
ergonomics for parameter binding and row mapping.

Why not diesel: Diesel is a full ORM with a migration DSL, schema macros, and
compile-time query checking. That machinery is overkill for Zentral's simple
CRUD operations on a handful of tables. Diesel also pulls in `libpq` or
`mysqlclient` by default and requires a CLI tool for migrations. rusqlite is
lighter and gives direct control over SQL.

Why not sqlx: sqlx provides compile-time SQL verification against a live
database, which is powerful for large projects with complex schemas. Zentral's
schema is small (under 10 tables) and changes infrequently, so the compile-time
overhead and requirement to have a running database during builds is not
justified. rusqlite's runtime approach is simpler for this use case.

### serde 1 and serde_json 1

Serde is the standard serialization framework in Rust. Every struct that crosses
an IPC boundary, is stored in SQLite, or appears in a config file derives
`Serialize` and `Deserialize`. serde_json handles the NDJSON stream from
Claude CLI and the JSON payloads in Tauri commands.

There are no serious alternatives. serde is the ecosystem standard.

### crossbeam-channel 0.5

Provides multi-producer, multi-consumer channels used as an internal event bus.
Agent status changes, incoming messages, and Telegram updates are published to
channels that multiple subscribers can consume.

Why not tokio::sync::mpsc: tokio channels are async-only and single-consumer.
crossbeam-channel supports both sync and async contexts (via `select!`) and
allows multiple consumers, which fits the event bus pattern where several
modules listen for the same event type.

Why not flume: flume is a viable alternative with similar performance. crossbeam
was chosen because it is more widely used, battle-tested in production systems,
and the crossbeam project is a dependency of many other crates already in the
tree, so it adds no new transitive dependencies.

### reqwest 0.12+

HTTP client used exclusively for Telegram Bot API calls. reqwest is async,
supports TLS out of the box, and integrates with tokio.

Why not ureq: ureq is a synchronous HTTP client. Since Telegram long-polling
is inherently async (waiting for updates with a timeout), using a blocking
client would require a dedicated thread. reqwest fits naturally into the tokio
runtime without blocking.

Why not hyper directly: hyper is a low-level HTTP library. reqwest wraps hyper
and adds connection pooling, redirect handling, and a convenient request builder.
Using hyper directly would mean reimplementing all of that for no benefit.

### thiserror 2

Derive macro for implementing `std::error::Error` on domain error enums.
Each module defines its own error type (e.g., `AgentError`, `PersistenceError`,
`TelegramError`) using thiserror, which generates the `Display` and `Error`
impls from `#[error("...")]` attributes.

```rust
#[derive(Debug, thiserror::Error)]
pub enum AgentError {
    #[error("agent not found: {0}")]
    NotFound(String),
    #[error("agent already running: {0}")]
    AlreadyRunning(String),
    #[error("failed to spawn CLI process: {0}")]
    SpawnFailed(#[from] std::io::Error),
}
```

### anyhow 1

Used at the application boundary (Tauri commands and main) where errors from
different modules need to be combined into a single result type without defining
yet another enum. Domain code uses thiserror; glue code uses anyhow.

### nix 0.29

Unix-specific APIs for PTY creation (`openpty`, `forkpty`), signal handling
(`kill`, `SIGTERM`), and file descriptor management. Only compiled on
`cfg(unix)` targets.

Platform note: This crate is excluded on Windows builds via a
`[target.'cfg(unix)'.dependencies]` section in Cargo.toml.

### windows 0.58

Microsoft's official Rust bindings for Windows APIs. Used for ConPTY
(`CreatePseudoConsole`, `ResizePseudoConsole`) to provide terminal
functionality on Windows.

Platform note: Only compiled on `cfg(windows)` targets. The `windows` crate
uses a feature-flag system to pull in only the specific API surface needed,
keeping compile times manageable.

```toml
[target.'cfg(windows)'.dependencies]
windows = { version = "0.58", features = [
    "Win32_System_Console",
    "Win32_Foundation",
    "Win32_Security",
    "Win32_System_Threading",
] }
```

### parking_lot 0.12

Drop-in replacement for `std::sync::Mutex` and `std::sync::RwLock` with two
advantages: no lock poisoning (a panicked thread does not permanently poison
the lock) and measurably faster lock/unlock operations on contended workloads.

Zentral uses `parking_lot::Mutex` for shared state in the agent manager and
event bus, where the simpler semantics and better performance justify the
additional dependency.

### log 0.4

The standard logging facade. All modules log through the `log` macros
(`info!`, `warn!`, `error!`, `debug!`, `trace!`). The actual log backend is
plugged in at startup.

### env_logger 0.11

Used during development to print human-readable log output to stderr. In
production builds, `tauri-plugin-log` takes over and routes logs to a file.
env_logger is included as a `[dev-dependencies]` entry so it is available in
tests and local runs without being bundled in release builds.

### uuid 1

Generates v4 UUIDs for agents, skills, messages, and sessions. UUIDs avoid
collision without requiring a central sequence counter, which matters when
agents and messages can be created concurrently.

Why not nanoid or ulid: UUIDs are universally understood, sort lexicographically
when using v7 (if needed later), and are natively supported by SQLite as text.
nanoid is shorter but less standard; ulid provides time-ordering but Zentral
already stores explicit timestamps.

### chrono 0.4

Date and time handling for message timestamps, session durations, and audit
logs. Provides timezone-aware types (`DateTime<Utc>`) and formatting.

Why not `time`: The `time` crate is lighter but has a less ergonomic API for
formatting and parsing. chrono is more widely used and has better serde
integration for ISO 8601 strings stored in SQLite.

### dirs 6

Returns platform-appropriate directories for configuration (`config_dir`),
data (`data_dir`), and cache (`cache_dir`). Used to determine where to store
the SQLite database, log files, and user configuration.

| Platform | Config | Data |
|----------|--------|------|
| Linux | ~/.config/zentral | ~/.local/share/zentral |
| macOS | ~/Library/Application Support/zentral | ~/Library/Application Support/zentral |
| Windows | %APPDATA%\zentral | %APPDATA%\zentral |

## Crates Not Chosen

### diesel

Diesel is a powerful ORM and query builder for Rust. It was evaluated and
rejected for the following reasons:

- Zentral's schema has fewer than 10 tables with simple CRUD operations. Diesel's
  migration system, schema DSL, and compile-time query validation add complexity
  without proportional benefit.
- Diesel requires a CLI tool (`diesel_cli`) for managing migrations, adding a
  build-time dependency.
- The `diesel` crate pulls in `libpq` (Postgres) or `mysqlclient` by default
  unless explicitly feature-gated to SQLite only.
- rusqlite gives direct SQL control, which is easier to reason about for a small
  schema.

### teloxide

teloxide is a full-featured Telegram bot framework for Rust. It was rejected
because:

- It brings a large dependency tree (dispatcher, handler chains, dialogue
  system) when Zentral only needs long-polling and `sendMessage`.
- The abstraction layers make it harder to control retry behavior and error
  handling at the HTTP level.
- Raw reqwest calls to the Telegram Bot API are approximately 30 lines of code
  for the two endpoints Zentral uses. teloxide would add thousands of lines of
  compiled dependencies for minimal benefit.

### ureq

ureq is a synchronous HTTP client. It was rejected because Zentral's Telegram
polling loop is async. Using ureq would require `spawn_blocking` for every HTTP
call, defeating the purpose of the async runtime. reqwest integrates natively
with tokio.

### sqlx

sqlx provides compile-time SQL verification by connecting to a real database
during `cargo build`. While this catches SQL errors early, it requires a running
SQLite database at compile time and slows down incremental builds. For Zentral's
small, stable schema, the trade-off is not worthwhile. Runtime errors from
rusqlite are caught immediately by the test suite.

### warp / axum

These are HTTP server frameworks. Zentral does not expose an HTTP server; all
communication uses Tauri IPC. If a local API is needed in the future (e.g., for
a CLI companion), axum would be the first choice due to its tower middleware
ecosystem.

## Cargo.toml Structure

The workspace is structured with the Tauri backend as the primary crate.
Platform-specific dependencies are gated by target configuration.

```toml
[package]
name = "zentral"
version = "0.1.0"
edition = "2021"

[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-dialog = "2"
tauri-plugin-process = "2"
tauri-plugin-log = "2"
tokio = { version = "1", features = ["full"] }
rusqlite = { version = "0.31", features = ["bundled"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
crossbeam-channel = "0.5"
reqwest = { version = "0.12", features = ["json"] }
thiserror = "2"
anyhow = "1"
parking_lot = "0.12"
log = "0.4"
uuid = { version = "1", features = ["v4"] }
chrono = { version = "0.4", features = ["serde"] }
dirs = "6"

[dev-dependencies]
env_logger = "0.11"
tempfile = "3"
mockito = "1"

[target.'cfg(unix)'.dependencies]
nix = { version = "0.29", features = ["term", "signal", "process"] }

[target.'cfg(windows)'.dependencies]
windows = { version = "0.58", features = [
    "Win32_System_Console",
    "Win32_Foundation",
    "Win32_Security",
    "Win32_System_Threading",
] }
```

### Feature Flags of Note

| Crate | Feature | Why |
|-------|---------|-----|
| rusqlite | `bundled` | Compiles SQLite from source so no system library is needed |
| tokio | `full` | Enables process, time, sync, fs, and net — all used |
| serde | `derive` | Enables `#[derive(Serialize, Deserialize)]` |
| reqwest | `json` | Adds `.json()` method for request/response bodies |
| chrono | `serde` | Enables serialization of DateTime types |
| uuid | `v4` | Random UUID generation |
| nix | `term`, `signal`, `process` | Only the API subsets actually used |
| windows | Win32 console features | Minimal surface for ConPTY |
| tauri | `tray-icon` | System tray support for background operation |

### Platform-Specific Dependencies

The `nix` and `windows` crates are conditionally compiled:

- On Linux and macOS, `nix` provides POSIX PTY and signal APIs. The `windows`
  crate is excluded entirely.
- On Windows, the `windows` crate provides ConPTY APIs. The `nix` crate is
  excluded entirely.

This keeps the dependency tree lean on each platform and avoids compiling
unused platform code.

## References

- [Tauri v2 documentation](https://tauri.app/)
- [rusqlite documentation](https://docs.rs/rusqlite)
- [tokio documentation](https://docs.rs/tokio)
- [reqwest documentation](https://docs.rs/reqwest)
- [crossbeam-channel documentation](https://docs.rs/crossbeam-channel)
- [thiserror documentation](https://docs.rs/thiserror)
- [Cargo target-specific dependencies](https://doc.rust-lang.org/cargo/reference/specifying-dependencies.html#platform-specific-dependencies)
