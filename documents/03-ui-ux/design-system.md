# Design System

> Token-based design system built on CSS custom properties with oklch colors, integrated into Tailwind CSS v4 via the `@theme inline` directive.

> **Status:** draft
> **Last updated:** 2026-03-24

---

## Overview

Zentral uses a token-based design system built on CSS custom properties with oklch colors, integrated into Tailwind CSS v4 via the `@theme inline` directive. Every visual decision -- color, spacing, typography, radius -- flows from a single source of truth defined in CSS variables.

## Color System

### oklch Format

All colors use the oklch color space: `oklch(lightness chroma hue)`.

- **Lightness** (0 to 1): perceptual brightness. 0 is black, 1 is white.
- **Chroma** (0 to ~0.4): color intensity. 0 is fully desaturated.
- **Hue** (0 to 360): position on the color wheel.

oklch provides perceptually uniform lightness, meaning two colors at the same L value look equally bright to the human eye. This makes palette construction predictable and accessible.

### Light Mode Palette (:root)

| Token | Value | Semantic Meaning |
|---|---|---|
| `--background` | `oklch(0.9383 0.0042 236.4993)` | Page and app background |
| `--foreground` | `oklch(0.3211 0 0)` | Primary text color |
| `--card` | `oklch(1.0000 0 0)` | Card and panel surfaces |
| `--card-foreground` | `oklch(0.3211 0 0)` | Text on card surfaces |
| `--primary` | `oklch(0.6397 0.1720 36.4421)` | Brand accent, warm orange/amber |
| `--primary-foreground` | `oklch(0.9846 0.0017 247.8389)` | Text on primary backgrounds |
| `--secondary` | `oklch(0.9670 0.0029 264.5419)` | Secondary surfaces and fills |
| `--secondary-foreground` | `oklch(0.3211 0 0)` | Text on secondary surfaces |
| `--muted` | `oklch(0.9846 0.0017 247.8389)` | Muted backgrounds, disabled states |
| `--muted-foreground` | `oklch(0.5561 0.0049 264.5320)` | Muted text, placeholders |
| `--accent` | `oklch(0.9119 0.0222 243.8174)` | Subtle highlights, hover states |
| `--accent-foreground` | `oklch(0.3211 0 0)` | Text on accent backgrounds |
| `--destructive` | `oklch(0.6368 0.2078 25.3313)` | Error states, delete actions, red |
| `--destructive-foreground` | `oklch(0.9846 0.0017 247.8389)` | Text on destructive backgrounds |
| `--border` | `oklch(0.9022 0.0052 247.8822)` | Borders and dividers |
| `--input` | `oklch(0.9022 0.0052 247.8822)` | Input field borders |
| `--ring` | `oklch(0.6397 0.1720 36.4421)` | Focus ring color (matches primary) |
| `--sidebar` | `oklch(0.9030 0.0046 258.3257)` | Sidebar background |
| `--sidebar-foreground` | `oklch(0.3211 0 0)` | Sidebar text |
| `--sidebar-border` | `oklch(0.9022 0.0052 247.8822)` | Sidebar dividers |
| `--sidebar-accent` | `oklch(0.9119 0.0222 243.8174)` | Sidebar hover/active items |
| `--sidebar-accent-foreground` | `oklch(0.3211 0 0)` | Text on sidebar accent |
| `--sidebar-primary` | `oklch(0.6397 0.1720 36.4421)` | Sidebar primary actions |
| `--sidebar-primary-foreground` | `oklch(0.9846 0.0017 247.8389)` | Text on sidebar primary |
| `--sidebar-ring` | `oklch(0.6397 0.1720 36.4421)` | Sidebar focus rings |

### Dark Mode Palette (.dark)

