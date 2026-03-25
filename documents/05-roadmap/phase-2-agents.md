# Phase 2 -- Agents

> Transforms Zentral from a single-agent chat app into a full multi-agent workspace with orchestration, skill-based specialization, and concurrent execution.

> **Status:** ui-complete
> **Last updated:** 2026-03-25

---

## Overview

A user can create multiple agents with distinct roles and skills. A secretary agent acts as an always-on orchestrator, receiving user requests, building execution plans, and dispatching tasks to the appropriate agents. Agents collaborate on complex requests and their contributions are clearly attributed in the chat UI.

## Tasks

### Agent Manager

Implement the core agent lifecycle system in the Rust backend.

| Item | Detail |
|------|--------|
| Storage | SQLite tables for agents, skills, and agent-skill assignments |
| Operations | Create, read, update, delete agents |
| Lifecycle | Spawn, pause, resume, stop agent processes |
| State tracking | Idle, working, queued, error, stopped |

Acceptance criteria:

- Agents are persisted in the database and survive app restarts.
- Each agent runs as a separate Claude CLI process.
- The manager tracks agent state and exposes it via Tauri commands.
- Stopping an agent kills its process cleanly and updates the state.
- Deleting an agent stops it first, then removes all associated data.

### Secretary Agent

Introduce a dedicated orchestrator agent that is always running and mediates between the user and all other agents.

| Item | Detail |
|------|--------|
| Role | Receives every user message, decides routing |
| Dispatch | Assigns tasks to agents based on skills and availability |
| Execution plans | Breaks complex requests into ordered sub-tasks |
| Aggregation | Collects agent responses and synthesizes a final answer when needed |

Acceptance criteria:

- The secretary starts automatically when the app launches.
- User messages go to the secretary first, never directly to worker agents.
- The secretary can delegate a task to one or more agents in parallel or sequence.
- The secretary produces an execution plan visible in the UI before dispatching.
- If no suitable agent exists, the secretary handles the task itself or asks the user to create one.

### Skill Pool

Define a system of skills that can be assigned to agents to specialize their behavior.

| Skill Category | Examples |
|----------------|----------|
| Built-in | Code review, documentation, testing, refactoring, debugging |
| Language-specific | Rust, TypeScript, Python, Go |
| Domain | DevOps, database, API design, security |
| Custom | User-defined via name + system prompt snippet |

Acceptance criteria:

- A set of built-in skills ships with the app, each with a name, description, and system prompt fragment.
- Users can create custom skills with a name and prompt text.
- Skills are stored in SQLite and displayed in the agent configuration UI.
- Assigning a skill to an agent appends the skill's prompt fragment to the agent's system prompt.
- Skills can be added or removed from an agent at any time; changes take effect on the next message.

### Agent Sidebar

Add the right sidebar panel with agent management UI.

| Element | Detail |
|---------|--------|
| Agent cards | Show name, role, status indicator, assigned skill badges |
| Status colors | Green = idle, blue = working, yellow = queued, red = error, gray = stopped |
| Actions | Add, edit, delete agents; start/stop toggle |
| Scroll | Virtual scroll if agent count exceeds viewport |

Acceptance criteria:

- The right sidebar lists all agents for the current project.
- Each card shows the agent's name, role title, current status, and skill badges.
- Clicking an agent card opens an edit dialog for role, title, and skill assignment.
- The add button opens a creation dialog with name, role, and skill selection.
- Delete requires confirmation and stops the agent first.
- Status updates in real time as agents receive and complete tasks.

### Multi-Agent Chat UI

Extend the chat view to support messages from multiple agents with clear attribution.

Acceptance criteria:

- Each message displays the sender name and a colored avatar or icon.
- Delegation events appear as system messages (e.g., "Secretary delegated to CodeReview agent").
- Agent responses include a badge showing which agent produced them.
- The user can click an agent badge to view that agent's details in the sidebar.
- Execution plans from the secretary render as a collapsible step list.
- The streaming indicator shows which agent is currently responding.

### Concurrency Control

Manage how many agents can run simultaneously and queue excess work.

| Parameter | Default | Configurable |
|-----------|---------|-------------|
| Max concurrent agents | 3 | Yes, in settings |
| Queue strategy | FIFO | No (fixed) |
| Queue timeout | 5 minutes | Yes, in settings |

Acceptance criteria:

- No more than `max_concurrent_agents` Claude CLI processes run at the same time.
- Tasks exceeding the limit enter a FIFO queue.
- Queued tasks show a "queued" status in the sidebar and chat.
- If a task waits longer than the timeout, it fails with a user-visible error.
- The concurrency limit is configurable in the settings modal.

### Agent Configuration

Provide a comprehensive configuration interface for each agent.

| Field | Type | Required |
|-------|------|----------|
| Name | Text | Yes |
| Role title | Text | Yes |
| Description | Text area | No |
| Skills | Multi-select from skill pool | No |
| System prompt override | Text area | No |
| Auto-start | Boolean | No (default false) |

Acceptance criteria:

- All fields persist in SQLite.
- The configuration dialog validates required fields before saving.
- Changes to skills or system prompt take effect on the next message without restarting the agent process.
- Agents marked as auto-start launch when the app opens.

## Definition of Done

Phase 2 is complete when a user can:

1. Create multiple agents with different names, roles, and skills.
2. Send a message and see the secretary build an execution plan.
3. Watch the secretary delegate tasks to the appropriate agents.
4. See agent responses in the chat with clear attribution badges.
5. Monitor agent status (idle, working, queued) in the right sidebar.
6. Add custom skills and assign them to agents.
7. Configure concurrency limits and see queuing behavior when limits are exceeded.
8. Close and reopen the app with all agents, skills, and configurations preserved.

Completing Phase 2 alongside Phase 1 constitutes the Zentral MVP.

## References

- [Roadmap Overview](roadmap.md)
- [Phase 1 Foundation](phase-1-foundation.md)
- [Phase 3 Telegram](phase-3-telegram.md)
- [Agent Detection Specification](../03-specifications/agent-detection.md)
- [Agent Adapters Specification](../03-specifications/agent-adapters.md)
