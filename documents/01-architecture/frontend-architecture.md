# Frontend Architecture

> React frontend for Zentral, rendered inside Tauri v2's WebView. Single-window layout with resizable panels, Zustand state management, and typed IPC communication with the Rust core.

> **Status:** draft
> **Last updated:** 2026-03-24

---

## Overview

Zentral's frontend is a React application that runs inside a Tauri WebView. There is no router -- the entire UI lives in a single window, and panel visibility is driven by boolean flags in a Zustand store. The layout consists of a custom titlebar, three resizable columns (left sidebar, main area, right sidebar), and overlay components for dialogs and command palette. All styling uses Tailwind CSS v4 with oklch color tokens defined via CSS variables and `@theme inline`.

The frontend communicates with the Rust backend exclusively through Tauri's `invoke()` for commands and `listen()` for events. TanStack Query wraps invoke calls to provide caching, deduplication, and automatic invalidation.

## Component Hierarchy

```
App.tsx
├── CustomTitlebar
│   ├── AppIcon
│   ├── MenuBar (File, Edit, View, Agents, Help)
│   ├── PanelToggles
│   │   ├── [L] LeftSidebar toggle
│   │   ├── [T] Terminal toggle
│   │   └── [R] RightSidebar toggle
│   └── WindowControls (minimize, maximize, close)
│
├── ResizablePanelGroup (horizontal, from react-resizable-panels)
│   ├── ResizablePanel — LeftSidebar
│   │   ├── ProjectListHeader (search, add button)
│   │   ├── ProjectList
│   │   │   └── ProjectCard (name, path, language badge)
│   │   └── ProjectActions (open folder, remove)
│   │
│   ├── ResizableHandle
│   │
│   ├── ResizablePanel — MainArea
│   │   ├── ChatView
│   │   │   ├── ChatHeader (active agent name, status badge)
│   │   │   ├── MessageList
│   │   │   │   ├── UserMessage (right-aligned bubble)
│   │   │   │   ├── AgentMessage (left-aligned bubble, streaming)
│   │   │   │   └── SystemMessage (centered, muted)
│   │   │   └── ChatInput (Tiptap editor, send button, slash commands)
│   │   │
│   │   └── TerminalPanel (togglable via [T])
│   │       ├── TerminalTabs (tab per PTY session)
│   │       └── TerminalView (xterm.js or raw PTY output)
│   │
│   ├── ResizableHandle
│   │
│   └── ResizablePanel — RightSidebar
│       ├── AgentListHeader (search, create button)
│       ├── AgentList
│       │   └── AgentCard
│       │       ├── AgentAvatar (color-coded by role)
│       │       ├── AgentName + Role badge
│       │       ├── StatusIndicator (idle, working, error)
│       │       └── QuickActions (pause, stop, restart)
│       └── SecretaryCard (pinned at top, special styling)
│
├── CommandPalette (overlay, Cmd+K)
│   ├── SearchInput
│   └── CommandList (filtered actions)
│
├── SettingsModal (overlay)
│   ├── GeneralSettings (theme, font, language)
│   ├── TelegramSettings (bot token, chat ID, toggle)
│   └── AgentDefaults (default model, max tokens)
│
├── AgentCreationDialog (overlay)
│   ├── NameField
│   ├── RoleSelector
│   ├── SkillPicker (multi-select from skill pool)
│   ├── InstructionsEditor
│   └── AdvancedConfig (model override, max tokens)
│
└── Sonner Toaster (toast notifications, bottom-right)
```

## Zustand Stores

Six stores manage all frontend state. Each store is a standalone module under `src/stores/` and uses Zustand's `create` function with optional middleware for persistence or devtools.

### agentStore

Manages the list of agents, their runtime status, and CRUD operations.

