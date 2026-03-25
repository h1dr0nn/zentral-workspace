# Schedules

> Recurring task scheduler that binds agents and skills to time-based triggers, enabling proactive automation without manual intervention.

> **Status:** draft
> **Last updated:** 2026-03-25

---

## Overview

The Schedules module allows users to define recurring tasks that execute automatically at specified times. Each schedule binds an agent to a skill with an optional project scope, a frequency pattern, and a status toggle. When a schedule fires, the system spawns the designated agent with the designated skill in the context of the linked project.

Schedules turn agents from reactive assistants into proactive workers — a user can configure Vex to review PRs every morning at 9 AM, or Nova to run a weekly competitor analysis.

```
+------------------+       +------------------+       +------------------+
|   Schedules      |       |     Agents       |       |     Skills       |
|                  | N---1 |                  |       |                  |
|  id              |------>|  id              |       |  id              |
|  agent_id        |       |  name            |  N---1|  name            |
|  skill_id        |------>|  role            |------>|  category        |
|  project_id?     |       |  status          |       |  description     |
|  frequency       |       +------------------+       +------------------+
|  cron_expression |
|  status          |       +------------------+
|  next_run_at     | ?---1 |    Projects      |
|  last_run_at     |------>|  id              |
+------------------+       |  name            |
                           +------------------+
```

---

## Schedule Struct

