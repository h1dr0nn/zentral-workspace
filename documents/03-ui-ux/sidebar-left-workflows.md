# Left Sidebar -- Workflows

> Workflow management tab with list and detail views for creating, editing, and visualizing multi-step agent pipelines.

> **Status:** draft
> **Last updated:** 2026-03-25

---

## Overview

The Workflows tab in the left sidebar provides a two-mode interface for managing agent pipelines. In **list mode**, users see all workflows as cards. In **detail mode** (activated by clicking a workflow), users see the step-by-step pipeline with visual connections and drag-to-reorder support.

The tab is activated by clicking the **Workflow** icon in the Activity Bar.

## Layout -- List Mode

```
┌──────────────────────┐
│ WORKFLOWS        [+]  │
├──────────────────────┤
│ Code Review Pipeline   │
│ [active]               │
│ Koda → Prova → Vex     │
│ [my-app]               │
├──────────────────────┤
│ Research & Document    │
│ [draft]                │
│ Nova → Doxa            │
│ [api-server]           │
└──────────────────────┘
```

The header row contains the section title and the **[+]** add-workflow button.

## Layout -- Detail Mode

```
┌──────────────────────┐
│ ← Code Review Pipeline│
│ [active] [Run] [...]  │
├──────────────────────┤
│  ① Koda: /simplify    │
│  │                     │
│  │ on success ↓        │
│  │                     │
│  ② Prova: /test        │
│  │                     │
│  ├─ success ↓          │
│  └─ failure → (halt)   │
│  │                     │
│  ③ Vex: /commit        │
│  │                     │
│  (end)                 │
│                        │
│  [+ Add Step]          │
└──────────────────────┘
```

The back arrow **←** returns to list mode. The header shows the workflow name, status badge, Run button, and more-actions menu.

## Workflow Card

Each workflow card in list mode displays:

| Element | Description | Style |
|---------|-------------|-------|
| Name | Workflow name | `font-semibold text-sm` |
| Status badge | "draft", "active", or "paused" | `Badge` with variant per status |
| Step summary | Agent names joined by arrows: "Koda → Prova → Vex" | `text-xs text-muted-foreground` |
| Project badge | Project name, if workflow is scoped | `Badge` component, `secondary` variant |
| Context menu | Edit, Run Now, Pause/Resume, Delete | `DropdownMenu` |

### Status Badge Variants

| Status | Badge Variant | Color |
|--------|--------------|-------|
| Draft | `outline` | Default (gray border) |
| Active | `default` | Primary (filled) |
| Paused | `secondary` | Muted |

### Card Interaction

- **Click card**: Enters detail mode for this workflow (sets `activeWorkflowId`).
- **Hover**: Reveals the MoreVertical dropdown trigger.

### Context Menu

| Action | Behavior | Available When |
|--------|----------|----------------|
| Edit | Opens `AddWorkflowDialog` in edit mode | Always |
| Run Now | Triggers immediate workflow execution | Status is `active` |
| Pause | Sets status to `paused` | Status is `active` |
| Resume | Sets status to `active` | Status is `paused` |
| Delete | Removes workflow after confirmation | Always |

## Workflow Step List

The detail view renders steps as a vertical pipeline with connecting elements.

### Step Item

Each step renders as a compact card within the pipeline:

```
┌──────────────────────┐
│ ≡ ① Koda: /simplify  │
│    on success → next  │
│    on failure → halt  │
└──────────────────────┘
  │ (connecting line)
  ▼
```

| Element | Description | Style |
|---------|-------------|-------|
| Drag handle | `≡` grip icon for reordering | `GripVertical` icon, `cursor-grab` |
| Step number | Circled number (1-based) | `w-5 h-5 rounded-full bg-primary text-[10px] text-primary-foreground` |
| Agent + Skill | "{agent.name}: /{skill.name}" | `text-sm font-medium` |
| Branching labels | "on success → next", "on failure → halt" | `text-[11px] text-muted-foreground` |

### Connecting Lines

Steps are connected by vertical dashed lines:

```css
/* Between steps */
.step-connector {
  border-left: 2px dashed hsl(var(--border));
  margin-left: 14px;   /* Align with step number center */
  height: 16px;
}
```

### Drag and Drop

Steps can be reordered using `@dnd-kit/sortable`:

- Grab the `≡` handle to start dragging.
- Drop position determines the new `order` value.
- After drop, `reorderSteps` is called with the new order.
- The `on_success` and `on_failure` references are **not** automatically updated on reorder — the user must fix branching manually if the order changes.

### Add Step Button

Below the last step, a button allows adding new steps:

```
┌──────────────────────┐
│ + Add Step            │
└──────────────────────┘
```

Clicking opens the `AddWorkflowStepDialog`.

## Add Workflow Dialog