```typescript
interface Agent {
  id: string;
  name: string;
  role: "secretary" | "coder" | "reviewer" | "researcher" | "custom";
  status: "idle" | "working" | "paused" | "error" | "stopped";
  skills: string[];
  instructions: string;
  model: string;
  createdAt: string;
  lastActiveAt: string;
}

interface AgentStore {
  agents: Agent[];
  activeAgentId: string | null;

  setActiveAgent: (id: string) => void;
  addAgent: (agent: Agent) => void;
  removeAgent: (id: string) => void;
  updateAgent: (id: string, patch: Partial<Agent>) => void;
  updateStatus: (id: string, status: Agent["status"]) => void;
  getActiveAgent: () => Agent | undefined;
}
```

### projectStore

Tracks registered projects and which one is currently active.

```typescript
interface Project {
  id: string;
  name: string;
  path: string;
  language: string | null;
  lastOpenedAt: string;
}

interface ProjectStore {
  projects: Project[];
  activeProjectId: string | null;

  setActiveProject: (id: string) => void;
  addProject: (project: Project) => void;
  removeProject: (id: string) => void;
  reorderProjects: (fromIndex: number, toIndex: number) => void;
}
```

### chatStore

Holds chat messages per agent, streaming state, and input draft.

```typescript
interface ChatMessage {
  id: string;
  agentId: string;
  role: "user" | "agent" | "system";
  content: string;
  timestamp: string;
  isStreaming: boolean;
}

interface ChatStore {
  messagesByAgent: Record<string, ChatMessage[]>;
  streamingAgentIds: Set<string>;
  inputDraft: string;

  addMessage: (agentId: string, message: ChatMessage) => void;
  appendToStream: (agentId: string, messageId: string, chunk: string) => void;
  finalizeStream: (agentId: string, messageId: string) => void;
  setInputDraft: (text: string) => void;
  clearMessages: (agentId: string) => void;
  getMessagesForAgent: (agentId: string) => ChatMessage[];
}
```

### settingsStore

Application-wide settings persisted to Rust config.

```typescript
interface Settings {
  theme: "light" | "dark" | "system";
  fontFamily: string;
  fontSize: number;
  telegramBotToken: string;
  telegramChatId: string;
  telegramEnabled: boolean;
  defaultModel: string;
  defaultMaxTokens: number;
}

interface SettingsStore {
  settings: Settings;
  isLoaded: boolean;

  loadSettings: () => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  resetToDefaults: () => Promise<void>;
}
```

### telegramStore

Telegram bot connection state and remote message queue for in-app display.

```typescript
interface TelegramMessage {
  id: number;
  chatId: number;
  text: string;
  direction: "incoming" | "outgoing";
  timestamp: string;
}

interface TelegramStore {
  isConnected: boolean;
  messages: TelegramMessage[];

  setConnected: (connected: boolean) => void;
  addMessage: (message: TelegramMessage) => void;
  clearMessages: () => void;
}
```

### uiStore

Controls panel visibility, overlay states, and layout preferences. This store is the core of the state-driven panel routing pattern.

```typescript
interface UiStore {
  leftSidebarOpen: boolean;
  terminalOpen: boolean;
  rightSidebarOpen: boolean;
  commandPaletteOpen: boolean;
  settingsModalOpen: boolean;
  agentCreationDialogOpen: boolean;

  toggleLeftSidebar: () => void;
  toggleTerminal: () => void;
  toggleRightSidebar: () => void;
  toggleCommandPalette: () => void;
  setSettingsModalOpen: (open: boolean) => void;
  setAgentCreationDialogOpen: (open: boolean) => void;
}
```

### Store dependency map

```
agentStore ◄──── chatStore (messages keyed by agentId)
     ▲
     │
uiStore ────────► (controls visibility of all panels)
     ▲
     │
settingsStore ──► (theme drives CSS variable swap)
     │
projectStore ───► (active project sent to Rust on switch)
     │
telegramStore ──► (displays remote messages in chat view)
```

## Library Usage

