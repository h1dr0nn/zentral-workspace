# Skill Pool

> Global registry of capabilities that can be assigned to agents, used by the secretary for skill-based task routing.

> **Status:** draft
> **Last updated:** 2026-03-24

---

## Overview

The Skill Pool is a global registry of capabilities that can be assigned to agents within a Zentral workspace. Each skill represents a discrete area of expertise -- "testing", "docker", "frontend" -- that describes what an agent is qualified to do. When a user creates or edits an agent, they select skills from the pool via a checkbox grid. The secretary agent uses these skill assignments at routing time to match incoming tasks to the most capable agent.

Skills are stored in SQLite alongside agent definitions. The system ships with a set of built-in skills covering common development workflows, and users can extend the pool with custom skills at any time.

```
+------------------+       +------------------+       +------------------+
|   Skill Pool     |       |  agent_skills    |       |     Agents       |
|                  | 1---N |  (junction)      | N---1 |                  |
|  id              |------>|  skill_id        |<------|  id              |
|  name            |       |  agent_id        |       |  name            |
|  category        |       |  assigned_at     |       |  role            |
|  description     |       +------------------+       |  skills: [...]   |
|  is_builtin      |                                  +------------------+
|  created_at      |
+------------------+

            Secretary reads agent skills at routing time
            +--------------------------------------------------+
            |  Task: "write unit tests for the login form"     |
            |                                                  |
            |  Agent A  [testing, frontend]  => score: 2  WIN  |
            |  Agent B  [backend, database]  => score: 0       |
            |  Agent C  [testing, backend]   => score: 1       |
            +--------------------------------------------------+
```

---

## Skill Struct

The Rust-side representation of a skill:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Skill {
    /// Unique identifier (UUID v4).
    pub id: String,
    /// Short machine-friendly name: "testing", "docker", "ci-cd".
    pub name: String,
    /// Human-readable explanation of what the skill covers.
    pub description: String,
    /// Grouping category: "development", "devops", "quality".
    pub category: String,
    /// True for skills that ship with the application.
    /// Built-in skills cannot be deleted or renamed by the user.
    pub is_builtin: bool,
    /// Unix timestamp (seconds) when the skill was created.
    pub created_at: i64,
}
```

### Validation Rules

| Field       | Constraint                                                  |
|-------------|-------------------------------------------------------------|
| name        | 1-48 characters, lowercase alphanumeric plus hyphens only   |
| description | 1-256 characters, free text                                 |
| category    | Must be one of the known categories or a user-defined label |
| is_builtin  | Read-only after creation; user cannot toggle this           |

---

## Built-in Skills

The following skills are seeded into the database on first launch. They cover the most common task domains encountered in software development workflows. All built-in skills have `is_builtin = true`.

| Name       | Category    | Description                                        |
|------------|-------------|----------------------------------------------------|
| testing    | quality     | Write and run tests                                |
| review     | quality     | Code review and feedback                           |
| refactor   | development | Restructure and improve code                       |
| frontend   | development | UI/UX implementation                               |
| backend    | development | Server-side logic                                  |
| database   | development | Schema design, queries, migrations                 |
| docker     | devops      | Containerization and Docker configs                |
| ci-cd      | devops      | CI/CD pipeline configuration                       |
| deploy     | devops      | Deployment and release management                  |
| security   | quality     | Security auditing and fixes                        |
| docs       | development | Documentation writing                              |
| debug      | development | Debugging and troubleshooting                      |

### Seeding Logic

On application startup, the persistence layer checks whether the `skills` table is empty. If it is, the built-in skills are inserted in a single transaction. If the table already contains rows, no seeding occurs. This means users who delete a built-in skill will not have it re-created on the next launch; a separate "restore defaults" command handles that case.

```rust
pub fn seed_builtin_skills(conn: &rusqlite::Connection) -> Result<(), rusqlite::Error> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM skills", [], |r| r.get(0))?;
    if count > 0 {
        return Ok(());
    }

    let builtins = vec![
        ("testing",  "quality",     "Write and run tests"),
        ("review",   "quality",     "Code review and feedback"),
        ("refactor", "development", "Restructure and improve code"),
        ("frontend", "development", "UI/UX implementation"),
        ("backend",  "development", "Server-side logic"),
        ("database", "development", "Schema design, queries, migrations"),
        ("docker",   "devops",      "Containerization and Docker configs"),
        ("ci-cd",    "devops",      "CI/CD pipeline configuration"),
        ("deploy",   "devops",      "Deployment and release management"),
        ("security", "quality",     "Security auditing and fixes"),
        ("docs",     "development", "Documentation writing"),
        ("debug",    "development", "Debugging and troubleshooting"),
    ];

    let tx = conn.unchecked_transaction()?;
    for (name, category, description) in builtins {
        tx.execute(
            "INSERT INTO skills (id, name, description, category, is_builtin, created_at)
             VALUES (?1, ?2, ?3, ?4, 1, strftime('%s', 'now'))",
            rusqlite::params![uuid::Uuid::new_v4().to_string(), name, description, category],
        )?;
    }
    tx.commit()
}
```

---

## Custom Skills

Users can create custom skills to represent domain-specific capabilities that the built-in set does not cover. Examples: "kubernetes", "graphql", "machine-learning", "terraform".

Custom skills follow the same `Skill` struct but always have `is_builtin = false`. They can be freely renamed, re-described, re-categorized, or deleted. Deleting a custom skill cascades to the `agent_skills` junction table, removing all assignments.

### Custom Skill Lifecycle

```
User clicks "Add Skill" in Skill Pool UI
         |
         v
   Fill name, description, category
         |
         v
   Frontend calls create_skill IPC command
         |
         v
   Rust validates fields, generates UUID, inserts row
         |
         v
   Skill appears in pool, available for assignment
