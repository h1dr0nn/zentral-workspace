# Terminal Panel

> Togglable embedded terminal panel at the bottom of the main content area for running shell commands without leaving Zentral.

> **Status:** draft
> **Last updated:** 2026-03-24

---

## Overview

The terminal panel is a togglable embedded terminal positioned at the bottom of the main content area. It provides a convenience shell for running commands without leaving Zentral. The terminal is secondary to the chat view and can be toggled with the `[T]` button in the header toolbar or via the `Ctrl+`` keyboard shortcut.

## Layout

The terminal panel sits below the chat view inside the main area. A drag handle separates the two regions and allows the user to resize the terminal height. Layout splitting is handled by `react-resizable-panels`.

```
┌─────────────────────────────────┐
│         Chat View               │
│                                 │
├═════════════════════════════════┤  <- resize handle
│ Terminal                   [x]  │
│ ~/projects/my-app $ npm test    │
│ PASS src/app.test.ts            │
│ Tests: 5 passed                 │
│ ~/projects/my-app $ _           │
└─────────────────────────────────┘
```

When the terminal is hidden, the chat view expands to fill the entire main area. When visible, the default split is roughly 70/30 (chat/terminal), adjustable by the user.

## Rendering

The terminal receives raw PTY bytes from the Rust backend via Tauri event listeners. A lightweight terminal renderer converts those bytes into visible output.

### xterm.js Integration

The recommended renderer is xterm.js with the following packages:

```typescript
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebglAddon } from "xterm-addon-webgl";
```

Initialization happens once on first mount:

```typescript
const term = new Terminal({
  fontSize: 13,
  fontFamily: "JetBrains Mono, monospace",
  theme: currentTheme.terminal,
  cursorBlink: true,
  scrollback: 5000,
});

const fitAddon = new FitAddon();
term.loadAddon(fitAddon);
term.loadAddon(new WebglAddon());

term.open(containerRef.current);
fitAddon.fit();
```

Data from the backend is written directly into the terminal instance:

```typescript
import { listen } from "@tauri-apps/api/event";

const unlisten = await listen<Uint8Array>("pty-output", (event) => {
  term.write(event.payload);
});
```

### Supported Features

| Feature | Status |
|---------|--------|
| ANSI 16/256/truecolor | Supported via xterm.js |
| Cursor positioning | Supported |
| Scrollback buffer | 5000 lines default |
| Selection and copy | Supported |
| Link detection | Planned |
| Image protocols (sixel/kitty) | Not supported |

## Input

Keyboard input is captured when the terminal panel has focus. Each keypress is forwarded to the Rust PTY process through a Tauri command.

```typescript
term.onData((data: string) => {
  invoke("write_to_terminal", { data });
});
```

Special key handling:

| Key | Behavior |
|-----|----------|
| Ctrl+C | Sends interrupt signal (0x03) to PTY |
| Ctrl+D | Sends EOF (0x04) |
| Ctrl+Z | Sends suspend (0x1A) |
| Escape | Returns focus to chat if terminal is focused |

When the terminal is not focused, all keyboard input goes to the chat view or whichever component currently holds focus.

## Resize

Panel height is adjustable through the drag handle provided by `react-resizable-panels`. When the panel dimensions change, the terminal columns and rows must be recalculated and sent to the backend so the PTY can update its window size.

```typescript
const handleResize = () => {
  fitAddon.fit();
  const { cols, rows } = term;
  invoke("resize_terminal", { cols, rows });
};
```

On the Rust side, the PTY resize is handled through the platform-specific PTY API:

```
Frontend resize event
       |
       v
invoke("resize_terminal", { cols, rows })
       |
       v
Rust PTY handler -> ioctl / SetConsoleScreenBufferInfo
```

## Lifecycle

The terminal follows a lazy creation and persistent background model:

| Event | Behavior |
|-------|----------|
| App start | Terminal is not created |
| First `[T]` toggle | PTY process spawned, xterm.js mounted |
| Subsequent hide | Panel hidden via CSS, PTY keeps running |
| Subsequent show | Panel shown, no reinitialization needed |
| App exit | PTY process killed, resources freed |

Hiding the panel does not destroy the PTY session. Background processes continue to run and output is buffered in the xterm.js scrollback so no data is lost while the panel is hidden.

## Working Directory

The terminal starts in the active project directory as reported by the project store. If no project is open, it defaults to the user home directory.

The working directory does not automatically change when the user switches projects. The user must run `cd` manually or close and reopen the terminal to pick up a new project path.

## Close Button

The `[x]` button in the terminal toolbar hides the panel. It behaves identically to pressing the `[T]` toggle button. It does not destroy the PTY session or clear scrollback. The user can reopen the terminal and resume exactly where they left off.

## Components

The terminal panel is composed of three React components:

### TerminalPanel

The outer container managed by `react-resizable-panels`. Controls visibility, holds the resize handle, and provides layout context.

```typescript
interface TerminalPanelProps {
  visible: boolean;
  onClose: () => void;
  projectDir: string;
}
```

### TerminalRenderer

The inner component that owns the xterm.js instance. Handles mounting, data flow, input capture, and resize fitting.

```typescript
interface TerminalRendererProps {
  projectDir: string;
  onReady: () => void;
}
```

### TerminalToolbar

A thin bar at the top of the terminal panel showing the title and the close button.

```typescript
interface TerminalToolbarProps {
  onClose: () => void;
}
```

## References

- [System Architecture](../02-architecture/system-architecture.md)
- [Keyboard Shortcuts](keyboard-shortcuts.md)
- [Themes](themes.md)
- [Design System](design-system.md)
