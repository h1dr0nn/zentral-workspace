# Workflows

> Multi-step agent pipelines that chain skills across agents with conditional branching, enabling complex automated task sequences.

> **Status:** draft
> **Last updated:** 2026-03-25

---

## Overview

A Workflow is an ordered sequence of steps, each binding an agent to a skill. When a workflow executes, it runs steps in order, passing context from one to the next. Steps can define branching logic: on success, proceed to step N; on failure, branch to step M or halt.

Workflows transform the multi-agent system from a collection of independent specialists into a coordinated pipeline. A typical example: Koda writes code, Prova runs tests, and if tests pass, Vex commits — all triggered by a single workflow execution.

```
Workflow: "Code Review Pipeline"
Status: active
Project: my-app

  ┌─────────────────┐
  │  Step 1          │
  │  Koda: /simplify │
  └────────┬────────┘
           │ on success
           v
  ┌─────────────────┐
  │  Step 2          │
  │  Prova: /test    │
  └────────┬────────┘
        ┌──┴──┐
   success   failure
        │       │
        v       v
  ┌──────────┐ ┌──────────┐
  │  Step 3   │ │  (halt)  │
  │  Vex:     │ │  Log err │
  │  /commit  │ └──────────┘
  └──────────┘
```

---

## Data Model