| Token | Value | Semantic Meaning |
|---|---|---|
| `--background` | `oklch(0.2598 0.0306 262.6666)` | Page background, deep blue-gray |
| `--foreground` | `oklch(0.9219 0 0)` | Primary text, near-white |
| `--card` | `oklch(0.3106 0.0301 268.6365)` | Card surfaces, slightly lighter |
| `--card-foreground` | `oklch(0.9219 0 0)` | Text on cards |
| `--primary` | `oklch(0.6397 0.1720 36.4421)` | Same warm orange, shared across modes |
| `--primary-foreground` | `oklch(0.1500 0 0)` | Dark text on primary |
| `--secondary` | `oklch(0.3500 0.0250 265.0000)` | Secondary surfaces |
| `--secondary-foreground` | `oklch(0.9219 0 0)` | Text on secondary |
| `--muted` | `oklch(0.3200 0.0280 266.0000)` | Muted backgrounds |
| `--muted-foreground` | `oklch(0.6500 0.0040 264.0000)` | Muted text, placeholders |
| `--accent` | `oklch(0.3700 0.0350 264.0000)` | Accent highlights |
| `--accent-foreground` | `oklch(0.9219 0 0)` | Text on accent |
| `--destructive` | `oklch(0.6368 0.2078 25.3313)` | Same red across modes |
| `--destructive-foreground` | `oklch(0.9219 0 0)` | Text on destructive |
| `--border` | `oklch(0.3800 0.0260 266.0000)` | Borders, subtle dividers |
| `--input` | `oklch(0.3800 0.0260 266.0000)` | Input borders |
| `--ring` | `oklch(0.6397 0.1720 36.4421)` | Focus ring, matches primary |
| `--sidebar` | `oklch(0.3100 0.0283 267.7408)` | Sidebar background |
| `--sidebar-foreground` | `oklch(0.9219 0 0)` | Sidebar text |
| `--sidebar-border` | `oklch(0.3800 0.0260 266.0000)` | Sidebar dividers |
| `--sidebar-accent` | `oklch(0.3700 0.0350 264.0000)` | Sidebar active items |
| `--sidebar-accent-foreground` | `oklch(0.9219 0 0)` | Text on sidebar accent |
| `--sidebar-primary` | `oklch(0.6397 0.1720 36.4421)` | Sidebar primary actions |
| `--sidebar-primary-foreground` | `oklch(0.1500 0 0)` | Text on sidebar primary |
| `--sidebar-ring` | `oklch(0.6397 0.1720 36.4421)` | Sidebar focus rings |

### Design Notes

- **Primary** is a warm orange/amber (hue ~36) and stays constant between light and dark mode. This gives Zentral a recognizable brand color regardless of theme.
- **Destructive** is a saturated red (hue ~25) used exclusively for error states and destructive actions.
- **Background and foreground** invert between modes: light mode uses high-lightness backgrounds with low-lightness text; dark mode does the reverse.
- **Sidebar** tokens exist as a separate set so the sidebar can have distinct surface treatment from the main content area.

## Tailwind Integration

Zentral uses Tailwind CSS v4 with the `@theme inline` directive to bridge CSS variables into the Tailwind utility class system. The mapping block is placed at the top of the main CSS file.

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-ring: var(--sidebar-ring);
  --radius: 0.625rem;
}
```

### Usage in Components

With the mapping in place, standard Tailwind utilities resolve to the design tokens automatically:

```typescript
// Background and text
<div className="bg-background text-foreground">

// Cards
<div className="bg-card text-card-foreground border border-border rounded-md">

// Primary button
<button className="bg-primary text-primary-foreground hover:bg-primary/90">

// Destructive action
<button className="bg-destructive text-destructive-foreground">

// Sidebar
<aside className="bg-sidebar text-sidebar-foreground border-r border-sidebar-border">

// Muted helper text
<p className="text-muted-foreground text-sm">

