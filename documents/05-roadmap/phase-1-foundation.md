# Phase 1 -- Foundation

> Core application shell: a working single-agent chat app with persistent storage, a terminal panel, and the foundational UI framework.

> **Status:** in-progress — UI complete, backend partial
> **Last updated:** 2026-03-25
>
> **What works:** Tauri scaffold, custom window, resizable panels, themes, settings, project CRUD, Claude CLI auth (OAuth), single agent streaming chat, localStorage persistence.
> **What's missing:** SQLite persistence layer (stub), PTY terminal backend (stub).

---

## Overview

A user can launch Zentral, create or switch between projects, chat with a single Claude agent, see streaming responses rendered as Markdown, and toggle an embedded terminal panel. The window uses custom chrome with a resizable three-panel layout.

## Tasks

### Tauri v2 Project Scaffold

Set up the monorepo with a Tauri v2 backend (Rust) and a React frontend (TypeScript, Vite).

| Item | Detail |
|------|--------|
| Framework | Tauri v2 with `tauri::Builder` |
| Frontend | React 18+, Vite, TypeScript |
| Window | `decorations: false` in `tauri.conf.json`, custom titlebar |
| Structure | `src/` for React, `src-tauri/` for Rust |

Acceptance criteria:

- `pnpm tauri dev` launches a frameless window with a React root.
- Hot-reload works for both frontend and Rust changes.
- The project compiles on Windows, macOS, and Linux without errors.

### SQLite Persistence Layer

Implement a SQLite database managed from the Rust backend for all persistent state.

| Item | Detail |
|------|--------|
| Crate | `rusqlite` or `sqlx` with SQLite driver |
| Location | `$APPDATA/zentral/zentral.db` (platform-appropriate) |
| Migrations | Embedded SQL files, applied on startup |

Acceptance criteria:

- Database is created on first launch if absent.
- Schema includes tables for projects, conversations, messages, and settings.
- CRUD operations are exposed as Tauri commands callable from the frontend.
- Migrations run automatically and are idempotent.

### Project Management

Allow users to create, switch between, and remove projects. Projects scope all conversations and agent configurations.

Acceptance criteria:

- Left sidebar lists all projects with name and icon.
- User can add a new project via a dialog.
- User can switch projects; the chat and agent state update accordingly.
- User can delete a project with a confirmation prompt.
- Project state persists across app restarts.

### Single Agent Chat

Spawn a Claude CLI process and exchange messages with it.

| Item | Detail |
|------|--------|
| Spawn | `std::process::Command` or `tokio::process::Command` |
| Protocol | Stdin/stdout JSON or line-delimited text |
| Streaming | Read stdout incrementally, emit events to frontend via Tauri event system |

Acceptance criteria:

- Sending a message from the UI spawns (or reuses) a Claude CLI process.
- The response streams token-by-token into the chat UI.
- Errors (process crash, timeout) surface as user-visible messages.
- The agent process is killed cleanly when the app closes.

### Chat UI

Render the conversation as a scrollable message list with an input bar.

Acceptance criteria:

- Messages display with sender attribution (user vs. agent).
- Agent responses render Markdown (headings, code blocks, lists, inline code).
- A streaming indicator (animated dots or cursor) shows while the agent is responding.
- The input bar supports multi-line input with Shift+Enter.
- Pressing Enter sends the message; the input clears immediately.
- The message list auto-scrolls to the latest message.

### Terminal Panel

Embed a terminal emulator in the bottom or side panel.

| Item | Detail |
|------|--------|
| PTY | `portable-pty` crate on Rust side |
| Renderer | xterm.js in the frontend |
| Toggle | Keyboard shortcut `T` or toolbar button |

Acceptance criteria:

- Toggling the terminal panel spawns a PTY with the user's default shell.
- Keystrokes are forwarded to the PTY; output renders in xterm.js.
- The terminal resizes correctly when the panel is resized.
- Closing the panel does not kill the shell session; reopening restores it.

### Custom Window Decoration

Replace the native titlebar with a custom header bar.

Acceptance criteria:

- The header displays the app icon and name on the left.
- A menu bar provides access to File, Edit, View, and Help menus.
- Toggle buttons `[L]`, `[T]`, `[R]` show/hide the left sidebar, terminal panel, and right sidebar respectively.
- Standard window controls (minimize, maximize, close) appear on the right.
- The titlebar area is draggable for window movement.
- Double-clicking the titlebar toggles maximize.

### Resizable Three-Panel Layout

Implement the main content area as three resizable panels using `react-resizable-panels`.

| Panel | Position | Default Width | Content |
|-------|----------|---------------|---------|
| Left sidebar | Left | 260 px | Project list, session list |
| Main | Center | Remaining | Chat view or terminal |
| Right sidebar | Right | 300 px | Agent info (placeholder in Phase 1) |

Acceptance criteria:

- Drag handles between panels allow resizing.
- Panels respect minimum and maximum width constraints.
- Panel sizes persist across sessions.
- Each sidebar can be collapsed via its toggle button.

### Basic Settings Modal

Provide a minimal settings dialog accessible from the menu bar or a keyboard shortcut.

Acceptance criteria:

- The modal opens with Ctrl+Comma (Cmd+Comma on macOS).
- A theme toggle switches between light and dark modes.
- A font size selector adjusts the chat and terminal font size.
- Settings persist in SQLite and apply immediately.

## Architecture Decisions

The following decisions should be finalized during Phase 1 development:

| Decision | Options | Recommendation |
|----------|---------|----------------|
| State management | Zustand, Jotai, Redux Toolkit | Zustand for simplicity |
| CSS approach | Tailwind, CSS Modules, styled-components | Tailwind CSS |
| IPC pattern | Tauri commands vs. event channels | Commands for request/response, events for streaming |
| SQLite crate | `rusqlite`, `sqlx` | `rusqlite` for sync simplicity; `sqlx` if async is needed |
| Markdown renderer | `react-markdown`, `marked` + custom | `react-markdown` with `remark-gfm` |

## Definition of Done

Phase 1 is complete when a user can:

1. Launch the app and see a custom-decorated window with a three-panel layout.
2. Create a project, give it a name, and see it in the left sidebar.
3. Switch between projects.
4. Send a message to a Claude agent and see the streaming response rendered as Markdown.
5. Toggle the terminal panel and execute shell commands.
6. Open settings and switch between light and dark themes.
7. Close and reopen the app with all state preserved.

## References

- [Roadmap Overview](roadmap.md)
- [Phase 2 Agents](phase-2-agents.md)
- [System Architecture](../02-architecture/system-architecture.md)
- [Frontend Architecture](../02-architecture/frontend-architecture.md)
- [PTY Handling](../03-specifications/pty-handling.md)
