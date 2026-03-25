# Zentral Roadmap

> High-level overview of the Zentral development roadmap, divided into five sequential phases.

> **Status:** ui-complete
> **Last updated:** 2026-03-25

---

## Overview

```
Phase 1 (Foundation) -> Phase 2 (Agents) -> Phase 3 (Telegram) -> Phase 4 (Polish) -> Phase 5 (Automation)
         |                      |
         +----------------------+
           Minimum Viable Product
```

Phase 1 and Phase 2 together constitute the minimum viable product (MVP). A user who completes the MVP can open the app, manage projects, chat with multiple Claude agents orchestrated by a secretary, and use a built-in terminal. Phases 3 and 4 extend the product with remote access and production-grade polish. Phase 5 adds proactive automation capabilities — scheduling, workflows, history tracking, and a shared knowledge base.

## Phases Overview

| Phase | Focus | Key Deliverables | UI Status |
|-------|-------|-----------------|-----------|
| 1 | Foundation | Tauri scaffold, SQLite persistence, single agent chat, basic UI, terminal panel | Complete |
| 2 | Agents | Multi-agent system, secretary orchestrator, skill pool, agent sidebar | Complete |
| 3 | Telegram | Bot integration, remote messaging, in-app Telegram display | Complete |
| 4 | Polish | Themes, command palette, settings, auto-update, performance tuning | Complete |
| 5 | Automation | Schedules, workflows, activity history, knowledge base | Complete |

## MVP Definition

The MVP is the union of Phase 1 and Phase 2. At MVP completion the following capabilities are available:

- Project management with persistent storage
- Multi-agent orchestration with a secretary agent dispatching tasks
- Skill-based agent configuration
- Streaming chat UI with agent attribution
- Integrated terminal panel
- Custom window chrome with resizable three-panel layout

No network-facing features (Telegram) or advanced polish (auto-update, accessibility audit) are required for MVP. These are deferred to Phases 3 and 4 respectively.

## Phase Summaries

### Phase 1 -- Foundation

Establishes the application shell: Tauri v2 project with React frontend and Rust backend, SQLite database, a single Claude agent integration, chat UI with streaming, and a terminal panel. The custom window decoration and resizable layout are also delivered here.

See [Phase 1 Foundation](phase-1-foundation.md) for the detailed task list and acceptance criteria.

### Phase 2 -- Agents

Builds the full multi-agent system on top of the Phase 1 foundation. Introduces the secretary agent as an always-on orchestrator, a skill pool for agent specialization, concurrent agent execution with queue management, and the right-side agent sidebar.

See [Phase 2 Agents](phase-2-agents.md) for the detailed task list and acceptance criteria.

### Phase 3 -- Telegram

Adds remote access through a Telegram bot. Messages received via Telegram are routed through the secretary agent, processed by the agent system, and returned to both the Telegram chat and the in-app UI. Authentication is handled via chat ID whitelisting.

See [Phase 3 Telegram](phase-3-telegram.md) for the detailed task list and acceptance criteria.

### Phase 4 -- Polish

Brings the application to production quality. Covers theming, command palette, keyboard shortcuts, comprehensive settings, auto-update via the Tauri updater plugin, performance optimizations, error handling, accessibility, documentation, and CI/CD pipelines.

See [Phase 4 Polish](phase-4-polish.md) for the detailed task list and acceptance criteria.

### Phase 5 -- Automation

Adds proactive automation features that transform agents from reactive assistants into autonomous workers. Four new Activity Bar tabs are introduced:

- **Schedules**: Recurring cron-based task execution — agents run skills automatically at specified times.
- **Workflows**: Multi-step agent pipelines with conditional branching — chain agents together for complex tasks.
- **Activity History**: Centralized event log with filtering — track everything agents do across all projects.
- **Knowledge Base**: Shared document repository injected into agent context — persistent facts, conventions, and references.

See [Phase 5 Automation](phase-5-automation.md) for the detailed task list and acceptance criteria.

## Timeline Considerations

Phase durations depend on team size and availability. As a rough guide for a solo or small-team effort:

| Phase | Estimated Duration |
|-------|--------------------|
| 1 | 3--4 weeks |
| 2 | 3--4 weeks |
| 3 | 2--3 weeks |
| 4 | 2--3 weeks |
| 5 | 3--4 weeks |

These estimates assume full-time effort and may vary based on familiarity with Tauri, PTY handling, and the Claude CLI.

## References

- [Phase 1 Foundation](phase-1-foundation.md)
- [Phase 2 Agents](phase-2-agents.md)
- [Phase 3 Telegram](phase-3-telegram.md)
- [Phase 4 Polish](phase-4-polish.md)
- [Phase 5 Automation](phase-5-automation.md)
- [System Architecture](../02-architecture/system-architecture.md)
- [Project Overview](../01-project/overview.md)
