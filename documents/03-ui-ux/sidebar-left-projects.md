# Left Sidebar -- Projects

> Primary project navigation panel displaying user-added project directories with contextual metadata and environment detection badges.

> **Status:** draft
> **Last updated:** 2026-03-24

---

## Overview

The left sidebar serves as the primary project navigation panel in Zentral. It displays a scrollable list of user-added project directories, each rendered as a card with contextual metadata. The sidebar is toggled via the **[L]** button in the header or a configurable keyboard shortcut.

When a project is selected, Zentral switches the active working directory for all terminal sessions and updates context detectors accordingly.

## Layout

```
┌─────────────────┐
│ PROJECTS    [+]  │
├─────────────────┤
│ * my-app        │  <- active (highlighted)
│   ~/projects/   │
│   [git] [node]  │  <- context badges
├─────────────────┤
│   api-server    │
│   ~/work/api/   │
│   [git] [rust]  │
├─────────────────┤
│   infra         │
│   ~/work/infra/ │
│   [docker]      │
└─────────────────┘
```

The header row contains the section title and the **[+]** add-project button. Below it, a vertically scrollable area holds the project cards in order of most recently opened.

## Project Card

Each project card displays three pieces of information:

| Element | Description | Style |
|---------|-------------|-------|
| Name | Directory name, rendered bold | `font-semibold text-sm` |
| Path | Absolute path, truncated with ellipsis from the left | `text-xs text-muted-foreground` |
| Context badges | Detected environment tags | Small `Badge` components |

Supported context badge types:

| Badge | Detected via |
|-------|-------------|
| git | `.git/` directory present |
| node | `package.json` present |
| rust | `Cargo.toml` present |
| python | `pyproject.toml`, `setup.py`, or `requirements.txt` present |
| docker | `Dockerfile` or `docker-compose.yml` present |
| go | `go.mod` present |
| java | `pom.xml` or `build.gradle` present |

Context detection runs asynchronously on the Rust side via the existing context detector modules and results are cached in the project record.

## Active State

The currently selected project receives:

- A background highlight using the theme accent color at reduced opacity (`bg-accent/15`).
- A filled dot indicator to the left of the project name.
- A left border accent (`border-l-2 border-accent`).

Only one project can be active at a time. Clicking a different card switches the active project and triggers a Tauri command to update the working directory for the current session.

## Add Project

The **[+]** button in the header opens a native directory picker dialog via the Tauri `dialog` plugin:

```rust
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
async fn add_project(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let path = app.dialog()
        .file()
        .set_title("Select Project Directory")
        .blocking_pick_folder();

    match path {
        Some(folder) => {
            let path_str = folder.to_string();
            // Validate and persist
            Ok(Some(path_str))
        }
        None => Ok(None),
    }
}
```

After the user selects a directory, the backend:

1. Validates the path exists and is a directory.
2. Runs context detection to generate initial badges.
3. Inserts a record into the `projects` table in SQLite via the persistence layer.
4. Emits an event to the frontend to refresh the sidebar list.

## Context Menu

Right-clicking a project card opens a `DropdownMenu` with the following actions:

| Action | Behavior |
|--------|----------|
| Remove from list | Deletes the project record from SQLite. Does not delete files on disk. |
| Open in file explorer | Calls `tauri::api::shell::open` to open the directory in the OS file manager. |
| Copy path | Copies the absolute path to the system clipboard. |

The active project cannot be removed without first switching to a different project or confirming through a dialog.

## Sorting

Projects are sorted by the `last_opened` timestamp in descending order (most recent first). The timestamp updates each time the user clicks a project card to make it active.

```rust
pub struct Project {
    pub id: i64,
    pub name: String,
    pub path: String,
    pub last_opened: chrono::NaiveDateTime,
    pub context_badges: Vec<String>,
}
```

## Empty State

When no projects have been added, the sidebar displays a centered placeholder:

```
┌─────────────────┐
│ PROJECTS    [+]  │
├─────────────────┤
│                 │
│   No projects   │
│     added.      │
│                 │
│  Click + to add │
│  a project      │
│  directory.     │
│                 │
└─────────────────┘
```

The empty state text uses `text-muted-foreground` styling and is vertically centered within the scroll area.

## Resizable

The left sidebar participates in the application-wide `ResizablePanelGroup` from shadcn/ui. Constraints:

| Property | Value |
|----------|-------|
| Minimum width | 200px |
| Default width | 250px |
| Maximum width | 400px |
| Resize handle | Vertical bar on the right edge |

The panel width is persisted to local storage so it restores on next launch.

```typescript
<ResizablePanelGroup direction="horizontal">
  <ResizablePanel defaultSize={250} minSize={200} maxSize={400}>
    <ProjectSidebar />
  </ResizablePanel>
  <ResizableHandle />
  <ResizablePanel>
    {/* Main content area */}
  </ResizablePanel>
</ResizablePanelGroup>
```

## Components

### ProjectSidebar

The top-level container component. Renders the header row with the title and add button, manages the project list state, and wraps the card list in a `ScrollArea`.

```typescript
interface ProjectSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}
```

### ProjectCard

Renders a single project entry. Accepts project data and an `isActive` flag. Handles click-to-select and right-click context menu.

```typescript
interface ProjectCardProps {
  project: Project;
  isActive: boolean;
  onSelect: (id: number) => void;
  onRemove: (id: number) => void;
}
```

### AddProjectButton

A styled `Button` component that triggers the native directory picker. Displays as an icon-only button with a plus icon.

### ContextBadge

A small `Badge` component that renders a context type label. Color-coded per type:

| Badge | Color variant |
|-------|--------------|
| git | `default` |
| node | `secondary` (green tint) |
| rust | `secondary` (orange tint) |
| python | `secondary` (blue tint) |
| docker | `secondary` (cyan tint) |
| go | `secondary` (teal tint) |
| java | `secondary` (red tint) |

## shadcn/ui Usage

The following shadcn/ui primitives are used in this sidebar:

| Component | Usage |
|-----------|-------|
| `ScrollArea` | Wraps the project card list for vertical scrolling |
| `Badge` | Renders context badges on each project card |
| `Button` | The [+] add-project button in the header |
| `DropdownMenu` | Context menu on right-click |
| `Separator` | Visual divider between project cards |
| `Tooltip` | Displays the full path on hover when the path is truncated |

## References

- [System Architecture](../02-architecture/system-architecture.md)
- [Frontend Architecture](../02-architecture/frontend-architecture.md)
- [Context Engine Specification](../03-specifications/context-engine.md)
- [Session Management](../03-specifications/session-management.md)
- [Design System](../03-ui-ux/design-system.md)
- [Themes](../03-ui-ux/themes.md)
