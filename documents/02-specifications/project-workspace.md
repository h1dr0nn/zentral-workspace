# Project Workspace Management

> Manages registration, switching, and context detection for multiple project directories, propagating CWD changes to agents and the terminal.

> **Status:** draft
> **Last updated:** 2026-03-24

---

## Overview

The Project Workspace system gives users a way to register, switch between, and manage multiple project directories from the left sidebar. The active project determines the working directory for all running agents, the terminal panel, and context detection. The module lives at `src-tauri/src/project/mod.rs` and depends on the persistence layer for SQLite storage, the AgentManager for CWD propagation, and tauri-plugin-dialog for native file selection.

---

## Concepts

A **project** in Zentral is a reference to a directory on disk. Zentral never modifies the directory contents -- it only stores a pointer (the absolute path) in its own SQLite database. This means adding or removing a project in the sidebar is a metadata-only operation; no files are created, moved, or deleted on the user's filesystem.

The left sidebar displays all registered projects ordered by most recently opened. Clicking a project makes it active, which triggers a cascade of updates:

1. The terminal panel changes its working directory.
2. All running agents receive a CWD update via the AgentManager.
3. Context detection runs against the new directory.
4. The frontend receives a `project:changed` event and refreshes the UI.

```
User clicks project in sidebar
        |
        v
ProjectManager::switch(project_id)
        |
        +---> Update last_opened in SQLite
        |
        +---> Set active_project_id
        |
        +---> Notify AgentManager::update_cwd(new_path)
        |
        +---> Run context detection scan
        |
        +---> Emit "project:changed" Tauri event
        |
        v
Frontend updates sidebar highlight,
context badges, and terminal CWD
```

---

## Project Struct

```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Unique identifier for a project.
#[derive(Debug, Clone, Hash, Eq, PartialEq, Serialize, Deserialize)]
pub struct ProjectId(pub Uuid);

/// A registered project directory.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    /// Unique identifier (UUID v4).
    pub id: ProjectId,

    /// Human-readable name, derived from the directory name at registration time.
    /// The user may rename it later.
    pub name: String,

    /// Absolute path to the project directory on disk.
    pub path: String,

    /// Detected context markers for this project.
    pub contexts: Vec<ProjectContext>,

    /// When the project was first registered in Zentral.
    pub created_at: DateTime<Utc>,

    /// When the project was last set as the active project.
    pub last_opened: DateTime<Utc>,
}

/// Context types detected by scanning the project root directory.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ProjectContext {
    Git,
    Node,
    Rust,
    Python,
    Docker,
    Go,
    Java,
}
```

---

## ProjectManager Struct

```rust
use rusqlite::Connection;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

pub struct ProjectManager {
    /// All registered projects indexed by ID.
    projects: HashMap<ProjectId, Project>,

    /// The currently active project, if any.
    active_project_id: Option<ProjectId>,

    /// Shared SQLite connection for persistence.
    db: Arc<Mutex<Connection>>,

    /// Tauri app handle for emitting events.
    app: tauri::AppHandle,
}
```

---

## Adding Projects

The user clicks "Add Project" in the left sidebar. This opens a native directory picker via `tauri-plugin-dialog`. The selected path goes through validation before insertion.

### Flow

```
User clicks "Add Project"
        |
        v
Frontend calls invoke("add_project")
        |
        v
Tauri command opens native directory picker
(tauri-plugin-dialog FileDialogBuilder)
        |
        v
User selects a directory
        |
        +---> Validate: path exists on disk?
        |        |
        |        No ---> Return Err("Directory does not exist")
        |
        +---> Validate: path already registered?
        |        |
        |        Yes --> Return Err("Project already registered")
        |
        +---> Extract directory name as default project name
        |
        +---> Run context detection on the directory
        |
        +---> Insert into SQLite
        |
        +---> Add to in-memory HashMap
        |
        +---> Emit "project:list-updated" event
        |
        v
Frontend refreshes project list
```

### Implementation