| Library | Version | Usage |
|---------|---------|-------|
| shadcn/ui | latest | All UI primitives: Button, Card, Dialog, ScrollArea, Badge, Tooltip, DropdownMenu, Sheet, Separator, Input, Textarea, Select, Tabs, Popover |
| Tailwind CSS v4 | 4.x | Styling via utility classes. oklch color tokens defined in `@theme inline` block. Sidebar-specific tokens (`sidebar`, `sidebar-foreground`, `sidebar-accent`, `sidebar-border`) for left/right panels |
| Zustand | 5.x | Six stores (agent, project, chat, settings, telegram, ui). No provider wrappers needed. Subscriptions via `useStore(selector)` |
| Lucide React | latest | All icons throughout the UI (PanelLeft, PanelRight, Terminal, Settings, Plus, Search, Play, Pause, Square, etc.) |
| React Resizable Panels | 2.x | Three-column layout with draggable handles. Panels collapse to zero width when toggled off via uiStore |
| TanStack Query | 5.x | Wraps all Tauri invoke calls. Provides caching, background refetching, and mutation with optimistic updates |
| TanStack Table | 8.x | Agent list table in right sidebar, skill pool management table in agent creation dialog |
| React Hook Form + Zod | latest | Form state and validation for agent creation, settings, and Telegram config. Zod schemas mirror Rust types |
| dnd-kit | 6.x | Drag-to-reorder projects in left sidebar, drag agents between priority slots |
| Framer Motion | 11.x | Panel slide-in/out transitions, status badge pulse animations, chat message enter/exit animations, presence-based mount/unmount |
| Sonner | latest | Toast notifications for agent lifecycle events (started, stopped, error), Telegram messages received, validation errors |
| Tiptap | 2.x | Rich text editor for chat input. Supports markdown shortcuts, code blocks, slash commands for agent mentions |
| date-fns | 3.x | Relative timestamps in chat messages (`formatDistanceToNow`), absolute timestamps in tooltips |

## Color System

The frontend uses oklch colors defined as CSS custom properties and exposed to Tailwind via `@theme inline`. No TOML theme files are used.

```css
@theme inline {
  --color-primary: oklch(0.6397 0.1720 36.4421);
  --color-background: oklch(0.9383 0.0042 236.4993);
  --color-background-dark: oklch(0.2598 0.0306 262.6666);

  --color-sidebar: var(--color-background);
  --color-sidebar-foreground: oklch(0.30 0.02 260);
  --color-sidebar-accent: oklch(0.55 0.12 36);
  --color-sidebar-border: oklch(0.85 0.01 260);
}
```

Theme switching (light/dark/system) swaps the root CSS variables. The `settingsStore.theme` value controls which set of variables is active, applied via a `data-theme` attribute on the `<html>` element.

## Event Listener Pattern

The Rust backend emits events to the frontend for asynchronous data such as streaming agent output, status changes, and incoming Telegram messages. The frontend uses Tauri's `listen()` API inside `useEffect` hooks, with proper cleanup on unmount.

### Standard pattern

```typescript
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { useAgentStore } from "@/stores/agentStore";

function useAgentEvents() {
  const updateStatus = useAgentStore((s) => s.updateStatus);

  useEffect(() => {
    let unlisten: UnlistenFn;

    const setup = async () => {
      unlisten = await listen<{ agentId: string; status: string }>(
        "agent_status_changed",
        (event) => {
          updateStatus(event.payload.agentId, event.payload.status);
        }
      );
    };

    setup();

    return () => {
      unlisten?.();
    };
  }, [updateStatus]);
}
```

### Event catalog

| Event Name | Payload | Target Store |
|------------|---------|--------------|
| `agent_status_changed` | `{ agentId, status }` | agentStore |
| `agent_output` | `{ agentId, messageId, chunk }` | chatStore |
| `agent_output_done` | `{ agentId, messageId }` | chatStore |
| `agent_error` | `{ agentId, error }` | agentStore, chatStore |
| `telegram_message` | `{ id, chatId, text, direction }` | telegramStore |
| `telegram_status` | `{ connected }` | telegramStore |
| `project_changed` | `{ projectId, path }` | projectStore |

### Cleanup rules

- Every `listen()` call must be paired with an `unlisten()` in the cleanup function.
- The `async` setup pattern is required because `listen()` returns a promise.
- Listeners that update Zustand stores should select only the action function, not the whole store, to avoid re-registering on every render.

