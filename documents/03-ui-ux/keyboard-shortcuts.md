# Keyboard Shortcuts

> Default keybindings for Zentral, covering navigation, agent management, terminal interaction, chat input, and general operations.

> **Status:** draft
> **Last updated:** 2026-03-24

---

## Overview

The table below lists every default shortcut. On macOS, `Ctrl` is replaced by `Cmd` unless noted otherwise.

| Action | Windows / Linux | macOS |
|---|---|---|
| Toggle Left Sidebar | Ctrl+B | Cmd+B |
| Toggle Terminal | Ctrl+` | Cmd+` |
| Toggle Right Sidebar | Ctrl+Shift+B | Cmd+Shift+B |
| Command Palette | Ctrl+Shift+P | Cmd+Shift+P |
| New Agent | Ctrl+Shift+N | Cmd+Shift+N |
| Settings | Ctrl+, | Cmd+, |
| Send Message | Enter | Enter |
| New Line in Input | Shift+Enter | Shift+Enter |
| Cancel Response | Ctrl+C (in chat) | Cmd+C (in chat) |
| Switch Agent | Ctrl+Tab | Cmd+Tab (cycle) |
| Focus Chat Input | / | / |
| Close Agent | Ctrl+W | Cmd+W |
| Zoom In | Ctrl+= | Cmd+= |
| Zoom Out | Ctrl+- | Cmd+- |
| Reset Zoom | Ctrl+0 | Cmd+0 |

## Categories

Shortcuts are organized into five categories. The category determines precedence when resolving conflicts: more specific categories take priority over general ones.

### Navigation

Shortcuts for moving between panels and opening overlays.

| Action | Shortcut |
|---|---|
| Toggle Left Sidebar | Ctrl+B |
| Toggle Terminal | Ctrl+` |
| Toggle Right Sidebar | Ctrl+Shift+B |
| Command Palette | Ctrl+Shift+P |
| Focus Chat Input | / |

### Agents

Shortcuts for creating, switching, and closing agent sessions.

| Action | Shortcut |
|---|---|
| New Agent | Ctrl+Shift+N |
| Switch Agent | Ctrl+Tab |
| Close Agent | Ctrl+W |

### Terminal

When the terminal panel is focused, most key events pass through to the underlying PTY. The terminal captures raw input, so only shortcuts with modifier keys that are explicitly intercepted will fire application-level actions.

| Action | Shortcut |
|---|---|
| Toggle Terminal | Ctrl+` |

All other key combinations are forwarded to the shell process.

### Chat

Shortcuts that apply when the chat input area is focused.

| Action | Shortcut |
|---|---|
| Send Message | Enter |
| New Line in Input | Shift+Enter |
| Cancel Response | Ctrl+C |

`Cancel Response` only triggers when a streaming response is active. If no response is in progress, the key event is treated as a normal copy command.

### General

Application-wide shortcuts that work regardless of focus context.

| Action | Shortcut |
|---|---|
| Settings | Ctrl+, |
| Zoom In | Ctrl+= |
| Zoom Out | Ctrl+- |
| Reset Zoom | Ctrl+0 |

## Implementation

Shortcuts are handled by a global `keydown` event listener registered in the root `App.tsx` component. The listener runs during the capture phase so it can intercept events before they reach focused elements.

### Platform Detection

The modifier key is resolved at startup. On macOS, the `metaKey` property is checked; on all other platforms, `ctrlKey` is used.

```typescript
const isMac = navigator.platform.toUpperCase().includes("MAC");

function modifierPressed(e: KeyboardEvent): boolean {
  return isMac ? e.metaKey : e.ctrlKey;
}
```

Alternatively, the Tauri `os` API can provide the platform string:

```typescript
import { platform } from "@tauri-apps/plugin-os";

const isMac = (await platform()) === "macos";
```

### Listener Setup