```rust
use tauri_plugin_dialog::DialogExt;

impl ProjectManager {
    pub async fn add_project(&mut self, app: &tauri::AppHandle) -> Result<ProjectId> {
        // Open native directory picker.
        let path = app
            .dialog()
            .file()
            .set_title("Select Project Directory")
            .blocking_pick_folder()
            .ok_or(Error::DialogCancelled)?
            .path
            .to_string_lossy()
            .to_string();

        // Validate path exists.
        if !std::path::Path::new(&path).is_dir() {
            return Err(Error::DirectoryNotFound(path));
        }

        // Reject duplicates.
        if self.projects.values().any(|p| p.path == path) {
            return Err(Error::ProjectAlreadyExists(path));
        }

        // Derive name from directory.
        let name = std::path::Path::new(&path)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| path.clone());

        // Detect context markers.
        let contexts = detect_project_contexts(&path);

        let now = Utc::now();
        let project = Project {
            id: ProjectId(Uuid::new_v4()),
            name,
            path,
            contexts,
            created_at: now,
            last_opened: now,
        };

        self.db_insert_project(&project)?;
        let id = project.id.clone();
        self.projects.insert(id.clone(), project);
        self.emit_list_updated();

        Ok(id)
    }
}
```

---

## Switching Projects

When the user clicks a project entry in the sidebar, the ProjectManager sets it as active and propagates the change to all subsystems.

### Implementation

```rust
impl ProjectManager {
    pub fn switch(&mut self, id: &ProjectId, agent_mgr: &mut AgentManager) -> Result<()> {
        let project = self.projects.get_mut(id).ok_or(Error::ProjectNotFound)?;

        // Validate the directory still exists on disk.
        if !std::path::Path::new(&project.path).is_dir() {
            project.contexts = vec![];
            return Err(Error::DirectoryMissing(project.path.clone()));
        }

        // Update last_opened timestamp.
        project.last_opened = Utc::now();
        self.db_update_last_opened(id, project.last_opened)?;

        // Re-run context detection (directory contents may have changed).
        project.contexts = detect_project_contexts(&project.path);

        // Set as active.
        self.active_project_id = Some(id.clone());

        // Propagate CWD to all running agents.
        let new_cwd = PathBuf::from(&project.path);
        agent_mgr.update_cwd(new_cwd);

        // Notify the frontend.
        let _ = self.app.emit("project:changed", &project);

        Ok(())
    }
}
```

### What Happens on Switch

| Subsystem      | Action                                                           |
|----------------|------------------------------------------------------------------|
| AgentManager   | Calls `update_cwd()` for all running agents (see agent-manager.md). |
| Terminal panel  | Receives `project:changed` event, sends `cd <path>` to the shell. |
| Context sidebar | Refreshes detected contexts and displays updated badges.          |
| Secretary agent | Learns the new project type for better task understanding.        |
| Left sidebar   | Highlights the newly active project entry.                        |

---

## Removing Projects

Removing a project deletes the record from SQLite and the in-memory HashMap. It does **not** delete any files from disk. A confirmation dialog is shown before removal.

```rust
impl ProjectManager {
    pub fn remove(&mut self, id: &ProjectId) -> Result<()> {
        let project = self.projects.get(id).ok_or(Error::ProjectNotFound)?;

        // If this is the active project, clear the active state.
        if self.active_project_id.as_ref() == Some(id) {
            self.active_project_id = None;
        }

        self.db_delete_project(id)?;
        self.projects.remove(id);
        self.emit_list_updated();

        Ok(())
    }
}
```

The frontend shows a confirmation dialog before calling the `remove_project` command:

```typescript
import { ask } from "@tauri-apps/plugin-dialog";

async function handleRemoveProject(id: string) {
  const confirmed = await ask(
    "Remove this project from Zentral? No files will be deleted.",
    { title: "Remove Project", kind: "warning" }
  );
  if (confirmed) {
    await invoke("remove_project", { id });
  }
}
```

---

## Context Detection

When a project is added or switched to, Zentral scans the project root for well-known marker files and directories. This is a synchronous, non-recursive scan that only checks the top-level directory.

