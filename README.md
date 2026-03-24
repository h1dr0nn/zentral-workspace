# Zentral - Claude Multi-Agent Workspace

A lightweight desktop application for orchestrating multiple Claude AI agents from a single interface. Built with React, Rust, and Tauri v2 — everything runs in one bundled app with no separate backend process.

## Features

### Secretary Agent

One dedicated agent acts as the orchestrator. It receives your requests, decides which agent is best suited for the job, and dispatches tasks automatically. You can also talk to any agent directly.

### Skill Pool

Define a global pool of skills — testing, Docker, CI/CD, code review, and more. When creating an agent, pick the skills it should have. Give it a custom title like "QA Lead" or "DevOps" so you can tell your agents apart at a glance.

### Project-Centric Workspace

The left sidebar holds your project list. Switch between projects and every agent immediately works in that directory. No per-agent path configuration needed.

### Telegram Bot

Chat with your secretary agent from anywhere. Send a message on Telegram, the secretary processes it, delegates if needed, and replies — all while the app is running on your machine.

### All-in-One Bundle

Unlike Electron-based alternatives that require separate frontend and backend processes, Zentral bundles everything into a single Tauri v2 binary. Lower memory usage, smaller download, faster startup.

## Tech Stack

| Layer    | Technology                                             |
| -------- | ------------------------------------------------------ |
| Frontend | React, TypeScript, Tailwind CSS v4, Zustand, shadcn/ui |
| Desktop  | Tauri v2                                               |
| Core     | Rust (Tokio, Crossbeam, rusqlite)                      |
| Database | SQLite                                                 |
| Remote   | Telegram Bot API (long polling)                        |

## Getting Started

> Work in progress — see [documents/](documents/) for detailed architecture, specifications, and roadmap.

### Prerequisites

- Rust 1.77+
- Node.js 20+
- pnpm 9+
- Tauri CLI v2

### Development

```bash
git clone <repo-url> zentral
cd zentral
pnpm install
pnpm tauri dev
```

## Documentation

Full documentation lives in the [documents/](documents/) directory:

- [Architecture](documents/01-architecture/) — system design, Rust core, frontend, IPC bridge, data flows
- [Specifications](documents/02-specifications/) — agent manager, secretary, skill pool, Telegram bot, persistence
- [UI/UX](documents/03-ui-ux/) — design system, window decoration, sidebars, chat view, themes
- [Development](documents/04-development/) — setup, coding standards, testing, build, CI/CD
- [Roadmap](documents/05-roadmap/) — 4-phase plan from foundation to polish
- [Research](documents/06-research/) — competitor analysis, Claude CLI internals, crate selection

## Roadmap

| Phase          | Focus                                                               | Status  |
| -------------- | ------------------------------------------------------------------- | ------- |
| 1 — Foundation | Tauri scaffold, SQLite, single agent chat, basic UI, terminal panel | Planned |
| 2 — Agents     | Multi-agent, secretary, skill pool, agent sidebar                   | Planned |
| 3 — Telegram   | Bot integration, remote messaging, in-app display                   | Planned |
| 4 — Polish     | Themes, command palette, auto-update, performance                   | Planned |

## License

TBD