```typescript
// File: src/App.tsx

useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) {
    const mod = modifierPressed(e);

    if (mod && e.key === "b" && !e.shiftKey) {
      e.preventDefault();
      uiStore.toggleLeftSidebar();
      return;
    }

    if (mod && e.key === "`") {
      e.preventDefault();
      uiStore.toggleTerminal();
      return;
    }

    if (mod && e.key === "B" && e.shiftKey) {
      e.preventDefault();
      uiStore.toggleRightSidebar();
      return;
    }

    if (mod && e.key === "P" && e.shiftKey) {
      e.preventDefault();
      uiStore.openCommandPalette();
      return;
    }

    if (mod && e.key === "N" && e.shiftKey) {
      e.preventDefault();
      agentStore.createAgent();
      return;
    }

    if (mod && e.key === ",") {
      e.preventDefault();
      uiStore.openSettings();
      return;
    }

    if (mod && e.key === "w") {
      e.preventDefault();
      agentStore.closeCurrentAgent();
      return;
    }

    if (mod && e.key === "Tab") {
      e.preventDefault();
      agentStore.cycleAgent();
      return;
    }

    if (mod && e.key === "=") {
      e.preventDefault();
      uiStore.zoomIn();
      return;
    }

    if (mod && e.key === "-") {
      e.preventDefault();
      uiStore.zoomOut();
      return;
    }

    if (mod && e.key === "0") {
      e.preventDefault();
      uiStore.resetZoom();
      return;
    }

    if (e.key === "/" && !mod && !e.shiftKey && !isInputFocused()) {
      e.preventDefault();
      uiStore.focusChatInput();
      return;
    }
  }

  document.addEventListener("keydown", handleKeyDown, true);
  return () => document.removeEventListener("keydown", handleKeyDown, true);
}, []);
```

The `isInputFocused()` helper prevents the `/` shortcut from triggering when the user is already typing in an input, textarea, or contenteditable element.

```typescript
function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    (el as HTMLElement).isContentEditable
  );
}
```

### Cleanup

The `useEffect` return function removes the listener when the component unmounts, preventing memory leaks and duplicate handlers during hot module replacement.

## Customization

Custom keybindings are planned for a future release. The design follows a layered override model.

### Storage

User overrides will be stored in the SQLite settings table alongside other preferences.

```
┌─────────────────────────────────────────────┐
│ settings                                    │
│─────────────────────────────────────────────│
│ key          TEXT  PRIMARY KEY              │
│ value        TEXT  (JSON-encoded)           │
│ updated_at   TEXT                           │
└─────────────────────────────────────────────┘
```

A row with key `keybindings` holds a JSON object mapping action names to shortcut strings.

```json
{
  "toggleLeftSidebar": "Ctrl+Shift+L",
  "toggleTerminal": "Ctrl+Shift+`"
}
```

### Resolution

At startup the application loads the default keybinding map and merges any user overrides on top of it.

```typescript
type KeybindingMap = Record<string, string>;

function resolveKeybindings(
  defaults: KeybindingMap,
  overrides: KeybindingMap
): KeybindingMap {
  return { ...defaults, ...overrides };
}
```

Actions not present in the overrides object retain their default binding. Setting an override value to an empty string disables that shortcut entirely.

### Settings UI

The Settings modal will include a Keybindings tab where each action is listed with its current shortcut. Clicking a shortcut cell puts it into recording mode: the next key combination pressed becomes the new binding. A reset button restores the default for a single action; a "Reset All" button clears every override.

## Conflict Prevention

Terminal focus is the primary source of shortcut conflicts. When the terminal panel has focus, raw key events are written to the PTY stream so the shell and any running program receive them. The following rules govern how conflicts are resolved.

### Rules

1. Shortcuts that require a platform modifier key (`Ctrl` or `Cmd`) plus a non-printing key or symbol are always intercepted at the application level, even when the terminal is focused.
2. Shortcuts that consist of a single unmodified key (such as `/` for focus) are suppressed when any input element or the terminal has focus.
3. The `Ctrl+C` shortcut is context-sensitive: inside the chat panel it cancels a streaming response; inside the terminal it sends `SIGINT` to the foreground process and is never intercepted by the application.
4. All global shortcuts require at least one modifier key. This prevents accidental activation while typing.

### Focus Tracking

The application maintains a `focusZone` value in the UI store that tracks which region currently owns keyboard input.

```typescript
type FocusZone = "chat" | "terminal" | "sidebar" | "global";
```

The global keydown listener checks `focusZone` before dispatching actions that are sensitive to context (for example, `Ctrl+C` and `/`).

## References

- [Window Decoration](window-decoration.md) -- menu bar items reference these shortcuts
- [Design System](design-system.md) -- visual treatment of shortcut hints in menus
- [Terminal View](terminal-view.md) -- terminal focus and PTY input handling
- [Session Management](../03-specifications/session-management.md) -- SQLite schema for persisting user settings