### Marker Table

| Marker File                         | Detected Context |
|--------------------------------------|------------------|
| `.git/`                             | Git              |
| `package.json`                      | Node             |
| `Cargo.toml`                        | Rust             |
| `pyproject.toml`, `requirements.txt` | Python           |
| `Dockerfile`, `docker-compose.yml`  | Docker           |
| `go.mod`                            | Go               |
| `pom.xml`, `build.gradle`           | Java             |

### Implementation

```rust
use std::path::Path;

pub fn detect_project_contexts(project_path: &str) -> Vec<ProjectContext> {
    let root = Path::new(project_path);
    let mut contexts = Vec::new();

    if root.join(".git").is_dir() {
        contexts.push(ProjectContext::Git);
    }
    if root.join("package.json").is_file() {
        contexts.push(ProjectContext::Node);
    }
    if root.join("Cargo.toml").is_file() {
        contexts.push(ProjectContext::Rust);
    }
    if root.join("pyproject.toml").is_file() || root.join("requirements.txt").is_file() {
        contexts.push(ProjectContext::Python);
    }
    if root.join("Dockerfile").is_file() || root.join("docker-compose.yml").is_file() {
        contexts.push(ProjectContext::Docker);
    }
    if root.join("go.mod").is_file() {
        contexts.push(ProjectContext::Go);
    }
    if root.join("pom.xml").is_file() || root.join("build.gradle").is_file() {
        contexts.push(ProjectContext::Java);
    }

    contexts
}
```

### Context Usage

Context information serves two purposes:

1. **UI display** -- small badges (Git, Node, Rust, etc.) shown on each project card in the left sidebar, giving the user a quick visual summary.
2. **Secretary intelligence** -- the Secretary agent receives the detected contexts when a project switches, which helps it understand the project type and choose appropriate skills when delegating tasks to worker agents.

---

## Recent Projects Ordering

Projects in the sidebar are always sorted by `last_opened` in descending order (most recent first). This sort is applied both at the database query level and in the frontend store.

```rust
impl ProjectManager {
    /// Return all projects sorted by last_opened descending.
    pub fn list_projects(&self) -> Vec<&Project> {
        let mut projects: Vec<&Project> = self.projects.values().collect();
        projects.sort_by(|a, b| b.last_opened.cmp(&a.last_opened));
        projects
    }
}
```

When loading from SQLite at startup, the query uses `ORDER BY last_opened DESC` directly:

```sql
SELECT id, name, path, contexts, created_at, last_opened
FROM projects
ORDER BY last_opened DESC;
```

---

## SQLite Schema

### Table Definition

```sql
CREATE TABLE IF NOT EXISTS projects (
    id          TEXT PRIMARY KEY,            -- UUID v4
    name        TEXT NOT NULL,               -- display name (directory name by default)
    path        TEXT NOT NULL UNIQUE,        -- absolute path on disk
    contexts    TEXT NOT NULL DEFAULT '[]',  -- JSON array of ProjectContext values
    created_at  TEXT NOT NULL,               -- ISO 8601 timestamp
    last_opened TEXT NOT NULL                -- ISO 8601 timestamp
);

CREATE INDEX idx_projects_last_opened ON projects(last_opened);
```

### Uniqueness Constraint

The `path` column has a `UNIQUE` constraint. This prevents the same directory from being registered twice. If a user tries to add a duplicate, the Rust code catches it before hitting the database (see "Adding Projects" above), but the constraint acts as a safety net.

### CRUD Operations