// Focus ring
<input className="focus-visible:ring-2 focus-visible:ring-ring">
```

## Typography

### Font Stack

Zentral uses three font families, all relying on the system font stack to avoid web font loading overhead.

| Family | CSS Value | Usage |
|---|---|---|
| Sans | `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` | UI text, labels, headings |
| Serif | `ui-serif, Georgia, Cambria, "Times New Roman", Times, serif` | Reserved for future editorial content |
| Mono | `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", "Courier New", monospace` | Terminal output, code blocks, inline code |

### Size Scale

| Class | Size | Line Height | Usage |
|---|---|---|---|
| `text-xs` | 0.75rem (12px) | 1rem | Badge text, fine print |
| `text-sm` | 0.875rem (14px) | 1.25rem | Secondary labels, sidebar items |
| `text-base` | 1rem (16px) | 1.5rem | Body text, default |
| `text-lg` | 1.125rem (18px) | 1.75rem | Section titles |
| `text-xl` | 1.25rem (20px) | 1.75rem | Page headings |
| `text-2xl` | 1.5rem (24px) | 2rem | Major headings |

### Terminal Typography

The terminal grid uses the monospace stack at a fixed size. The font size and line height are controlled by the terminal configuration, not by Tailwind classes, to ensure precise character cell alignment.

```css
.terminal-grid {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas,
    "Liberation Mono", "Courier New", monospace;
  font-size: 14px;
  line-height: 1.2;
}
```

## Spacing

Zentral follows the Tailwind default spacing scale, built on a 4px base unit.

| Class | Value | Pixels |
|---|---|---|
| `p-0` | 0 | 0px |
| `p-0.5` | 0.125rem | 2px |
| `p-1` | 0.25rem | 4px |
| `p-2` | 0.5rem | 8px |
| `p-3` | 0.75rem | 12px |
| `p-4` | 1rem | 16px |
| `p-5` | 1.25rem | 20px |
| `p-6` | 1.5rem | 24px |
| `p-8` | 2rem | 32px |
| `p-10` | 2.5rem | 40px |
| `p-12` | 3rem | 48px |

The same scale applies to margin (`m-`), gap (`gap-`), width (`w-`), and height (`h-`) utilities.

### Spacing Conventions

- **Component internal padding**: `p-3` or `p-4`
- **Gap between list items**: `gap-1` or `gap-2`
- **Section separation**: `gap-4` or `gap-6`
- **Page-level margins**: `p-4` to `p-6`
- **Sidebar width**: fixed at `w-64` (256px) or collapsible

## Border Radius

The base radius is `0.625rem` (10px), set via `--radius` in the theme. Tailwind maps variants relative to this value.

| Class | Computed Value | Usage |
|---|---|---|
| `rounded-sm` | `calc(var(--radius) - 4px)` | Small chips, inline badges |
| `rounded-md` | `calc(var(--radius) - 2px)` | Inputs, buttons, small cards |
| `rounded-lg` | `var(--radius)` | Cards, dialogs, panels |
| `rounded-xl` | `calc(var(--radius) + 4px)` | Large modals, hero surfaces |
| `rounded-full` | `9999px` | Avatars, circular indicators |

## Component Library

Zentral uses shadcn/ui as its component foundation. These are not imported as a package but copied into the project as source files, giving full control over styling and behavior. All components consume the design tokens defined above.

| Component | Description |
|---|---|
| **Button** | Primary, secondary, destructive, outline, and ghost variants. Sizes: sm, default, lg, icon. |
| **Card** | Surface container with optional header, content, and footer sections. Uses `bg-card` and `border`. |
| **Dialog** | Modal overlay for confirmations, forms, and detail views. Includes title, description, and close. |
| **ScrollArea** | Custom scrollbar wrapper used in sidebars, terminal output, and long lists. |
| **Badge** | Small status labels. Variants: default, secondary, destructive, outline. |
| **Tooltip** | Hover-triggered information popup. Used for icon buttons and truncated text. |
| **Input** | Text input field with focus ring and border styling. Supports disabled and error states. |
| **Select** | Dropdown select with search support. Used for shell selection, theme picker. |
| **Checkbox** | Toggle control for boolean settings. |
| **Tabs** | Tab navigation for switching between views (sessions, agents, context panels). |
| **DropdownMenu** | Context menus and action menus triggered by buttons or right-click. |
| **Command** | Command palette component (cmdk-based). Powers the Ctrl+K quick-action palette. |
| **Separator** | Horizontal or vertical divider line using `border` color. |
| **Sheet** | Slide-in panel from screen edge. Used for mobile sidebar and settings drawer. |
| **Popover** | Floating panel anchored to a trigger element. Used for color pickers and filters. |

