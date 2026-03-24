# Window Decoration

> Custom window chrome for Zentral, replacing native OS title bars with a fully React-rendered titlebar inside a Tauri v2 frameless window.

> **Status:** draft
> **Last updated:** 2026-03-24

---

## Overview

Zentral disables the default operating system window decorations by setting `decorations: false` in the Tauri configuration. The entire titlebar -- including the app icon, menu bar, panel toggle buttons, and window controls -- is rendered as a React component. This approach gives the application complete control over appearance and behavior, ensuring a consistent look across Windows, macOS, and Linux while allowing deep integration with the workspace UI.

The custom chrome sits at the very top of the window and occupies a fixed height of 36 pixels. It participates in the application layout as a flex row and is always rendered above all other content.

## Layout

The titlebar is divided into three logical zones arranged in a single horizontal row.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [icon] File | Edit | Selection | View | Help       [L][T][R] [--][[][ x]│
│  app   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^          toggles   window    │
│  icon          menu bar                             buttons   controls  │
└──────────────────────────────────────────────────────────────────────────┘
```

| Zone | Position | Contents |
|------|----------|----------|
| Left | flex-start | App icon, menu bar items |
| Center | flex: 1 (spacer) | Empty drag region |
| Right | flex-end | Panel toggle buttons, window controls |

The spacer between the menu bar and the toggle buttons is the primary drag region. It expands to fill all remaining horizontal space.

## Drag Region

The titlebar container carries the `data-tauri-drag-region` attribute, which tells Tauri to treat pointer-down events on that element as window-drag initiators. Interactive children -- menu items, buttons, and inputs -- must **not** carry this attribute so that clicks on them are handled normally by the browser event system.

```typescript
function CustomTitlebar() {
  return (
    <header className="titlebar" data-tauri-drag-region>
      <AppIcon />
      <MenuBar />
      <div className="titlebar-spacer" data-tauri-drag-region />
      <PanelToggles />
      <WindowControls />
    </header>
  );
}
```

Double-clicking the drag region toggles the maximized state, matching standard Windows behavior.

## Menu Bar

The menu bar renders custom dropdown menus entirely in React. Native OS menus are not used. Each top-level item displays a label and opens a dropdown panel on click. Hovering between top-level items while a dropdown is open switches the visible dropdown immediately.

### File

| Item | Shortcut | Action |
|------|----------|--------|
| New Agent | Ctrl+Shift+N | Create a new agent tab |
| Open Project | Ctrl+O | Open a project folder |
| Close Project | -- | Close the active project |
| Settings | Ctrl+, | Open the settings modal |
| Exit | Alt+F4 | Quit the application |

### Edit

| Item | Shortcut | Action |
|------|----------|--------|
| Undo | Ctrl+Z | Undo last action |
| Redo | Ctrl+Shift+Z | Redo last undone action |
| Cut | Ctrl+X | Cut selection |
| Copy | Ctrl+C | Copy selection |
| Paste | Ctrl+V | Paste from clipboard |
| Select All | Ctrl+A | Select all content in focus |

### Selection

| Item | Shortcut | Action |
|------|----------|--------|
| Select Agent | -- | Open agent picker |
| Select Project | -- | Open project picker |

### View

| Item | Shortcut | Action |
|------|----------|--------|
| Toggle Left Sidebar | Ctrl+B | Show or hide the left sidebar |
| Toggle Terminal | Ctrl+` | Show or hide the terminal panel |
| Toggle Right Sidebar | Ctrl+Shift+B | Show or hide the right sidebar |
| Command Palette | Ctrl+Shift+P | Open the command palette |
| Zoom In | Ctrl+= | Increase UI scale |
| Zoom Out | Ctrl+- | Decrease UI scale |

### Help

| Item | Shortcut | Action |
|------|----------|--------|
| Documentation | -- | Open documentation in browser |
| About | -- | Show the about dialog |
| Check for Updates | -- | Query for application updates |

Dropdowns are positioned absolutely below their trigger and close on outside click or on `Escape`.

## Toggle Buttons

Three small square buttons sit to the left of the window controls. Each toggles the visibility of a major UI panel.

```
[L]  [T]  [R]
 |    |    |
 |    |    +-- Right sidebar (agents)
 |    +------- Terminal panel
 +------------ Left sidebar (projects)
```

| Button | Label | Store Binding | Shortcut |
|--------|-------|---------------|----------|
| L | Left Sidebar | `uiStore.leftSidebarVisible` | Ctrl+B |
| T | Terminal | `uiStore.terminalVisible` | Ctrl+` |
| R | Right Sidebar | `uiStore.rightSidebarVisible` | Ctrl+Shift+B |

### Visual States

| State | Appearance |
|-------|------------|
| Active (panel visible) | Background filled with the theme accent color, text in contrasting white |
| Inactive (panel hidden) | Transparent background, muted foreground color |
| Hover | Slight background highlight regardless of active state |

```css
.panel-toggle {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.panel-toggle--active {
  background-color: var(--accent);
  color: var(--accent-fg);
}

.panel-toggle--inactive {
  background-color: transparent;
  color: var(--text-muted);
}
```

## Window Controls

The rightmost group contains three buttons that map directly to the Tauri window API.

```
[--]  [[]  [x]
  |    |    |
  |    |    +-- Close
  |    +------- Maximize / Restore
  +------------ Minimize
```

### Implementation

```typescript
import { getCurrentWindow } from "@tauri-apps/api/window";

const appWindow = getCurrentWindow();

function WindowControls() {
  return (
    <div className="window-controls">
      <button onClick={() => appWindow.minimize()} aria-label="Minimize">
        &#x2014;
      </button>
      <button onClick={() => appWindow.toggleMaximize()} aria-label="Maximize">
        &#x25A1;
      </button>
      <button onClick={() => appWindow.close()} aria-label="Close">
        &#x2715;
      </button>
    </div>
  );
}
```

On Windows, the buttons use a horizontal layout with hover colors that match the native Windows 11 style: gray highlight for minimize and maximize, red highlight for close.

```css
.window-controls button {
  width: 46px;
  height: 36px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
}

.window-controls button:hover {
  background-color: var(--surface-hover);
}

.window-controls button.close:hover {
  background-color: #e81123;
  color: #ffffff;
}
```

## Tauri Configuration

The following excerpt from `tauri.conf.json` shows the settings that enable the custom titlebar.

```json
{
  "app": {
    "windows": [
      {
        "title": "Zentral",
        "width": 1280,
        "height": 800,
        "decorations": false,
        "transparent": false,
        "resizable": true,
        "fullscreen": false
      }
    ]
  }
}
```

Key points:

- `decorations: false` removes the native title bar and window frame.
- The application must provide its own resize handles or rely on Tauri's built-in borderless resize zones.
- `transparent: false` keeps a solid window background, avoiding compositing overhead.

## Component Structure

The `CustomTitlebar` component is the top-level wrapper. It composes four child components.

```
CustomTitlebar
  +-- AppIcon            Static icon, 20x20, links to home view
  +-- MenuBar            Renders top-level menu items and their dropdowns
  |     +-- MenuItem     Individual top-level label
  |     +-- Dropdown     Positioned list of actions
  |           +-- DropdownItem   Single action row
  +-- PanelToggles       Three toggle buttons bound to uiStore
  +-- WindowControls     Minimize, maximize, close buttons
```

```typescript
// File: src/components/header/CustomTitlebar.tsx

export function CustomTitlebar() {
  return (
    <header className="titlebar" data-tauri-drag-region>
      <AppIcon />
      <MenuBar />
      <div className="titlebar-spacer" data-tauri-drag-region />
      <PanelToggles />
      <WindowControls />
    </header>
  );
}
```

The titlebar is rendered as the first child of the root `App` component, above the main workspace layout. It never unmounts and remains visible in all application states.

## References

- [Keyboard Shortcuts](keyboard-shortcuts.md) -- shortcut definitions referenced by menu items and toggle buttons
- [Header](header.md) -- broader header area specification
- [Design System](design-system.md) -- color tokens and spacing scale used by the titlebar
- [Themes](themes.md) -- theme variables (`--accent`, `--surface-hover`, `--text-muted`)
- [Tauri Window API](https://v2.tauri.app/reference/javascript/api/namespacewindow/) -- upstream documentation for `getCurrentWindow`