## Tauri Invoke Wrapper

All calls to the Rust backend go through a typed wrapper that provides compile-time safety and consistent error handling.

### Typed invoke function

```typescript
import { invoke } from "@tauri-apps/api/core";

type Commands = {
  create_agent: [{ name: string; role: string; skills: string[] }, Agent];
  delete_agent: [{ id: string }, void];
  list_agents: [void, Agent[]];
  send_message: [{ agentId: string; message: string }, void];
  switch_project: [{ path: string }, Project];
  list_projects: [void, Project[]];
  get_settings: [void, Settings];
  update_settings: [Partial<Settings>, Settings];
  start_telegram_bot: [{ token: string }, void];
  stop_telegram_bot: [void, void];
};

async function tauriInvoke<K extends keyof Commands>(
  command: K,
  ...args: Commands[K][0] extends void ? [] : [Commands[K][0]]
): Promise<Commands[K][1]> {
  return invoke(command, args[0] ?? {});
}
```

### TanStack Query integration

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

function useAgents() {
  return useQuery({
    queryKey: ["agents"],
    queryFn: () => tauriInvoke("list_agents"),
  });
}

function useCreateAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { name: string; role: string; skills: string[] }) =>
      tauriInvoke("create_agent", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });
}
```

### Error handling

```typescript
import { toast } from "sonner";

async function safeTauriInvoke<K extends keyof Commands>(
  command: K,
  ...args: Commands[K][0] extends void ? [] : [Commands[K][0]]
): Promise<Commands[K][1] | null> {
  try {
    return await tauriInvoke(command, ...args);
  } catch (error) {
    const message = typeof error === "string" ? error : "Unknown error";
    toast.error(`Command failed: ${command}`, { description: message });
    return null;
  }
}
```

Tauri invoke errors arrive as plain strings from the Rust side (the `String` in `Result<T, String>`). The wrapper catches these and routes them to Sonner toasts.

## State-Driven Panel Routing

Zentral uses no client-side router. The entire application is a single view where panel visibility is controlled by boolean flags in `uiStore`.

### How it works

```
┌─────────────────────────────────────────────────────────────────┐
│ CustomTitlebar                                                  │
│   [Icon] [Menu]            [L] [T] [R]     [─] [□] [×]         │
├─────────────────────────────────────────────────────────────────┤
│         │                              │                        │
│  Left   │         Main Area            │  Right                 │
│ Sidebar │  ┌─────────────────────┐     │ Sidebar                │
│         │  │     ChatView        │     │                        │
│ visible │  │                     │     │ visible                │
│  when   │  │                     │     │  when                  │
│  [L]    │  ├─────────────────────┤     │  [R]                   │
│  is on  │  │   TerminalPanel     │     │  is on                 │
│         │  │   visible when [T]  │     │                        │
│         │  └─────────────────────┘     │                        │
├─────────┴──────────────────────────────┴────────────────────────┤
│                        Sonner Toaster                           │
└─────────────────────────────────────────────────────────────────┘
```

### Toggle implementation

```typescript
// In CustomTitlebar.tsx
import { useUiStore } from "@/stores/uiStore";
import { PanelLeft, Terminal, PanelRight } from "lucide-react";
import { Button } from "@/components/ui/button";