## Status Indicators

Agent and process states are communicated through color and animation.

| State | Color Token | Visual Treatment |
|---|---|---|
| Online | `oklch(0.72 0.19 142)` (green) | Solid dot |
| Idle | `oklch(0.80 0.15 85)` (amber/yellow) | Solid dot |
| Running | `oklch(0.62 0.18 250)` (blue) | Dot with pulse animation |
| Error | `var(--destructive)` (red) | Solid dot, may include icon |
| Stopped | `var(--muted-foreground)` (gray) | Hollow or dimmed dot |
| Queued | `var(--secondary)` | Outlined dot |

### Pulse Animation

The Running state uses a CSS pulse to draw attention to active processes.

```css
@keyframes status-pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.status-running {
  animation: status-pulse 2s ease-in-out infinite;
}
```

### Status Dot Component

```typescript
function StatusDot({ state }: { state: AgentState }) {
  const styles: Record<AgentState, string> = {
    online: "bg-green-500",
    idle: "bg-amber-400",
    running: "bg-blue-500 animate-pulse",
    error: "bg-destructive",
    stopped: "bg-muted-foreground",
    queued: "border border-secondary bg-transparent",
  };

  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${styles[state]}`}
      aria-label={state}
    />
  );
}
```

## Icons

Zentral uses [Lucide React](https://lucide.dev/) for all iconography. Lucide provides a consistent set of 1px-stroke SVG icons that scale cleanly.

### Installation

```json
{
  "dependencies": {
    "lucide-react": "^0.400.0"
  }
}
```

### Common Icons

| Icon | Import | Usage |
|---|---|---|
| `Bot` | `lucide-react` | Agent indicators, AI features |
| `FolderOpen` | `lucide-react` | Working directory, file browser |
| `Settings` | `lucide-react` | Settings modal trigger |
| `Terminal` | `lucide-react` | Terminal tab icon, shell indicator |
| `PanelLeft` | `lucide-react` | Toggle left sidebar |
| `PanelRight` | `lucide-react` | Toggle right sidebar |
| `Plus` | `lucide-react` | New session, add item |
| `Trash` | `lucide-react` | Delete session, remove item |
| `Play` | `lucide-react` | Start agent, run command |
| `Square` | `lucide-react` | Stop agent, halt process |
| `RefreshCw` | `lucide-react` | Restart, refresh context |
| `Send` | `lucide-react` | Send message to agent |
| `MessageSquare` | `lucide-react` | Agent chat, conversation |

### Usage Pattern

```typescript
import { Terminal, Settings, Bot } from "lucide-react";

<Button variant="ghost" size="icon">
  <Terminal className="h-4 w-4" />
</Button>

<Bot className="h-5 w-5 text-primary" />
```

Icons default to `currentColor` for stroke, so they inherit text color from their parent container. Use `h-4 w-4` (16px) for inline/button icons and `h-5 w-5` (20px) for standalone or sidebar icons.

## References

- [Themes](./themes.md) -- full CSS variable definitions and theme toggle implementation
- [Terminal View](./terminal-view.md) -- terminal-specific rendering and typography
- [Header](./header.md) -- header bar layout and icon usage
- [Sidebar Left](./sidebar-left.md) -- session sidebar component structure
- [Sidebar Right](./sidebar-right.md) -- agent and context sidebar panels