```rust
impl ProjectManager {
    /// Insert a new project row.
    fn db_insert_project(&self, project: &Project) -> Result<()> {
        let db = self.db.lock().unwrap();
        db.execute(
            "INSERT INTO projects (id, name, path, contexts, created_at, last_opened)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![
                project.id.0.to_string(),
                project.name,
                project.path,
                serde_json::to_string(&project.contexts)?,
                project.created_at.to_rfc3339(),
                project.last_opened.to_rfc3339(),
            ],
        )?;
        Ok(())
    }

    /// Update the last_opened timestamp for a project.
    fn db_update_last_opened(&self, id: &ProjectId, ts: DateTime<Utc>) -> Result<()> {
        let db = self.db.lock().unwrap();
        db.execute(
            "UPDATE projects SET last_opened = ?1 WHERE id = ?2",
            rusqlite::params![ts.to_rfc3339(), id.0.to_string()],
        )?;
        Ok(())
    }

    /// Update the contexts column after a re-scan.
    fn db_update_contexts(&self, id: &ProjectId, contexts: &[ProjectContext]) -> Result<()> {
        let db = self.db.lock().unwrap();
        db.execute(
            "UPDATE projects SET contexts = ?1 WHERE id = ?2",
            rusqlite::params![
                serde_json::to_string(contexts)?,
                id.0.to_string(),
            ],
        )?;
        Ok(())
    }

    /// Delete a project row permanently.
    fn db_delete_project(&self, id: &ProjectId) -> Result<()> {
        let db = self.db.lock().unwrap();
        db.execute(
            "DELETE FROM projects WHERE id = ?1",
            rusqlite::params![id.0.to_string()],
        )?;
        Ok(())
    }

    /// Load all projects from SQLite, ordered by last_opened descending.
    fn db_load_all(&self) -> Result<Vec<Project>> {
        let db = self.db.lock().unwrap();
        let mut stmt = db.prepare(
            "SELECT id, name, path, contexts, created_at, last_opened
             FROM projects ORDER BY last_opened DESC"
        )?;
        let rows = stmt.query_map([], |row| Project::from_row(row))?;
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }
}
```

---

## IPC Commands

All project operations are exposed to the React frontend as Tauri commands. Each command is registered in `src-tauri/src/commands/project.rs`.

### Command Signatures

```rust
use tauri::State;
use std::sync::Mutex;

/// Return all registered projects, ordered by last_opened descending.
#[tauri::command]
pub fn list_projects(
    manager: State<'_, Mutex<ProjectManager>>,
) -> Result<Vec<Project>, String> {
    let mgr = manager.lock().map_err(|e| e.to_string())?;
    Ok(mgr.list_projects().into_iter().cloned().collect())
}

/// Open a directory picker and register the selected directory as a project.
#[tauri::command]
pub async fn add_project(
    app: tauri::AppHandle,
    manager: State<'_, Mutex<ProjectManager>>,
) -> Result<ProjectId, String> {
    let mut mgr = manager.lock().map_err(|e| e.to_string())?;
    mgr.add_project(&app).await.map_err(|e| e.to_string())
}

/// Set a project as the active workspace.
#[tauri::command]
pub fn switch_project(
    id: String,
    manager: State<'_, Mutex<ProjectManager>>,
    agent_mgr: State<'_, Mutex<AgentManager>>,
) -> Result<(), String> {
    let project_id = ProjectId(Uuid::parse_str(&id).map_err(|e| e.to_string())?);
    let mut mgr = manager.lock().map_err(|e| e.to_string())?;
    let mut agents = agent_mgr.lock().map_err(|e| e.to_string())?;
    mgr.switch(&project_id, &mut agents).map_err(|e| e.to_string())
}

/// Remove a project from Zentral (does not delete files on disk).
#[tauri::command]
pub fn remove_project(
    id: String,
    manager: State<'_, Mutex<ProjectManager>>,
) -> Result<(), String> {
    let project_id = ProjectId(Uuid::parse_str(&id).map_err(|e| e.to_string())?);
    let mut mgr = manager.lock().map_err(|e| e.to_string())?;
    mgr.remove(&project_id).map_err(|e| e.to_string())
}

/// Return the currently active project, if any.
#[tauri::command]
pub fn get_active_project(
    manager: State<'_, Mutex<ProjectManager>>,
) -> Result<Option<Project>, String> {
    let mgr = manager.lock().map_err(|e| e.to_string())?;
    Ok(mgr.get_active_project().cloned())
}
```

### Command Registration