The Rust-side representation of a schedule:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Schedule {
    /// Unique identifier (UUID v4).
    pub id: String,
    /// Human-readable name for the schedule.
    pub name: String,
    /// The agent that executes this schedule.
    pub agent_id: String,
    /// The skill to invoke when the schedule fires.
    pub skill_id: String,
    /// Optional project scope. If set, the agent runs in this project's CWD.
    pub project_id: Option<String>,
    /// Recurrence pattern.
    pub frequency: ScheduleFrequency,
    /// Standard cron expression (5 fields: min hour dom month dow).
    pub cron_expression: String,
    /// Human-readable description of what this schedule does.
    pub description: String,
    /// Whether the schedule is active, paused, or disabled.
    pub status: ScheduleStatus,
    /// ISO 8601 timestamp of the next scheduled execution.
    pub next_run_at: String,
    /// ISO 8601 timestamp of the last execution, if any.
    pub last_run_at: Option<String>,
    /// ISO 8601 timestamp when the schedule was created.
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ScheduleFrequency {
    Daily,
    Weekly,
    Monthly,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ScheduleStatus {
    Active,
    Paused,
    Disabled,
}
```

### Validation Rules

| Field           | Constraint                                                        |
|-----------------|-------------------------------------------------------------------|
| name            | 1–64 characters, free text                                        |
| agent_id        | Must reference an existing agent                                   |
| skill_id        | Must reference a skill assigned to the referenced agent            |
| project_id      | If provided, must reference an existing project                    |
| cron_expression | Valid 5-field cron; rejected if unparseable                        |
| frequency       | Must be one of `daily`, `weekly`, `monthly`, `custom`              |
| status          | Must be one of `active`, `paused`, `disabled`                      |

---

## Cron Expressions

Schedules use standard 5-field cron expressions for maximum flexibility:

```
┌───────────── minute (0–59)
│ ┌───────────── hour (0–23)
│ │ ┌───────────── day of month (1–31)
│ │ │ ┌───────────── month (1–12)
│ │ │ │ ┌───────────── day of week (0–6, 0 = Sunday)
│ │ │ │ │
* * * * *
```

### Frequency Presets

The UI provides presets that generate cron expressions automatically:

| Frequency | Default Cron     | Description                       |
|-----------|------------------|-----------------------------------|
| Daily     | `0 9 * * *`      | Every day at 9:00 AM              |
| Weekly    | `0 9 * * 1`      | Every Monday at 9:00 AM           |
| Monthly   | `0 9 1 * *`      | First of every month at 9:00 AM   |
| Custom    | (user-provided)  | Any valid cron expression          |

For daily and weekly frequencies, the user selects a time (hour:minute). For weekly, the user also selects a day of the week. The frontend converts these selections into the corresponding cron expression before saving.

### Next Run Calculation

The `next_run_at` field is computed on the Rust side using the `cron` crate whenever a schedule is created or updated, or after each execution completes. The calculation considers the current local time and returns the next future match of the cron expression.

```rust
use cron::Schedule as CronSchedule;
use chrono::Utc;

fn compute_next_run(cron_expression: &str) -> Result<String, String> {
    let schedule: CronSchedule = cron_expression.parse().map_err(|e| e.to_string())?;
    let next = schedule.upcoming(Utc).next().ok_or("No upcoming time")?;
    Ok(next.to_rfc3339())
}
```

---

## Scheduling Engine

The scheduling engine runs as a background task on the Rust side, checking for due schedules at a configurable interval (default: 60 seconds).

### Engine Loop

```
Application Start
       |
       v
  Start scheduler thread
       |
       v
  ┌─> Sleep for check_interval (60s)
  |       |
  |       v
  |   Query: SELECT * FROM schedules
  |         WHERE status = 'active'
  |         AND next_run_at <= NOW()
  |       |
  |       v
  |   For each due schedule:
  |     1. Emit "schedule:trigger" event to frontend
  |     2. Spawn agent with skill in project context
  |     3. Update last_run_at = NOW()
  |     4. Compute and update next_run_at
  |     5. Insert history event (type = "schedule_trigger")
  |       |
  └───────┘
```

### Concurrency

- Schedules that fire while the designated agent is already running are queued. The agent's existing task must complete before the scheduled task begins.
- If the `max_concurrent_agents` limit from settings would be exceeded, the schedule trigger is deferred until a slot opens.
- A schedule that fails to execute (agent error, timeout) logs the failure to the history store and advances `next_run_at` to the next occurrence. It does not retry the failed run.

### Missed Schedules

If the application was closed when a schedule was due (e.g., the machine was off), the scheduler does **not** retroactively execute missed runs. On startup, it computes the next future `next_run_at` for all active schedules and proceeds from there.

---

## SQLite Schema

```sql
CREATE TABLE IF NOT EXISTS schedules (
    id               TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    agent_id         TEXT NOT NULL,
    skill_id         TEXT NOT NULL,
    project_id       TEXT,
    frequency        TEXT NOT NULL DEFAULT 'daily',
    cron_expression  TEXT NOT NULL,
    description      TEXT NOT NULL DEFAULT '',
    status           TEXT NOT NULL DEFAULT 'active',
    next_run_at      TEXT NOT NULL,
    last_run_at      TEXT,
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (agent_id) REFERENCES agents (id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES skills (id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE SET NULL
);

CREATE INDEX idx_schedules_status ON schedules (status);
CREATE INDEX idx_schedules_next_run ON schedules (next_run_at);
CREATE INDEX idx_schedules_agent ON schedules (agent_id);
```

### Notes on Schema Design

- `project_id` uses `ON DELETE SET NULL`. If a project is deleted, the schedule becomes unscoped rather than deleted.
- `agent_id` and `skill_id` use `ON DELETE CASCADE`. Deleting the agent or skill removes the schedule.
- `frequency` is stored as text (`daily`, `weekly`, `monthly`, `custom`) for readability.
- `status` is stored as text (`active`, `paused`, `disabled`) for the same reason.
- Timestamps use ISO 8601 text format for cross-platform compatibility.

---

## IPC Commands

### list_schedules

Returns all schedules, sorted by `next_run_at` ascending.

```rust
#[tauri::command]
pub async fn list_schedules(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Schedule>, String> { ... }
```

### create_schedule

Creates a new schedule. Computes `next_run_at` from the cron expression. Returns the created `Schedule`.

```rust
#[tauri::command]
pub async fn create_schedule(
    state: tauri::State<'_, AppState>,
    name: String,
    agent_id: String,
    skill_id: String,
    project_id: Option<String>,
    frequency: String,
    cron_expression: String,
    description: String,
) -> Result<Schedule, String> { ... }
```

### update_schedule

Updates a schedule by ID. Recomputes `next_run_at` if `cron_expression` changes.

```rust
#[tauri::command]
pub async fn update_schedule(
    state: tauri::State<'_, AppState>,
    schedule_id: String,
    patch: SchedulePatch,
) -> Result<Schedule, String> { ... }
```

### delete_schedule

Deletes a schedule by ID.

```rust
#[tauri::command]
pub async fn delete_schedule(
    state: tauri::State<'_, AppState>,
    schedule_id: String,
) -> Result<(), String> { ... }
```

### toggle_schedule_status

Toggles a schedule between `active` and `paused`. Recomputes `next_run_at` when activating.

```rust
#[tauri::command]
pub async fn toggle_schedule_status(
    state: tauri::State<'_, AppState>,
    schedule_id: String,
) -> Result<Schedule, String> { ... }
```

### Command Registration

```rust
tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
        list_schedules,
        create_schedule,
        update_schedule,
        delete_schedule,
        toggle_schedule_status,
    ])
```

---

## Tauri Events

| Event Name          | Direction      | Payload                                      |
|---------------------|----------------|----------------------------------------------|
| `schedule:trigger`  | Rust → Frontend | `{ schedule_id, agent_id, skill_id, project_id }` |
| `schedule:complete` | Rust → Frontend | `{ schedule_id, status: "success" \| "failure", duration_ms }` |
| `schedule:updated`  | Rust → Frontend | `{ schedule: Schedule }` (after next_run_at recompute) |

---

## Zustand Store

```typescript
import { create } from "zustand";

export type ScheduleFrequency = "daily" | "weekly" | "monthly" | "custom";
export type ScheduleStatus = "active" | "paused" | "disabled";

export interface Schedule {
  id: string;
  name: string;
  agentId: string;
  skillId: string;
  projectId: string | null;
  frequency: ScheduleFrequency;
  cronExpression: string;
  description: string;
  status: ScheduleStatus;
  nextRunAt: string;
  lastRunAt: string | null;
  createdAt: string;
}

interface ScheduleStore {
  schedules: Schedule[];
  addSchedule: (schedule: Omit<Schedule, "id" | "createdAt">) => void;
  removeSchedule: (id: string) => void;
  updateSchedule: (id: string, patch: Partial<Schedule>) => void;
  toggleStatus: (id: string) => void;
}
```

---

## References

- [Agent Manager](agent-manager.md) — agent lifecycle and spawning
- [Skill Pool](skill-pool.md) — skill registry and assignment
- [Activity History](activity-history.md) — schedule triggers logged as history events
- [Persistence](persistence.md) — SQLite access patterns
- [Left Sidebar -- Schedules](../03-ui-ux/sidebar-left-schedules.md) — UI specification
