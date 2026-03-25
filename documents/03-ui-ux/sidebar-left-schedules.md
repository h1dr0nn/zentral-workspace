# Left Sidebar -- Schedules

> Schedule management tab displaying recurring agent tasks with time patterns, toggle controls, and creation dialog.

> **Status:** draft
> **Last updated:** 2026-03-25

---

## Overview

The Schedules tab in the left sidebar displays all configured recurring tasks. Each schedule card shows which agent runs which skill, when it runs, and whether it is currently active. Users can create, edit, pause/resume, and delete schedules from this tab.

The tab is activated by clicking the **Clock** icon in the Activity Bar.

## Layout

```
┌──────────────────────┐
│ SCHEDULES        [+]  │
├──────────────────────┤
│ Vex: /review-pr       │
│ [Daily] Next: 9:00 AM │
│ [my-app]         [ON] │
├──────────────────────┤
│ Nova: /deep-research   │  <- opacity-60 (paused)
│ [Weekly] Mon 10:00 AM  │
│ [api-server]    [OFF] │
├──────────────────────┤
│ Koda: /simplify        │
│ [Daily] Next: 6:00 PM  │
│                  [ON] │
└──────────────────────┘
```

The header row contains the section title and the **[+]** add-schedule button. Below it, a vertically scrollable area holds the schedule cards sorted by `nextRunAt` (soonest first).

## Schedule Card

Each schedule card displays the following information:

| Element | Description | Style |
|---------|-------------|-------|
| Agent + Skill | Primary identifier: "{agent.name}: /{skill.name}" | `font-semibold text-sm` |
| Frequency badge | "Daily", "Weekly", "Monthly", or "Custom" | `Badge` component, `outline` variant |
| Next run time | Formatted relative or absolute time | `text-xs text-muted-foreground` |
| Project badge | Project name, if schedule is scoped to a project | `Badge` component, `secondary` variant |
| Toggle switch | Active/paused state | `Switch` component, right-aligned |
| Context menu | Edit, Delete actions | `DropdownMenu` on MoreVertical icon |

### Card States

| State | Visual Treatment |
|-------|-----------------|
| Active | Normal opacity, switch ON, next run time shown |
| Paused | `opacity-60`, switch OFF, "Paused" text instead of next run |
| Disabled | `opacity-40`, switch hidden, "Disabled" label |

### Card Interaction

- **Click toggle**: Switches schedule between active and paused.
- **Click card body**: No-op (schedules are not selectable like projects/agents).
- **Hover**: Reveals the MoreVertical dropdown trigger.

### Context Menu

| Action | Behavior |
|--------|----------|
| Edit | Opens `AddScheduleDialog` in edit mode, pre-filled |
| Delete | Removes the schedule after confirmation toast |

### Time Formatting

Next run time is displayed using `date-fns`:

- If within the next 24 hours: `"Today at 9:00 AM"` or `"Tomorrow at 10:00 AM"`
- If within the next 7 days: `"Wed at 6:00 PM"`
- Otherwise: `"Mar 15 at 9:00 AM"`

Last run time (shown in expanded view or tooltip): `"Last run: 2h ago"` using `formatDistanceToNow`.

## Add Schedule Dialog

The **[+]** button opens the `AddScheduleDialog`, a modal form for creating or editing a schedule.

### Dialog Layout

```
┌────────────────────────────┐
│ New Schedule            [X] │
├────────────────────────────┤
│ Name                        │
│ ┌────────────────────────┐  │
│ │ Daily PR Review        │  │
│ └────────────────────────┘  │
│ Agent                       │
│ ┌────────────────────────┐  │
│ │ Vex                  ▼ │  │
│ └────────────────────────┘  │
│ Skill                       │
│ ┌────────────────────────┐  │
│ │ /review-pr           ▼ │  │
│ └────────────────────────┘  │
│ Project (optional)          │
│ ┌────────────────────────┐  │
│ │ my-app               ▼ │  │
│ └────────────────────────┘  │
│ Frequency                   │
│ (●) Daily  ( ) Weekly       │
│ ( ) Monthly ( ) Custom      │
│                             │
│ Time                        │
│ ┌────────────────────────┐  │
│ │ 09:00                  │  │
│ └────────────────────────┘  │
│                             │
│ [if Weekly:]                │
│ Day of Week                 │
│ ┌────────────────────────┐  │
│ │ Monday               ▼ │  │
│ └────────────────────────┘  │
│                             │
│ [if Custom:]                │
│ Cron Expression             │
│ ┌────────────────────────┐  │
│ │ 0 9 * * 1-5           │  │
│ └────────────────────────┘  │
│ (hint: min hour dom mon dow)│
├────────────────────────────┤
│          [Cancel] [Create]  │
└────────────────────────────┘
```

### Dialog Fields

| Field | Component | Validation |
|-------|-----------|------------|
| Name | `Input` | Required, 1–64 chars |
| Agent | `Select` | Required, populated from agent store |
| Skill | `Select` | Required, filtered to selected agent's skills |
| Project | `Select` | Optional, "None" option + all projects |
| Frequency | `RadioGroup` | Required, default "daily" |
| Time | `Input` type="time" | Required for daily/weekly/monthly |
| Day of Week | `Select` | Required for weekly, Mon–Sun |
| Cron Expression | `Input` | Required for custom, validated |

### Conditional Fields

- **Skill select** updates when Agent changes (filters to that agent's skills).
- **Day of Week** appears only when frequency is "weekly".
- **Cron Expression** replaces Time and Day fields when frequency is "custom".

### Dialog Width

`sm:max-w-[520px]`

## Empty State

When no schedules have been created:

```
┌──────────────────────┐
│ SCHEDULES        [+]  │
├──────────────────────┤
│                       │
│   No schedules yet.   │
│   Click + to schedule │
│   a recurring task.   │
│                       │
└──────────────────────┘
```

## Components

### SchedulesTab

Top-level container. Renders the header, manages dialog state, and wraps the card list in a `ScrollArea`.

### ScheduleCard

Renders a single schedule entry. Resolves `agentId` and `skillId` to display names via their respective stores.

```typescript
interface ScheduleCardProps {
  schedule: Schedule;
  onEdit: (schedule: Schedule) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}
```

### AddScheduleDialog

Modal form for creating and editing schedules. Uses local `useState` for each field. Resets on close.

```typescript
interface AddScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editSchedule?: Schedule | null;
}
```

## shadcn/ui Usage

| Component | Usage |
|-----------|-------|
| `ScrollArea` | Wraps the schedule card list |
| `Badge` | Frequency and project badges |
| `Button` | The [+] button and dialog actions |
| `Dialog` | The create/edit modal |
| `DropdownMenu` | Context menu on each card |
| `Input` | Name, time, and cron expression fields |
| `Select` | Agent, skill, project, and day-of-week dropdowns |
| `RadioGroup` | Frequency selection |
| `Switch` | Active/paused toggle on each card |
| `Label` | Form field labels |
| `Tooltip` | Last run time on hover |

## References

- [Schedules Specification](../02-specifications/schedules.md)
- [Left Sidebar -- Projects](sidebar-left-projects.md)
- [Design System](design-system.md)
- [Themes](themes.md)