The **[+]** button in list mode opens the `AddWorkflowDialog`.

### Dialog Layout

```
┌────────────────────────────┐
│ New Workflow             [X] │
├────────────────────────────┤
│ Name                        │
│ ┌────────────────────────┐  │
│ │ Code Review Pipeline   │  │
│ └────────────────────────┘  │
│ Description                 │
│ ┌────────────────────────┐  │
│ │ Reviews and commits    │  │
│ │ code changes           │  │
│ └────────────────────────┘  │
│ Project (optional)          │
│ ┌────────────────────────┐  │
│ │ my-app               ▼ │  │
│ └────────────────────────┘  │
│ Status                      │
│ (●) Draft  ( ) Active       │
├────────────────────────────┤
│          [Cancel] [Create]  │
└────────────────────────────┘
```

| Field | Component | Validation |
|-------|-----------|------------|
| Name | `Input` | Required, 1–64 chars |
| Description | `Input` | Optional, 0–256 chars |
| Project | `Select` | Optional |
| Status | `RadioGroup` | Required, default "draft" |

Dialog width: `sm:max-w-[480px]`

## Add Workflow Step Dialog

The "Add Step" button in detail mode opens the `AddWorkflowStepDialog`.

### Dialog Layout

```
┌────────────────────────────┐
│ Add Step                [X] │
├────────────────────────────┤
│ Agent                       │
│ ┌────────────────────────┐  │
│ │ Prova                ▼ │  │
│ └────────────────────────┘  │
│ Skill                       │
│ ┌────────────────────────┐  │
│ │ /test                ▼ │  │
│ └────────────────────────┘  │
│ Label (optional)            │
│ ┌────────────────────────┐  │
│ │ Run test suite         │  │
│ └────────────────────────┘  │
│ On Success                  │
│ ┌────────────────────────┐  │
│ │ → Next step          ▼ │  │
│ └────────────────────────┘  │
│ On Failure                  │
│ ┌────────────────────────┐  │
│ │ → Halt workflow      ▼ │  │
│ └────────────────────────┘  │
├────────────────────────────┤
│            [Cancel] [Add]   │
└────────────────────────────┘
```

| Field | Component | Validation |
|-------|-----------|------------|
| Agent | `Select` | Required |
| Skill | `Select` | Required, filtered by agent |
| Label | `Input` | Optional, 0–64 chars |
| On Success | `Select` | Options: "Next step", "End workflow", or specific step |
| On Failure | `Select` | Options: "Halt workflow", "End workflow", or specific step |

Dialog width: `sm:max-w-[480px]`

## Empty State

```
┌──────────────────────┐
│ WORKFLOWS        [+]  │
├──────────────────────┤
│                       │
│  No workflows yet.    │
│  Click + to create    │
│  an agent pipeline.   │
│                       │
└──────────────────────┘
```

## Components

### WorkflowsTab

Top-level container. Manages list/detail mode toggle based on `activeWorkflowId`.

### WorkflowCard

Renders a single workflow in list mode. Resolves step agent IDs to names for the summary line.

```typescript
interface WorkflowCardProps {
  workflow: Workflow;
  onSelect: (id: string) => void;
  onEdit: (workflow: Workflow) => void;
  onDelete: (id: string) => void;
}
```

### WorkflowStepList

Renders the vertical step pipeline in detail mode. Integrates `@dnd-kit/sortable` for reordering.

```typescript
interface WorkflowStepListProps {
  workflow: Workflow;
  onAddStep: () => void;
  onEditStep: (step: WorkflowStep) => void;
  onRemoveStep: (stepId: string) => void;
  onReorder: (stepIds: string[]) => void;
}
```

### AddWorkflowDialog

Modal form for creating and editing workflows.

```typescript
interface AddWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editWorkflow?: Workflow | null;
}
```

### AddWorkflowStepDialog

Modal form for adding and editing individual steps.

```typescript
interface AddWorkflowStepDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowId: string;
  existingSteps: WorkflowStep[];
  editStep?: WorkflowStep | null;
}
```

## shadcn/ui Usage

| Component | Usage |
|-----------|-------|
| `ScrollArea` | Wraps card list and step list |
| `Badge` | Status and project badges |
| `Button` | [+], Run, Back, Add Step buttons |
| `Dialog` | Workflow and step creation modals |
| `DropdownMenu` | Workflow context menu |
| `Input` | Name, description, label fields |
| `Select` | Agent, skill, project, branching selects |
| `RadioGroup` | Status selection |
| `Separator` | Between workflow cards |
| `Label` | Form field labels |

## References

- [Workflows Specification](../02-specifications/workflows.md)
- [Left Sidebar -- Projects](sidebar-left-projects.md)
- [Design System](design-system.md)
- [Themes](themes.md)