```rust
// In src-tauri/src/lib.rs
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Mutex::new(ProjectManager::new(db.clone(), app_handle.clone())))
        .invoke_handler(tauri::generate_handler![
            commands::project::list_projects,
            commands::project::add_project,
            commands::project::switch_project,
            commands::project::remove_project,
            commands::project::get_active_project,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Zentral");
}
```

---

## Tauri Events

The ProjectManager emits events through the Tauri event system so the React frontend can react without polling.

| Event Name              | Payload                     | Trigger                             |
|-------------------------|-----------------------------|-------------------------------------|
| `project:changed`       | `Project` (full object)     | Active project switched             |
| `project:list-updated`  | `Vec<Project>` (full list)  | Project added or removed            |
| `project:context-updated` | `{ id, contexts }`        | Context re-detection completed      |

### Frontend Subscription

```typescript
import { listen } from "@tauri-apps/api/event";
import { useProjectStore } from "../stores/projectStore";

// Subscribe once on app mount.
listen<Project>("project:changed", (event) => {
  useProjectStore.getState().setActiveProject(event.payload);
});

listen<Project[]>("project:list-updated", (event) => {
  useProjectStore.getState().setProjects(event.payload);
});
```

---

## Frontend Store

The project state is managed by a Zustand store at `src/stores/projectStore.ts`.

```typescript
import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

interface Project {
  id: string;
  name: string;
  path: string;
  contexts: string[];
  created_at: string;
  last_opened: string;
}

interface ProjectStore {
  projects: Project[];
  activeProject: Project | null;
  loading: boolean;

  fetchProjects: () => Promise<void>;
  addProject: () => Promise<void>;
  switchProject: (id: string) => Promise<void>;
  removeProject: (id: string) => Promise<void>;
  setProjects: (projects: Project[]) => void;
  setActiveProject: (project: Project) => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  projects: [],
  activeProject: null,
  loading: false,

  fetchProjects: async () => {
    set({ loading: true });
    const projects = await invoke<Project[]>("list_projects");
    const active = await invoke<Project | null>("get_active_project");
    set({ projects, activeProject: active, loading: false });
  },

  addProject: async () => {
    await invoke<string>("add_project");
    // List update arrives via event subscription.
  },

  switchProject: async (id: string) => {
    await invoke("switch_project", { id });
    // Active project update arrives via event subscription.
  },

  removeProject: async (id: string) => {
    await invoke("remove_project", { id });
    // List update arrives via event subscription.
  },

  setProjects: (projects) => set({ projects }),
  setActiveProject: (project) => set({ activeProject: project }),
}));
```

---

## Left Sidebar UI

The project list occupies the top section of the left sidebar. Each project card displays:

```
┌─────────────────────────────────────┐
│  Left Sidebar                       │
├─────────────────────────────────────┤
│                                     │
│  ┌───────────────────────────────┐  │
│  │ * my-rust-app          [R][G] │  │  <-- active (highlighted)
│  │   ~/projects/my-rust-app      │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │   web-frontend         [N][G] │  │
│  │   ~/projects/web-frontend     │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │   ml-pipeline          [P][D] │  │
│  │   ~/work/ml-pipeline          │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │   ! old-project        [N]    │  │  <-- warning: dir missing
│  │   ~/deleted/old-project       │  │
│  └───────────────────────────────┘  │
│                                     │
│  [ + Add Project ]                  │
│                                     │
├─────────────────────────────────────┤
│  (Agent list, sessions, etc.)       │
└─────────────────────────────────────┘

Context badge legend:
  [G] = Git    [N] = Node    [R] = Rust
  [P] = Python [D] = Docker  [Go] = Go
  [J] = Java
```

### Project Card Elements

| Element          | Description                                                    |
|------------------|----------------------------------------------------------------|
| Project name     | Bold text, derived from directory name (editable).             |
| Path snippet     | Truncated absolute path shown below the name in muted text.   |
| Context badges   | Small colored badges for each detected context (Git, Node, etc.). |
| Active indicator | Left border highlight or background color on the active project. |
| Warning badge    | Exclamation icon when the directory no longer exists on disk.  |

