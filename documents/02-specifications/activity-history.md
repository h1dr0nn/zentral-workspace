# Activity History

> Centralized event log capturing all agent actions, workflow runs, schedule triggers, and system events with filtering and retention management.

> **Status:** draft
> **Last updated:** 2026-03-25

---

## Overview

The Activity History module provides a unified timeline of everything that happens in the Zentral workspace. Every agent action, workflow execution, schedule trigger, and error is recorded as a `HistoryEvent`. Users can filter, search, and browse this timeline to understand what agents have done, diagnose failures, and audit automated actions.

History events are write-heavy and read-heavy: the system continuously appends events as agents work, and users frequently browse and filter the log. The schema and indexing strategy reflect this access pattern.

```
Event Sources                     History Store                    UI
─────────────                     ─────────────                    ──
Agent runs skill   ─────────────> HistoryEvent                     HistoryTab
Schedule triggers  ─────────────> (type, agent, project,    ────>  HistoryEventCard
Workflow executes  ─────────────>  skill, status, duration,        HistoryFilters
Agent starts/stops ─────────────>  summary, details, timestamp)
System errors      ─────────────>
```

---

## HistoryEvent Struct

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEvent {
    /// Unique identifier (UUID v4).
    pub id: String,
    /// Category of event.
    pub event_type: HistoryEventType,
    /// The agent involved in this event.
    pub agent_id: String,
    /// Optional project context.
    pub project_id: Option<String>,
    /// Optional skill that was executed.
    pub skill_id: Option<String>,
    /// Optional workflow that triggered this event.
    pub workflow_id: Option<String>,
    /// One-line summary for display: "Vex committed changes to my-app".
    pub summary: String,
    /// Extended details, shown when the user expands the event card.
    pub details: Option<String>,
    /// Outcome of the event.
    pub status: HistoryEventStatus,
    /// Duration in milliseconds, if applicable.
    pub duration_ms: Option<u64>,
    /// ISO 8601 timestamp when the event occurred.
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum HistoryEventType {
    SkillRun,         // Agent executed a skill
    AgentStart,       // Agent process started
    AgentStop,        // Agent process stopped
    WorkflowRun,      // Workflow execution completed
    ScheduleTrigger,  // Schedule fired and triggered an agent
    Error,            // System or agent error
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum HistoryEventStatus {
    Success,
    Failure,
    Running,
    Cancelled,
}
```

### Validation Rules

| Field       | Constraint                                              |
|-------------|---------------------------------------------------------|
| agent_id    | Must reference an existing agent (or recently deleted)   |
| project_id  | If provided, must reference an existing project          |
| skill_id    | If provided, must reference a known skill ID             |
| workflow_id | If provided, must reference a known workflow ID          |
| summary     | 1–256 characters                                         |
| details     | 0–4096 characters                                        |
| event_type  | One of the enum variants                                 |
| status      | One of the enum variants                                 |

---

## Event Sources

### Skill Execution

When an agent completes a skill execution, the agent manager emits a history event:

```rust
history_store.add_event(HistoryEvent {
    event_type: HistoryEventType::SkillRun,
    agent_id: agent.id.clone(),
    project_id: Some(project.id.clone()),
    skill_id: Some(skill.id.clone()),
    workflow_id: None,
    summary: format!("{} ran /{} on {}", agent.name, skill.name, project.name),
    details: Some(truncated_output),
    status: if success { HistoryEventStatus::Success } else { HistoryEventStatus::Failure },
    duration_ms: Some(elapsed.as_millis() as u64),
    ..Default::default()
});
```

### Agent Lifecycle

Agent start and stop events:

| Trigger          | Event Type     | Summary Format                        |
|------------------|----------------|---------------------------------------|
| Agent started    | `AgentStart`   | "{name} started"                      |
| Agent stopped    | `AgentStop`    | "{name} stopped"                      |
| Agent crashed    | `Error`        | "{name} crashed: {error_message}"     |

### Workflow Execution

When a workflow completes (success or failure), a single summary event is recorded:

| Trigger             | Event Type     | Summary Format                                    |
|---------------------|----------------|---------------------------------------------------|
| Workflow completed   | `WorkflowRun`  | "Workflow '{name}' completed ({n}/{total} steps)" |
| Workflow failed      | `WorkflowRun`  | "Workflow '{name}' failed at step {n}"            |

### Schedule Triggers

When a schedule fires:

| Trigger            | Event Type         | Summary Format                                  |
|--------------------|--------------------|-------------------------------------------------|
| Schedule triggered | `ScheduleTrigger`  | "Schedule '{name}' triggered {agent}: /{skill}" |

---

## Filtering

The frontend maintains a `HistoryFilter` object for narrowing the displayed events:

```typescript
interface HistoryFilter {
  agentId: string | null;     // Filter by specific agent
  projectId: string | null;   // Filter by specific project
  type: HistoryEventType | null;     // Filter by event type
  status: HistoryEventStatus | null; // Filter by outcome
  search: string;             // Free-text search against summary
}
```

Filtering is applied client-side for the initial implementation (the full event list is in Zustand). For large histories (>1000 events), server-side filtering via SQL queries should be implemented.

### Filter Combinations

All filters are AND-combined. Setting `agentId = "agent-vex"` and `status = "failure"` shows only Vex's failed events.

---

## Retention Policy

History events accumulate over time and need lifecycle management.

| Setting          | Values                          | Default  |
|------------------|---------------------------------|----------|
| `chatRetention`  | `"all"`, `"30days"`, `"7days"`  | `"all"`  |

The retention policy is configured in Settings → Advanced → Chat Retention (which applies to both chat messages and history events).

### Cleanup Logic

A background task runs daily (or on app startup) to purge events older than the retention threshold:

```sql
DELETE FROM history_events
WHERE timestamp < datetime('now', '-30 days')
AND (SELECT value FROM settings WHERE key = 'chatRetention') = '30days';
```

Events with `status = 'failure'` or `event_type = 'error'` are exempt from automatic cleanup — errors are retained indefinitely for audit purposes. Users can manually clear all history via the "Clear History" action.

---

## SQLite Schema

```sql
CREATE TABLE IF NOT EXISTS history_events (
    id           TEXT PRIMARY KEY,
    event_type   TEXT NOT NULL,
    agent_id     TEXT NOT NULL,
    project_id   TEXT,
    skill_id     TEXT,
    workflow_id  TEXT,
    summary      TEXT NOT NULL,
    details      TEXT,
    status       TEXT NOT NULL,
    duration_ms  INTEGER,
    timestamp    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_history_timestamp ON history_events (timestamp DESC);
CREATE INDEX idx_history_agent ON history_events (agent_id);
CREATE INDEX idx_history_project ON history_events (project_id);
CREATE INDEX idx_history_type ON history_events (event_type);
CREATE INDEX idx_history_status ON history_events (status);
```

### Notes on Schema Design

- No foreign key constraints on `agent_id`, `project_id`, `skill_id`, `workflow_id`. History events must survive the deletion of the entities they reference — an event recording "Vex committed code" should remain visible even if Vex is later deleted.
- `timestamp` is indexed DESC for efficient "newest first" queries.
- Multiple indices support the various filter combinations.

---

## IPC Commands

### list_history_events

Returns events matching the given filter, ordered by timestamp descending. Supports pagination.

```rust
#[tauri::command]
pub async fn list_history_events(
    state: tauri::State<'_, AppState>,
    filter: HistoryFilter,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<Vec<HistoryEvent>, String> { ... }
```

### add_history_event

Inserts a new event. Called internally by other modules, not directly from the frontend.

```rust
pub fn add_history_event(
    conn: &rusqlite::Connection,
    event: &HistoryEvent,
) -> Result<(), rusqlite::Error> { ... }
```

### clear_history

Deletes all history events. Requires confirmation on the frontend side.

```rust
#[tauri::command]
pub async fn clear_history(
    state: tauri::State<'_, AppState>,
) -> Result<u64, String> { ... }  // Returns count of deleted events
```

### get_history_stats

Returns aggregate counts for the ActivityBar badge.

```rust
#[tauri::command]
pub async fn get_history_stats(
    state: tauri::State<'_, AppState>,
) -> Result<HistoryStats, String> { ... }

#[derive(Serialize)]
pub struct HistoryStats {
    pub total: u64,
    pub failures_today: u64,
    pub running: u64,
}
```

---

## Tauri Events

| Event Name           | Direction       | Payload                                |
|----------------------|-----------------|----------------------------------------|
| `history:new_event`  | Rust → Frontend | `{ event: HistoryEvent }`              |
| `history:cleared`    | Rust → Frontend | `{ count: u64 }`                       |

The frontend listens for `history:new_event` to append events to the Zustand store in real-time without polling.

---

## Zustand Store

```typescript
import { create } from "zustand";

export type HistoryEventType = "skill_run" | "agent_start" | "agent_stop" | "workflow_run" | "schedule_trigger" | "error";
export type HistoryEventStatus = "success" | "failure" | "running" | "cancelled";

export interface HistoryEvent {
  id: string;
  type: HistoryEventType;
  agentId: string;
  projectId: string | null;
  skillId: string | null;
  workflowId: string | null;
  summary: string;
  details: string | null;
  status: HistoryEventStatus;
  duration: number | null;
  timestamp: string;
}

export interface HistoryFilter {
  agentId: string | null;
  projectId: string | null;
  type: HistoryEventType | null;
  status: HistoryEventStatus | null;
  search: string;
}

interface HistoryStore {
  events: HistoryEvent[];
  filter: HistoryFilter;
  addEvent: (event: Omit<HistoryEvent, "id">) => void;
  clearHistory: () => void;
  setFilter: (patch: Partial<HistoryFilter>) => void;
  resetFilter: () => void;
}
```

---

## References

- [Agent Manager](agent-manager.md) — agent lifecycle events
- [Schedules](schedules.md) — schedule trigger events
- [Workflows](workflows.md) — workflow run events
- [Persistence](persistence.md) — SQLite patterns
- [Settings Modal](../03-ui-ux/settings-modal.md) — retention policy configuration
- [Left Sidebar -- History](../03-ui-ux/sidebar-left-history.md) — UI specification
