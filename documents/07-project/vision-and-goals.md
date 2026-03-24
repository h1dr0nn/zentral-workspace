# Vision and Goals

> Zentral's vision statement, goals, non-goals, and design principles.

> **Status:** draft
> **Last updated:** 2026-03-24

---

## Overview

Zentral is a lightweight, all-in-one desktop workspace for orchestrating multiple Claude AI agents. A single secretary agent manages the team -- receiving user requests, building execution plans, and dispatching tasks to specialized worker agents. Users interact with their agents locally through the desktop UI or remotely through a Telegram bot. The application is fast, simple, and project-centric: every agent operates within the active project directory, and the entire system ships as one bundled binary with no cloud dependency.

## Goals

### Single bundled application

Zentral ships as a single desktop binary built with Tauri v2. There is no separate backend process, no Node.js server, and no cloud service to configure. Install, open, and start working.

### Multi-agent with hierarchical orchestration

Multiple Claude CLI agents run concurrently, each in its own PTY session. A dedicated secretary agent sits at the top of the hierarchy. It receives every user request, decides whether to handle it directly or delegate, builds execution plans for complex tasks, and aggregates results from worker agents.

### Skill-based agent customization

Each agent is assigned a set of skills (e.g., `testing`, `docker`, `frontend`, `database`). Skills determine what tasks the secretary dispatches to each agent. Users create and configure agents through a simple UI; the skill pool is extensible.

### Remote access via Telegram bot

A built-in Telegram bot module connects to the Telegram Bot API using long polling. Users can send messages to their agents, receive responses, and monitor task progress from any device -- no VPN or port forwarding required.

### Project-centric workspace

All agents inherit the project CWD. File paths, git operations, and build commands resolve relative to the active project. Switching projects re-scopes the entire workspace.

### Low resource usage

Tauri v2 uses the operating system WebView instead of bundling Chromium. The Rust backend handles PTY management, agent orchestration, and persistence with minimal memory overhead. Zentral targets a base memory footprint well below Electron-based alternatives.

### Open source

Zentral is open source. The codebase, documentation, completion definitions, themes, and plugin format are all public and contribution-friendly.

## Non-Goals

Zentral is deliberately scoped. The following are explicitly out of scope.

| Non-goal | Explanation |
|----------|-------------|
| Not an IDE | Zentral does not include a code editor, file tree browser, or syntax highlighting for source files. It orchestrates agents, not edits. |
| Not a terminal emulator | The terminal panel exists for basic output inspection. It is not a full-featured terminal emulator and does not aim to replace dedicated terminals. |
| Not a cloud service | Zentral runs entirely on the local machine. There is no hosted backend, no user accounts, and no data sent to external servers (beyond the Claude CLI and Telegram API calls the user explicitly configures). |
| Not a general AI platform | Zentral is built for Claude. It does not abstract over multiple LLM providers and does not plan to. |
| Not a task management tool | There is no kanban board, no sprint planning, no ticket tracking. Execution plans are transient artifacts of the secretary, not persistent project management objects. |

## Design Principles

### Simplicity over configurability

Provide good defaults. Expose only the settings that matter. Avoid deep configuration hierarchies.

### All-in-one over microservices

One process, one binary, one data directory. No Docker containers, no sidecar services, no message brokers.

### Convention over configuration

Agents inherit the project CWD automatically. The secretary is created on first launch. Skill names follow a fixed vocabulary. Reduce decisions the user must make before getting value.

### Project-centric over agent-centric

The workspace revolves around the project, not individual agents. Switching projects changes the context for all agents. Agent configurations are saved per-project.

### Local-first with optional remote

Everything works offline and on localhost. Telegram integration is opt-in and requires only a bot token. No server infrastructure is needed for remote access.

## Target Users

### Solo developers managing multiple AI agents

A single developer working on a project who wants several Claude agents handling different concerns (tests, docs, refactoring, deployment) simultaneously, coordinated by the secretary.

### Small teams using Claude for code review, testing, and deployment

Teams of two to five developers sharing a project who benefit from pre-configured agent setups and skill-based task routing without building custom tooling.

### Developers who want AI assistance while away from desk

Anyone who starts a long-running agent task and wants to monitor progress or issue follow-up commands from a phone via Telegram, without needing to stay at the workstation.

## References

- [Glossary](glossary.md)
- [System Architecture](../02-architecture/system-architecture.md)
- [Roadmap](../05-roadmap/roadmap.md)
- [Agent Adapters](../03-specifications/agent-adapters.md)