### Right-Click Context Menu

Right-clicking a project card opens a context menu with these options:

| Menu Item              | Action                                                       |
|------------------------|--------------------------------------------------------------|
| Open in File Explorer  | Opens the project directory in the system file manager.      |
| Copy Path              | Copies the absolute path to the clipboard.                   |
| Rename                 | Inline rename of the display name (does not rename the directory). |
| Remove Project         | Shows confirmation dialog, then removes from Zentral.        |

### "Open in File Explorer" Implementation

```rust
#[tauri::command]
pub fn open_in_explorer(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
```

---

## Edge Cases

### Directory Deleted Externally

When a registered project's directory is deleted or moved outside of Zentral:

1. On startup, `ProjectManager::init()` validates all stored paths. Directories that no longer exist get a warning flag.
2. On switch, the `switch()` method returns `Error::DirectoryMissing` and the frontend displays an inline warning.
3. The project card shows a warning badge (exclamation icon) and the context badges are cleared.
4. The user can still remove the project from the sidebar. They cannot switch to it.

```rust
impl ProjectManager {
    /// Called once at startup. Marks projects with missing directories.
    pub fn validate_all_paths(&mut self) {
        for project in self.projects.values_mut() {
            if !std::path::Path::new(&project.path).is_dir() {
                project.contexts = vec![];
                // The frontend checks for empty contexts + missing path
                // to show the warning badge.
            }
        }
    }
}
```

### Duplicate Path

Adding a directory that is already registered returns `Error::ProjectAlreadyExists`. The frontend displays a toast notification: "This directory is already registered as a project."

### Path With Symlinks

Paths are stored as provided by the OS dialog. No symlink resolution is performed. This means the same physical directory could theoretically be registered twice via different symlink paths. This is considered an acceptable edge case that does not warrant the complexity of canonicalization across all platforms.

### Empty Sidebar (No Projects)

When no projects are registered, the sidebar shows an empty state with a prompt:

```
┌───────────────────────────────┐
│                               │
│   No projects yet.            │
│   Click below to add your     │
│   first project directory.    │
│                               │
│   [ + Add Project ]           │
│                               │
└───────────────────────────────┘
```

### Active Project Removed

If the currently active project is removed, the `active_project_id` is set to `None`. The terminal panel keeps its current CWD (no forced change), and the sidebar shows no highlight until the user selects another project.

---

## Initialization

On application startup, the ProjectManager loads all projects from SQLite and validates their paths.

```rust
impl ProjectManager {
    pub fn new(db: Arc<Mutex<Connection>>, app: tauri::AppHandle) -> Self {
        let mut manager = ProjectManager {
            projects: HashMap::new(),
            active_project_id: None,
            db,
            app,
        };

        // Create the table if it does not exist.
        manager.db_ensure_table();

        // Load all projects into memory.
        if let Ok(projects) = manager.db_load_all() {
            for project in projects {
                manager.projects.insert(project.id.clone(), project);
            }
        }

        // Validate paths and flag missing directories.
        manager.validate_all_paths();

        manager
    }

    fn db_ensure_table(&self) {
        let db = self.db.lock().unwrap();
        db.execute_batch(
            "CREATE TABLE IF NOT EXISTS projects (
                id          TEXT PRIMARY KEY,
                name        TEXT NOT NULL,
                path        TEXT NOT NULL UNIQUE,
                contexts    TEXT NOT NULL DEFAULT '[]',
                created_at  TEXT NOT NULL,
                last_opened TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_projects_last_opened
                ON projects(last_opened);"
        ).expect("failed to create projects table");
    }
}
```

---

## References

- [System Architecture](../01-architecture/system-architecture.md) -- high-level overview including the ProjectManager component
- [Agent Manager](../02-specifications/agent-manager.md) -- CWD propagation to agents on project switch
- [Secretary Agent](../02-specifications/secretary-agent.md) -- how the secretary uses project context for task delegation