function PanelToggles() {
  const { leftSidebarOpen, terminalOpen, rightSidebarOpen } = useUiStore();
  const { toggleLeftSidebar, toggleTerminal, toggleRightSidebar } =
    useUiStore();

  return (
    <div className="flex items-center gap-1">
      <Button
        variant={leftSidebarOpen ? "secondary" : "ghost"}
        size="icon"
        onClick={toggleLeftSidebar}
      >
        <PanelLeft className="h-4 w-4" />
      </Button>
      <Button
        variant={terminalOpen ? "secondary" : "ghost"}
        size="icon"
        onClick={toggleTerminal}
      >
        <Terminal className="h-4 w-4" />
      </Button>
      <Button
        variant={rightSidebarOpen ? "secondary" : "ghost"}
        size="icon"
        onClick={toggleRightSidebar}
      >
        <PanelRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

### Conditional rendering in App.tsx

```typescript
function App() {
  const { leftSidebarOpen, rightSidebarOpen, terminalOpen } = useUiStore();

  return (
    <div className="flex h-screen flex-col">
      <CustomTitlebar />
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {leftSidebarOpen && (
          <>
            <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
              <LeftSidebar />
            </ResizablePanel>
            <ResizableHandle />
          </>
        )}

        <ResizablePanel defaultSize={60}>
          <div className="flex h-full flex-col">
            <ChatView className="flex-1" />
            {terminalOpen && <TerminalPanel />}
          </div>
        </ResizablePanel>

        {rightSidebarOpen && (
          <>
            <ResizableHandle />
            <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
              <RightSidebar />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
      <Toaster position="bottom-right" />
    </div>
  );
}
```

### Keyboard shortcuts

| Shortcut | Action | Store Method |
|----------|--------|--------------|
| `Cmd+B` / `Ctrl+B` | Toggle left sidebar | `uiStore.toggleLeftSidebar` |
| `` Cmd+` `` / `` Ctrl+` `` | Toggle terminal | `uiStore.toggleTerminal` |
| `Cmd+Shift+B` / `Ctrl+Shift+B` | Toggle right sidebar | `uiStore.toggleRightSidebar` |
| `Cmd+K` / `Ctrl+K` | Open command palette | `uiStore.toggleCommandPalette` |
| `Cmd+,` / `Ctrl+,` | Open settings | `uiStore.setSettingsModalOpen(true)` |
| `Cmd+N` / `Ctrl+N` | New agent dialog | `uiStore.setAgentCreationDialogOpen(true)` |
| `Escape` | Close any open overlay | Dismiss active dialog |

### Custom window decoration

Because Tauri is configured with `decorations: false`, the `CustomTitlebar` component implements window chrome manually. The drag region is defined with `-webkit-app-region: drag` on the titlebar container, and interactive elements inside it use `-webkit-app-region: no-drag` to remain clickable. Window control buttons call Tauri's `appWindow.minimize()`, `appWindow.toggleMaximize()`, and `appWindow.close()`.

## Data Flow: Message Send

A complete trace from user input to rendered response:

```
User types in ChatInput (Tiptap)
  │
  ▼
Submit handler calls useCreateMessage mutation
  │
  ▼
tauriInvoke("send_message", { agentId, message })
  │
  ├─► chatStore.addMessage(agentId, userMessage)     ← optimistic
  │
  ▼
Rust: AgentManager.dispatch(agent_id, message)
  │
  ├─► write to agent's stdin
  │
  ▼
Agent (Claude CLI) processes and streams stdout
  │
  ▼
Rust: parse stdout chunks → emit("agent_output", { agentId, messageId, chunk })
  │
  ▼
Frontend: listen("agent_output") callback fires
  │
  ▼
chatStore.appendToStream(agentId, messageId, chunk)
  │
  ▼
React re-renders MessageList with streaming content
  │
  ▼
Rust: emit("agent_output_done", { agentId, messageId })
  │
  ▼
chatStore.finalizeStream(agentId, messageId)
```

## References

- [System Architecture](./system-architecture.md) -- high-level Tauri v2 architecture, IPC patterns, module dependency graph
- [Tauri v2 Frontend Guide](https://v2.tauri.app/develop/) -- official Tauri frontend integration docs
- [React Resizable Panels](https://github.com/bvaughn/react-resizable-panels) -- layout library for the three-column design
- [Zustand](https://zustand.docs.pmnd.rs/) -- state management library
- [TanStack Query](https://tanstack.com/query/latest) -- async state management wrapping invoke calls
- [shadcn/ui](https://ui.shadcn.com/) -- component library built on Radix UI primitives
- [Tailwind CSS v4](https://tailwindcss.com/docs) -- utility-first CSS with oklch color support
