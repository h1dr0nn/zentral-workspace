# Left Sidebar -- History

> Activity timeline displaying agent events with date grouping, expandable details, color-coded status indicators, and multi-dimension filtering.

> **Status:** draft
> **Last updated:** 2026-03-25

---

## Overview

The History tab in the left sidebar provides a chronological timeline of all agent activity in the workspace. Events are grouped by date, displayed newest-first, and can be filtered by agent, project, event type, and status. Each event card is compact but expandable to reveal details.

The tab is activated by clicking the **History** icon in the Activity Bar. The icon may display a badge showing the count of recent failures.

## Layout

```
┌───────────────────────┐
│ HISTORY    [⌕] [🗑]   │
├───────────────────────┤
│ [Search events...]     │
│ Agent: All ▼  Type: ▼  │
│ Project: ▼  Status: ▼  │
├───────────────────────┤
│ TODAY                  │
│ ● Vex committed       │
│   my-app · 12s · 2m   │
│                        │
│ ● Koda ran /simplify   │
│   my-app · 45s · 15m   │
│                        │
│ ✕ Prova: 2 tests fail  │
│   my-app · 30s · 1h    │
│   ▼ (expanded details) │
│   Error: assertion...  │
│                        │
│ YESTERDAY              │
│ ● Nova deep-research   │
│   api-server · 2m · 1d │
│                        │
│ ● Workflow completed   │
│   "Code Review" · 90s  │
└───────────────────────┘
```

## Header

The header row contains:

| Element | Description | Style |
|---------|-------------|-------|
| Title | "HISTORY" uppercase label | `text-xs font-medium uppercase text-muted-foreground` |
| Filter toggle | Funnel icon, toggles filter bar visibility | `Button` variant="ghost" size="icon-xs" |
| Clear button | Trash icon, clears all history | `Button` variant="ghost" size="icon-xs", confirm before clearing |

## Filter Bar

The filter bar is collapsible (toggled by the Funnel icon). When visible, it appears between the header and the event list.

### Filter Layout

```
┌───────────────────────┐
│ [🔍 Search events...] │
│ Agent ▼    Type ▼      │
│ Project ▼  Status ▼    │
└───────────────────────┘
```

| Filter | Component | Options |
|--------|-----------|---------|
| Search | `Input` with Search icon | Free text, debounced 300ms, matches against `summary` |
| Agent | `Select` | "All agents" + list from agentStore |
| Project | `Select` | "All projects" + list from projectStore |
| Type | `Select` | "All types", skill_run, agent_start, agent_stop, workflow_run, schedule_trigger, error |
| Status | `Select` | "All", success, failure, running, cancelled |

Filters are arranged in a 2-column grid to fit the sidebar width. All filters are AND-combined.

### Active Filter Indicator

When any filter is active (non-default), the Funnel icon receives a colored dot indicator similar to notification badges. This reminds users that the list is filtered.

## Date Groups

Events are grouped by date with sticky headers:

| Group | Condition | Label |
|-------|-----------|-------|
| Today | `isToday(timestamp)` | "TODAY" |
| Yesterday | `isYesterday(timestamp)` | "YESTERDAY" |
| Older | Neither | Formatted date: "Mon, Mar 23" |

Date group headers use `text-[11px] font-medium text-muted-foreground uppercase tracking-wider`.

## History Event Card

Each event renders as a compact, single-line row with an optional expandable detail section.

### Compact Layout

```
● Vex committed changes
  my-app · 12s · 2 minutes ago
```

| Element | Description | Style |
|---------|-------------|-------|
| Status dot | Colored circle indicating outcome | See status colors below |
| Summary | One-line event description, agent name bold | `text-sm`, agent in `font-semibold` |
| Project name | Project scope, if applicable | `text-xs text-muted-foreground` |
| Duration | Execution time formatted | `text-xs text-muted-foreground` |
| Relative time | Time since event | `text-xs text-muted-foreground`, using `formatDistanceToNow` |

### Status Colors

| Status | Color | Dot Style |
|--------|-------|-----------|
| Success | Green | `bg-green-500` |
| Failure | Red | `bg-red-500` |
| Running | Blue | `bg-blue-500` with pulse animation |
| Cancelled | Gray | `bg-muted-foreground` |

### Expandable Details

Events with non-null `details` are expandable. Clicking the event card toggles the detail section:

```
✕ Prova: 2 tests failed
  my-app · 30s · 1 hour ago
  ┌─────────────────────┐
  │ Error: AssertionError│
  │ in login.test.ts:42  │
  │ Expected: 200        │
  │ Received: 401        │
  └─────────────────────┘
```

The expand/collapse animation uses `framer-motion` `AnimatePresence`:

```typescript
<AnimatePresence>
  {isExpanded && (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <pre className="text-xs text-muted-foreground whitespace-pre-wrap p-2 bg-muted/50 rounded mt-1">
        {event.details}
      </pre>
    </motion.div>
  )}
</AnimatePresence>
```

### Duration Formatting

| Duration | Format |
|----------|--------|
| < 1 second | "< 1s" |
| 1–59 seconds | "{n}s" |
| 60–3599 seconds | "{m}m {s}s" |
| ≥ 3600 seconds | "{h}h {m}m" |

## Activity Bar Badge

The History icon in the Activity Bar can display a badge to surface important information:

| Condition | Badge |
|-----------|-------|
| Any events with status "failure" today | Red badge with failure count |
| Any events with status "running" | Blue badge with running count |
| No notable events | No badge |

Badge priority: failures take precedence over running indicators.

## Components

### HistoryTab

Top-level container. Manages filter state, date grouping, and event list rendering.

### HistoryEventCard

Renders a single event row with expand/collapse behavior.

```typescript
interface HistoryEventCardProps {
  event: HistoryEvent;
}
```

### HistoryFilters

Renders the collapsible filter bar with search input and select dropdowns.

```typescript
interface HistoryFiltersProps {
  filter: HistoryFilter;
  onFilterChange: (patch: Partial<HistoryFilter>) => void;
  onReset: () => void;
}
```

## shadcn/ui Usage

| Component | Usage |
|-----------|-------|
| `ScrollArea` | Wraps the event list |
| `Badge` | Event type labels (optional), activity bar badge |
| `Button` | Filter toggle, clear button |
| `Input` | Search field |
| `Select` | Agent, project, type, status filter dropdowns |
| `Separator` | Between date groups |
| `Tooltip` | Full timestamp on hover |

## References

- [Activity History Specification](../02-specifications/activity-history.md)
- [Left Sidebar -- Projects](sidebar-left-projects.md)
- [Design System](design-system.md)
- [Themes](themes.md)
