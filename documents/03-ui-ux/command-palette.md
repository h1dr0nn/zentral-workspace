# Command Palette

> Quick action launcher providing keyboard-driven access to all commands via fuzzy search, triggered by `Ctrl+Shift+P`.

> **Status:** ui-complete
> **Last updated:** 2026-03-25

---

## Overview

The command palette is a quick action launcher that provides keyboard-driven access to all available commands in Zentral. It opens as a centered modal overlay when the user presses `Ctrl+Shift+P` and supports fuzzy search to rapidly filter the action list.

## Layout

The palette appears as a floating modal centered horizontally and positioned in the upper third of the viewport. It consists of a search input at the top and a scrollable results list below.

```
┌─────────────────────────────────┐
│ > Search commands...            │
├─────────────────────────────────┤
│ * Switch Project          Ctrl+P│
│   New Agent        Ctrl+Shift+N │
│   Toggle Terminal         Ctrl+`│
│   Open Settings          Ctrl+, │
│   ...                           │
└─────────────────────────────────┘
```

A semi-transparent backdrop covers the rest of the application. Clicking outside the palette or pressing `Escape` closes it.

## Available Actions

All registered commands are listed in the palette. Actions are organized by category.

| Action | Category | Shortcut | Handler |
|--------|----------|----------|---------|
| Switch Project | Navigation | | `projectStore.switch` |
| Switch Agent | Navigation | Ctrl+Tab | `agentStore.setActive` |
| New Agent | Agents | Ctrl+Shift+N | open creation dialog |
| Delete Agent | Agents | | `agentStore.delete` |
| Toggle Left Sidebar | View | Ctrl+B | `uiStore.toggleLeft` |
| Toggle Terminal | View | Ctrl+` | `uiStore.toggleTerminal` |
| Toggle Right Sidebar | View | Ctrl+Shift+B | `uiStore.toggleRight` |
| Open Settings | General | Ctrl+, | open settings modal |
| Clear Chat History | Chat | | `chatStore.clear` |
| Start/Stop Telegram Bot | Telegram | | `telegramStore.toggle` |

Actions that have a global keyboard shortcut display it right-aligned in the result row. Actions without a shortcut leave that area blank.

## Fuzzy Search

Filtering is handled by the `cmdk` library, which powers the shadcn/ui `Command` component. As the user types, results are narrowed using built-in fuzzy matching against action labels and category names.

Search behavior:

- Matching is case-insensitive.
- Partial substrings and non-contiguous characters are supported (e.g., "tgl trm" matches "Toggle Terminal").
- An empty query shows all actions, with recently used actions promoted to the top.
- Results update on every keystroke with no debounce needed since filtering is synchronous and fast.

## Recent Actions

The palette tracks the last ten actions invoked by the user. When the search input is empty, recently used actions appear in a dedicated group at the top of the results list, above the categorized sections.

Recent actions are stored in the UI store and persisted across sessions via local storage.

```typescript
interface CommandPaletteState {
  open: boolean;
  recentActions: string[]; // action IDs, max 10
}
```

## Keyboard Navigation

The palette is fully operable by keyboard.

| Key | Behavior |
|-----|----------|
| Ctrl+Shift+P | Open palette |
| Escape | Close palette |
| Arrow Up / Arrow Down | Move selection through results |
| Enter | Execute selected action and close |
| Backspace (empty input) | Close palette |

Focus is trapped inside the palette while it is open. The search input receives focus automatically on open.

## Implementation

The command palette is built using the shadcn/ui `Command` primitives, which wrap the `cmdk` library.

### Component Structure

```typescript
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
```

### Mounting

The palette is rendered at the root of the application inside a dialog wrapper. It is conditionally shown based on the `open` state in the UI store.

```typescript
function CommandPalette() {
  const { open, setOpen, recentActions } = useUIStore();
  const actions = useRegisteredActions();

  return (
    <Command.Dialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search commands..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {recentActions.length > 0 && (
          <CommandGroup heading="Recent">
            {recentActions.map((action) => (
              <CommandItem key={action.id} onSelect={action.handler}>
                {action.label}
                {action.shortcut && <span>{action.shortcut}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        {Object.entries(groupByCategory(actions)).map(([category, items]) => (
          <CommandGroup key={category} heading={category}>
            {items.map((action) => (
              <CommandItem key={action.id} onSelect={action.handler}>
                {action.label}
                {action.shortcut && <span>{action.shortcut}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </Command.Dialog>
  );
}
```

### Action Registration

Actions are registered through a central registry so that new features can add commands without modifying the palette component.

```typescript
interface PaletteAction {
  id: string;
  label: string;
  category: string;
  shortcut?: string;
  handler: () => void;
}

function useRegisteredActions(): PaletteAction[] {
  // Collects actions from all stores and feature modules
}
```

### Styling

The palette follows the active theme from the design system. Key style tokens:

```css
.command-palette {
  width: 520px;
  max-height: 360px;
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.24);
}

.command-palette-input {
  padding: 12px 16px;
  font-size: 14px;
  border-bottom: 1px solid var(--color-border);
  background: transparent;
}

.command-palette-item[data-selected="true"] {
  background: var(--color-accent-muted);
}
```

## References

- [Keyboard Shortcuts](keyboard-shortcuts.md)
- [Design System](design-system.md)
- [Sidebar Left — Projects](sidebar-left-projects.md)
- [Sidebar Right — Agents](sidebar-right-agents.md)