### Workflow

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workflow {
    /// Unique identifier (UUID v4).
    pub id: String,
    /// Human-readable name.
    pub name: String,
    /// Description of what this workflow does.
    pub description: String,
    /// Optional project scope.
    pub project_id: Option<String>,
    /// Lifecycle status.
    pub status: WorkflowStatus,
    /// Ordered steps in this workflow.
    pub steps: Vec<WorkflowStep>,
    /// ISO 8601 creation timestamp.
    pub created_at: String,
    /// ISO 8601 timestamp of last execution.
    pub last_run_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WorkflowStatus {
    Draft,   // Not yet ready to run
    Active,  // Can be triggered manually or by schedule
    Paused,  // Temporarily disabled
}
```

### WorkflowStep

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowStep {
    /// Unique identifier within the workflow.
    pub id: String,
    /// Agent responsible for this step.
    pub agent_id: String,
    /// Skill to execute.
    pub skill_id: String,
    /// Human-readable label for display.
    pub label: String,
    /// Position in the execution order (0-based).
    pub order: u32,
    /// Step ID to execute on success. None = proceed to next in order.
    pub on_success: Option<String>,
    /// Step ID to execute on failure. None = halt workflow.
    pub on_failure: Option<String>,
}
```

### Validation Rules

| Field       | Constraint                                                       |
|-------------|------------------------------------------------------------------|
| name        | 1–64 characters, free text                                       |
| description | 0–256 characters, free text                                      |
| project_id  | If provided, must reference an existing project                  |
| status      | One of `draft`, `active`, `paused`                               |
| steps       | At least 1 step required; max 20 steps                           |
| step.agent_id | Must reference an existing agent                              |
| step.skill_id | Must reference a skill assigned to the step's agent            |
| step.order  | Must be unique within the workflow and form a contiguous range    |
| step.on_success | If provided, must reference another step ID in same workflow |
| step.on_failure | If provided, must reference another step ID in same workflow |

---

## Execution Engine

### Execution Flow

```
User clicks "Run" on workflow
       |
       v
  Validate workflow:
  - All referenced agents exist and are available
  - All referenced skills are still assigned
  - Workflow status is "active"
       |
       v
  Create WorkflowRun record (status = "running")
       |
       v
  Execute Step 1:
    1. Spawn agent with skill in project context
    2. Wait for completion
    3. Record step result (success/failure/timeout)
       |
       v
  Determine next step:
    - If success and on_success defined → go to that step
    - If success and on_success not defined → go to next by order
    - If failure and on_failure defined → go to that step
    - If failure and on_failure not defined → halt workflow
       |
       v
  Continue until:
    - No more steps → workflow complete (success)
    - Halt triggered → workflow complete (partial/failure)
    - All steps done → record final status
       |
       v
  Update workflow.last_run_at
  Insert history event (type = "workflow_run")
  Emit "workflow:complete" event
```

### WorkflowRun

Each execution of a workflow creates a run record for tracking:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowRun {
    pub id: String,
    pub workflow_id: String,
    pub status: WorkflowRunStatus,
    pub current_step_id: Option<String>,
    pub step_results: Vec<StepResult>,
    pub started_at: String,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WorkflowRunStatus {
    Running,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StepResult {
    pub step_id: String,
    pub status: String,      // "success" | "failure" | "skipped"
    pub duration_ms: u64,
    pub output: Option<String>,
}
```

### Concurrency

- Only one run of a given workflow can be active at a time. Attempting to start a workflow that is already running returns an error.
- Steps within a workflow execute sequentially, never in parallel. Parallel step execution is a potential future enhancement.
- If a step's designated agent is busy with another task, the step waits until the agent is available (respecting the global agent concurrency limit).

### Timeout

- Each step has a default timeout of 5 minutes (configurable per-workflow in the future).
- If a step exceeds its timeout, it is marked as failed and the on_failure branch is followed.
- The overall workflow has no timeout — it completes when all applicable steps finish or the pipeline halts.

---

## SQLite Schema

```sql
CREATE TABLE IF NOT EXISTS workflows (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    description  TEXT NOT NULL DEFAULT '',
    project_id   TEXT,
    status       TEXT NOT NULL DEFAULT 'draft',
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    last_run_at  TEXT,
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS workflow_steps (
    id           TEXT PRIMARY KEY,
    workflow_id  TEXT NOT NULL,
    agent_id     TEXT NOT NULL,
    skill_id     TEXT NOT NULL,
    label        TEXT NOT NULL DEFAULT '',
    step_order   INTEGER NOT NULL,
    on_success   TEXT,
    on_failure   TEXT,
    FOREIGN KEY (workflow_id) REFERENCES workflows (id) ON DELETE CASCADE,
    FOREIGN KEY (agent_id) REFERENCES agents (id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES skills (id) ON DELETE CASCADE,
    FOREIGN KEY (on_success) REFERENCES workflow_steps (id) ON DELETE SET NULL,
    FOREIGN KEY (on_failure) REFERENCES workflow_steps (id) ON DELETE SET NULL,
    UNIQUE (workflow_id, step_order)
);

CREATE TABLE IF NOT EXISTS workflow_runs (
    id            TEXT PRIMARY KEY,
    workflow_id   TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'running',
    current_step  TEXT,
    started_at    TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at  TEXT,
    FOREIGN KEY (workflow_id) REFERENCES workflows (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS workflow_step_results (
    id           TEXT PRIMARY KEY,
    run_id       TEXT NOT NULL,
    step_id      TEXT NOT NULL,
    status       TEXT NOT NULL,
    duration_ms  INTEGER,
    output       TEXT,
    FOREIGN KEY (run_id) REFERENCES workflow_runs (id) ON DELETE CASCADE,
    FOREIGN KEY (step_id) REFERENCES workflow_steps (id) ON DELETE CASCADE
);

CREATE INDEX idx_workflow_steps_workflow ON workflow_steps (workflow_id, step_order);
CREATE INDEX idx_workflow_runs_workflow ON workflow_runs (workflow_id);
CREATE INDEX idx_workflow_runs_status ON workflow_runs (status);
```

---

## IPC Commands

### list_workflows

Returns all workflows with their steps, sorted by name.

```rust
#[tauri::command]
pub async fn list_workflows(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Workflow>, String> { ... }
```

### create_workflow

Creates a workflow with initial steps. Returns the created `Workflow`.

```rust
#[tauri::command]
pub async fn create_workflow(
    state: tauri::State<'_, AppState>,
    name: String,
    description: String,
    project_id: Option<String>,
    status: String,
    steps: Vec<WorkflowStepInput>,
) -> Result<Workflow, String> { ... }
```

### update_workflow

Updates workflow metadata (name, description, status). Does not modify steps.

```rust
#[tauri::command]
pub async fn update_workflow(
    state: tauri::State<'_, AppState>,
    workflow_id: String,
    patch: WorkflowPatch,
) -> Result<Workflow, String> { ... }
```

### delete_workflow

Deletes a workflow and all its steps (via CASCADE).

```rust
#[tauri::command]
pub async fn delete_workflow(
    state: tauri::State<'_, AppState>,
    workflow_id: String,
) -> Result<(), String> { ... }
```

### add_workflow_step / remove_workflow_step / update_workflow_step / reorder_workflow_steps

Step management commands. Reorder accepts a list of step IDs in the desired order and updates `step_order` accordingly.

```rust
#[tauri::command]
pub async fn add_workflow_step(...) -> Result<WorkflowStep, String> { ... }

#[tauri::command]
pub async fn remove_workflow_step(...) -> Result<(), String> { ... }

#[tauri::command]
pub async fn update_workflow_step(...) -> Result<WorkflowStep, String> { ... }

#[tauri::command]
pub async fn reorder_workflow_steps(
    state: tauri::State<'_, AppState>,
    workflow_id: String,
    step_ids: Vec<String>,
) -> Result<(), String> { ... }
```

### run_workflow

Starts a workflow execution. Returns the created `WorkflowRun`.

```rust
#[tauri::command]
pub async fn run_workflow(
    state: tauri::State<'_, AppState>,
    workflow_id: String,
) -> Result<WorkflowRun, String> { ... }
```

### cancel_workflow_run

Cancels a running workflow. The current step is aborted and no further steps execute.

```rust
#[tauri::command]
pub async fn cancel_workflow_run(
    state: tauri::State<'_, AppState>,
    run_id: String,
) -> Result<(), String> { ... }
```

---

## Tauri Events

| Event Name             | Direction       | Payload                                           |
|------------------------|-----------------|----------------------------------------------------|
| `workflow:step_start`  | Rust → Frontend | `{ run_id, step_id, agent_id, skill_id }`          |
| `workflow:step_done`   | Rust → Frontend | `{ run_id, step_id, status, duration_ms }`          |
| `workflow:complete`    | Rust → Frontend | `{ run_id, workflow_id, status, total_duration_ms }` |
| `workflow:error`       | Rust → Frontend | `{ run_id, step_id, error_message }`                |

---

## Zustand Store

```typescript
import { create } from "zustand";

export type WorkflowStatus = "draft" | "active" | "paused";

export interface WorkflowStep {
  id: string;
  agentId: string;
  skillId: string;
  label: string;
  order: number;
  onSuccess?: string;
  onFailure?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  projectId: string | null;
  status: WorkflowStatus;
  steps: WorkflowStep[];
  createdAt: string;
  lastRunAt: string | null;
}

interface WorkflowStore {
  workflows: Workflow[];
  activeWorkflowId: string | null;
  addWorkflow: (workflow: Omit<Workflow, "id" | "createdAt">) => void;
  removeWorkflow: (id: string) => void;
  updateWorkflow: (id: string, patch: Partial<Workflow>) => void;
  setActiveWorkflow: (id: string | null) => void;
  addStep: (workflowId: string, step: Omit<WorkflowStep, "id">) => void;
  removeStep: (workflowId: string, stepId: string) => void;
  updateStep: (workflowId: string, stepId: string, patch: Partial<WorkflowStep>) => void;
  reorderSteps: (workflowId: string, stepIds: string[]) => void;
}
```

---

## References

- [Agent Manager](agent-manager.md) — agent spawning and lifecycle
- [Skill Pool](skill-pool.md) — skill registry referenced by steps
- [Schedules](schedules.md) — workflows can be triggered by schedules
- [Activity History](activity-history.md) — workflow runs logged as history events
- [Persistence](persistence.md) — SQLite access patterns
- [Left Sidebar -- Workflows](../03-ui-ux/sidebar-left-workflows.md) — UI specification