```

---

## Skill Assignment

The relationship between agents and skills is many-to-many. One agent can possess any number of skills, and a single skill can be assigned to any number of agents.

### Junction Table

The `agent_skills` table links agents to skills. It carries an `assigned_at` timestamp for audit purposes.

### Assignment Rules

- An agent can have zero skills. Agents with no skills are treated as generalists by the secretary -- they receive tasks only when no specialist matches.
- There is no upper limit on the number of skills per agent, but the UI encourages focus by displaying a warning when an agent has more than six skills ("too many specializations dilutes focus").
- Duplicate assignments (same agent + same skill) are prevented by the primary key constraint.

---

## SQLite Schema

```sql
CREATE TABLE IF NOT EXISTS skills (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    category    TEXT NOT NULL DEFAULT 'development',
    is_builtin  INTEGER NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX idx_skills_category ON skills (category);
CREATE INDEX idx_skills_name ON skills (name);

CREATE TABLE IF NOT EXISTS agent_skills (
    agent_id    TEXT NOT NULL,
    skill_id    TEXT NOT NULL,
    assigned_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    PRIMARY KEY (agent_id, skill_id),
    FOREIGN KEY (agent_id) REFERENCES agents (id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES skills (id) ON DELETE CASCADE
);

CREATE INDEX idx_agent_skills_agent ON agent_skills (agent_id);
CREATE INDEX idx_agent_skills_skill ON agent_skills (skill_id);
```

### Notes on Schema Design

- `skills.name` has a UNIQUE constraint. Two skills cannot share the same name regardless of category.
- `agent_skills` uses a composite primary key `(agent_id, skill_id)` which inherently prevents duplicate assignments.
- Both foreign keys use `ON DELETE CASCADE`. Deleting an agent removes its skill assignments; deleting a skill removes it from all agents.
- `is_builtin` is stored as an integer (0 or 1) because SQLite has no native boolean type.

---

## Secretary Routing with Skills

The secretary agent is the central dispatcher in a multi-agent workspace. When a task arrives, the secretary must decide which agent should handle it. Skills are the primary signal for this decision.

### Routing Algorithm

1. The secretary receives a task description (either from the user or decomposed from a larger task).
2. The secretary's system prompt contains a roster of all active agents and their assigned skills.
3. The secretary analyzes the task and identifies required skill keywords. This analysis is performed by the LLM itself -- there is no deterministic keyword extraction step.
4. The secretary scores each agent by counting how many of its skills match the task requirements.
5. The agent with the highest score receives the task. Ties are broken by the secretary's judgment (it may consider agent workload, recent context, or specificity of match).

### Secretary System Prompt Injection

When the secretary is initialized, its system prompt is constructed to include the full agent roster with skills:

```
You are the secretary agent for this workspace. Your job is to route
tasks to the most appropriate agent based on their skills.

Available agents:

- Agent "alice" (skills: testing, frontend, review)
  Specializes in writing tests and reviewing UI code.

- Agent "bob" (skills: backend, database, docker)
  Specializes in server-side development and infrastructure.

- Agent "carol" (skills: security, review, debug)
  Specializes in security audits and debugging.

When you receive a task, determine which skills are needed and assign
the task to the agent whose skills best match. If no agent is a clear
fit, assign to the agent with the most relevant partial overlap.
```

### Scoring Example

```
Task: "Add integration tests for the checkout API endpoint"

Required skills (inferred by secretary): testing, backend

Agent alice  [testing, frontend, review]   => matches: testing          => score: 1
Agent bob    [backend, database, docker]   => matches: backend          => score: 1
Agent carol  [security, review, debug]     => matches: (none)           => score: 0

Tie between alice and bob. Secretary breaks tie by noting "API endpoint"
leans backend. Routes to bob, or may split: bob writes the endpoint
logic, alice writes the tests.
```

---

## Skill Augmentation of Agent Prompts

When an agent is spawned to handle a task, its system prompt is augmented with its assigned skills. This focuses the agent's behavior toward its areas of expertise and away from tangential concerns.

### Augmentation Template

```
You are agent "{agent_name}" in a multi-agent workspace.

Your assigned skills are:
{for each skill}
- {skill.name}: {skill.description}
{end for}

Focus your work on these areas of expertise. If a task requires skills
outside your specialization, flag it for reassignment rather than
attempting it yourself.
```

### Concrete Example

An agent named "ui-specialist" with skills `testing` and `frontend`:

```
You are agent "ui-specialist" in a multi-agent workspace.

Your assigned skills are:
- testing: Write and run tests
- frontend: UI/UX implementation

Focus your work on these areas of expertise. If a task requires skills
outside your specialization, flag it for reassignment rather than
attempting it yourself.
```

This agent, when given a task like "implement the settings modal and add tests", will naturally focus on writing the React component and its associated test suite. If the task also requires a database migration, the agent should flag that portion for reassignment.

### Augmentation Timing

Prompt augmentation happens once when the agent process is created. Skill changes made while an agent is running do not take effect until the agent is restarted.

---

## IPC Commands

All skill operations are exposed to the frontend via Tauri IPC commands.

### list_skills

Returns all skills in the pool, sorted by category then name.

```rust
#[tauri::command]
pub async fn list_skills(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Skill>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, description, category, is_builtin, created_at FROM skills ORDER BY category, name")
        .map_err(|e| e.to_string())?;
    let skills = stmt
        .query_map([], |row| {
            Ok(Skill {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                category: row.get(3)?,
                is_builtin: row.get(4)?,
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(skills)
}
```

### create_skill

Creates a custom skill. Returns the newly created `Skill`.

```rust
#[tauri::command]
pub async fn create_skill(
    state: tauri::State<'_, AppState>,
    name: String,
    description: String,
    category: String,
) -> Result<Skill, String> { ... }
```

### delete_skill

Deletes a skill by ID. Rejects deletion of built-in skills.

```rust
#[tauri::command]
pub async fn delete_skill(
    state: tauri::State<'_, AppState>,
    skill_id: String,
) -> Result<(), String> { ... }
```

### assign_skill_to_agent

Creates a row in the `agent_skills` junction table. Returns an error if the assignment already exists.

```rust
#[tauri::command]
pub async fn assign_skill_to_agent(
    state: tauri::State<'_, AppState>,
    agent_id: String,
    skill_id: String,
) -> Result<(), String> { ... }
```

### remove_skill_from_agent

Removes a row from the `agent_skills` junction table.

```rust
#[tauri::command]
pub async fn remove_skill_from_agent(
    state: tauri::State<'_, AppState>,
    agent_id: String,
    skill_id: String,
) -> Result<(), String> { ... }
```

### get_agent_skills

Returns all skills assigned to a specific agent.

```rust
#[tauri::command]
pub async fn get_agent_skills(
    state: tauri::State<'_, AppState>,
    agent_id: String,
) -> Result<Vec<Skill>, String> { ... }
```

### Command Registration

All commands must be registered in the Tauri builder:

```rust
tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
        list_skills,
        create_skill,
        delete_skill,
        assign_skill_to_agent,
        remove_skill_from_agent,
        get_agent_skills,
    ])
```

---

## UI Integration

### Skill Picker Component

The skill picker is a checkbox grid used when creating or editing an agent. Skills are grouped by category, with each category displayed as a labeled section.

```
+----------------------------------------------------------+
|  Assign Skills                                           |
|                                                          |
|  DEVELOPMENT                                             |
|  [x] refactor    [x] frontend    [ ] backend            |
|  [ ] database    [ ] docs        [ ] debug              |
|                                                          |
|  DEVOPS                                                  |
|  [ ] docker      [ ] ci-cd       [ ] deploy             |
|                                                          |
|  QUALITY                                                 |
|  [x] testing     [ ] review      [ ] security           |
|                                                          |
|  CUSTOM                                                  |
|  [ ] kubernetes  [ ] terraform                           |
|                                                          |
|  [+ Add Custom Skill]                                    |
+----------------------------------------------------------+
```

### TypeScript Interface

```typescript
interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  is_builtin: boolean;
  created_at: number;
}

interface SkillPickerProps {
  selectedSkillIds: string[];
  onSelectionChange: (skillIds: string[]) => void;
}
```

### Skill Badges on Agent Cards

Each agent card in the sidebar displays small badges for its assigned skills. Badges are color-coded by category:

| Category    | Badge Color |
|-------------|-------------|
| development | Blue        |
| devops      | Orange      |
| quality     | Green       |

```
+-----------------------------------+
|  alice                       [ON] |
|  [testing] [frontend] [review]    |
|  Idle -- last active 2m ago       |
+-----------------------------------+
```

Badges are read-only on the agent card. Clicking the agent card opens the detail panel where the skill picker is available for editing.

### Zustand Store

The frontend maintains a Zustand store for skill state:

```typescript
import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

interface SkillStore {
  skills: Skill[];
  loading: boolean;
  fetchSkills: () => Promise<void>;
  createSkill: (name: string, description: string, category: string) => Promise<void>;
  deleteSkill: (skillId: string) => Promise<void>;
  assignSkill: (agentId: string, skillId: string) => Promise<void>;
  removeSkill: (agentId: string, skillId: string) => Promise<void>;
}

export const useSkillStore = create<SkillStore>((set, get) => ({
  skills: [],
  loading: false,

  fetchSkills: async () => {
    set({ loading: true });
    const skills = await invoke<Skill[]>("list_skills");
    set({ skills, loading: false });
  },

  createSkill: async (name, description, category) => {
    await invoke("create_skill", { name, description, category });
    await get().fetchSkills();
  },

  deleteSkill: async (skillId) => {
    await invoke("delete_skill", { skillId });
    await get().fetchSkills();
  },

  assignSkill: async (agentId, skillId) => {
    await invoke("assign_skill_to_agent", { agentId, skillId });
  },

  removeSkill: async (agentId, skillId) => {
    await invoke("remove_skill_from_agent", { agentId, skillId });
  },
}));
```

---

## References

- [Agent Detection](../03-specifications/agent-detection.md) -- how agents are identified in the process tree
- [Agent Adapters](../03-specifications/agent-adapters.md) -- per-agent output parsing
- [Session Management](../03-specifications/session-management.md) -- agent lifecycle within sessions
- [System Architecture](../02-architecture/system-architecture.md) -- overall Tauri + React + Rust architecture
- [Data Flow](../02-architecture/data-flow.md) -- IPC communication patterns
