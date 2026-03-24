# Right Sidebar -- Agents

> Agent management panel displaying configured agents with real-time status, roles, and skill badges.

> **Status:** draft
> **Last updated:** 2026-03-24

---

## Overview

The right sidebar serves as the agent management panel in Zentral. It displays all configured agents with their current status, role, and skill badges. The sidebar is toggled via the **[R]** button in the header or a configurable keyboard shortcut.

Clicking an agent card selects it as the active chat target, switching the main content area to that agent's conversation thread.

## Layout

```
┌─────────────────┐
│ AGENTS      [+]  │
├─────────────────┤
│ * Secretary     │  <- always pinned at top
│   Orchestrator  │  <- role/title
│   . Online      │  <- status badge (green)
├─────────────────┤
│   DevOps        │
│   Infrastructure│
│   o Idle        │  <- status badge (amber)
│   [docker][ci]  │  <- skill badges
├─────────────────┤
│   QA Lead       │
│   Testing       │
│   > Running...  │  <- status badge (blue pulse)
│   [testing][review]│
└─────────────────┘
```

The header row contains the section title and the **[+]** add-agent button. Below it, the Secretary card is always pinned first, followed by the remaining agent cards in a scrollable list.

## Secretary Card

The Secretary is a special built-in agent that acts as the orchestrator for the multi-agent workspace. It has distinct treatment:

| Property | Value |
|----------|-------|
| Position | Always first in the list, pinned |
| Icon | Star icon to the left of the name |
| Border | Left border using `border-primary` |
| Background | Subtle primary color tint (`bg-primary/5`) |
| Deletable | No -- the delete action is disabled |
| Default role | "Orchestrator" |

The Secretary routes user messages to the appropriate specialist agent and coordinates multi-agent workflows. Its card uses the `SecretaryCard` component rather than the generic `AgentCard`.

## Agent Card

Each agent card displays the following information:

| Element | Description | Style |
|---------|-------------|-------|
| Name | Agent name, rendered bold | `font-semibold text-sm` |
| Role/Title | Short subtitle describing the agent's function | `text-xs text-muted-foreground` |
| Status indicator | Colored dot/icon with status text | See status table below |
| Skill badges | Compact pills showing assigned skills | Small `Badge` components |

### Card Interaction

- **Click**: Selects the agent as the active chat target. The main area switches to show that agent's conversation thread.
- **Hover**: Reveals a subtle highlight and shows action icons (edit, stop/start).
- **Right-click**: Opens the agent actions dropdown menu.

## Status Indicators

Each agent displays a real-time status indicator composed of an icon, a color, and optional animation.

| Status | Icon | Color | Animation | Description |
|--------|------|-------|-----------|-------------|
| Online | filled circle | green (`text-green-500`) | none | Agent is connected and ready |
| Idle | open circle | amber (`text-amber-500`) | none | Agent is connected but inactive |
| Running | play triangle | blue (`text-blue-500`) | pulse | Agent is actively processing a task |
| Error | x mark | red (`text-red-500`) | none | Agent encountered an error |
| Stopped | filled square | gray (`text-muted-foreground`) | none | Agent has been manually stopped |
| Queued | clock | secondary (`text-secondary`) | none | Task is queued, waiting to execute |

The `StatusIndicator` component encapsulates the icon, color, and animation logic:

```typescript
interface StatusIndicatorProps {
  status: AgentStatus;
  size?: "sm" | "md";
  showLabel?: boolean;
}

type AgentStatus = "online" | "idle" | "running" | "error" | "stopped" | "queued";
```

The pulse animation for the "running" state uses a CSS keyframe:

```css
@keyframes status-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.status-running {
  animation: status-pulse 1.5s ease-in-out infinite;
}
```

## Click Behavior

Clicking an agent card triggers the following sequence:

1. The agent store updates the `activeAgentId` to the selected agent.
2. The main content area transitions to display that agent's conversation thread.
3. The agent card receives the active highlight styling (accent background, left border).
4. If the agent has unread messages, the unread count clears.

Only one agent can be the active chat target at a time. The active agent card receives the same highlight treatment as the active project card in the left sidebar for visual consistency.

## Add Agent

The **[+]** button opens the `AgentCreationDialog`, a modal form for defining a new agent. The form uses React Hook Form for state management and Zod for validation.

```typescript
import { z } from "zod";

const agentSchema = z.object({
  name: z.string()
    .min(1, "Name is required")
    .max(32, "Name must be 32 characters or fewer"),
  role: z.string()
    .min(1, "Role is required")
    .max(64, "Role must be 64 characters or fewer"),
  skills: z.array(z.string()).min(1, "Select at least one skill"),
});

type AgentFormData = z.infer<typeof agentSchema>;
```

### Skill Picker

The skill picker within the creation dialog presents checkboxes grouped by category:

| Category | Skills |
|----------|--------|
| Development | coding, review, refactoring, debugging |
| Infrastructure | docker, ci, deployment, monitoring |
| Testing | testing, e2e, unit-tests, benchmarks |
| Documentation | docs, api-docs, changelog |
| Research | research, analysis, architecture |

Skills are stored as string arrays on the agent record and rendered as `SkillBadge` components on the card.

### Dialog Layout

```
┌───────────────────────────┐
│ Create New Agent      [X] │
├───────────────────────────┤
│ Name                      │
│ ┌───────────────────────┐ │
│ │                       │ │
│ └───────────────────────┘ │
│ Role / Title              │
│ ┌───────────────────────┐ │
│ │                       │ │
│ └───────────────────────┘ │
│ Skills                    │
│ ┌───────────────────────┐ │
│ │ [ ] coding            │ │
│ │ [ ] docker            │ │
│ │ [ ] testing           │ │
│ │ ...                   │ │
│ └───────────────────────┘ │
├───────────────────────────┤
│           [Cancel] [Save] │
└───────────────────────────┘
```

## Agent Actions

Hovering over or right-clicking an agent card reveals a `DropdownMenu` with the following actions:

| Action | Behavior | Available when |
|--------|----------|----------------|
| Edit agent | Opens `AgentCreationDialog` in edit mode, pre-filled | Always |
| Delete agent | Removes the agent after confirmation dialog | Not Secretary |
| Stop | Sends a stop signal to the agent process | Running or Online |
| Start | Starts the agent process | Stopped |
| Restart | Stops then starts the agent process | Running or Online |
| View chat history | Scrolls the main area to the full conversation log | Always |

The Secretary card does not show the "Delete agent" action.

## Skill Badges

Skill badges are compact pill-shaped elements rendered below the status indicator on each agent card.

Display rules:

- Maximum **3** badges visible at a time.
- If the agent has more than 3 skills, a "+N more" overflow badge is shown.
- Hovering the overflow badge displays a `Tooltip` listing all remaining skills.

```typescript
interface SkillBadgeProps {
  skill: string;
  variant?: "default" | "outline";
}
```

Each badge is rendered using the shadcn/ui `Badge` component with the `outline` variant and a small font size (`text-[10px]`).

## Resizable

The right sidebar participates in the application-wide `ResizablePanelGroup` from shadcn/ui. Constraints:

| Property | Value |
|----------|-------|
| Minimum width | 200px |
| Default width | 260px |
| Maximum width | 400px |
| Resize handle | Vertical bar on the left edge |

The panel width is persisted to local storage so it restores on next launch.

```typescript
<ResizablePanelGroup direction="horizontal">
  <ResizablePanel>
    {/* Main content area */}
  </ResizablePanel>
  <ResizableHandle />
  <ResizablePanel defaultSize={260} minSize={200} maxSize={400}>
    <AgentSidebar />
  </ResizablePanel>
</ResizablePanelGroup>
```

## Components

### AgentSidebar

The top-level container component. Renders the header row with the title and add button, the pinned Secretary card, and the scrollable agent list.

```typescript
interface AgentSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}
```

### AgentCard

Renders a single agent entry. Handles click-to-select, hover actions, and right-click context menu.

```typescript
interface AgentCardProps {
  agent: Agent;
  isActive: boolean;
  onSelect: (id: string) => void;
  onAction: (id: string, action: AgentAction) => void;
}
```

### SecretaryCard

A specialized variant of `AgentCard` with pinned positioning, star icon, primary color border, and no delete action. Uses the same base layout but applies distinct styling.

### AddAgentButton

A styled `Button` component that opens the `AgentCreationDialog`. Displays as an icon-only button with a plus icon.

### SkillBadge

A small `Badge` component that renders a skill name. Uses the `outline` variant with compact padding.

### StatusIndicator

Renders the status icon, color, and optional animation. Accepts a status enum value and optional size/label props.

### AgentCreationDialog

A `Dialog` component containing the agent creation/edit form. Uses React Hook Form for field management and Zod for schema validation. Handles both create and edit modes.

```typescript
interface AgentCreationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  editAgent?: Agent;  // If provided, dialog opens in edit mode
}
```

## shadcn/ui Usage

The following shadcn/ui primitives are used in this sidebar:

| Component | Usage |
|-----------|-------|
| `ScrollArea` | Wraps the agent card list for vertical scrolling |
| `Badge` | Renders skill badges on each agent card |
| `Button` | The [+] add-agent button and dialog actions |
| `Dialog` | The agent creation/edit modal |
| `DropdownMenu` | Agent actions menu on hover/right-click |
| `Tooltip` | Displays full skill list on overflow badge hover, skill descriptions |
| `Separator` | Visual divider between agent cards |
| `Input` | Name and role fields in the creation dialog |
| `Checkbox` | Skill selection in the creation dialog |
| `Label` | Form field labels in the creation dialog |

## References

- [System Architecture](../02-architecture/system-architecture.md)
- [Frontend Architecture](../02-architecture/frontend-architecture.md)
- [Agent Detection Specification](../03-specifications/agent-detection.md)
- [Agent Adapters Specification](../03-specifications/agent-adapters.md)
- [Design System](../03-ui-ux/design-system.md)
- [Themes](../03-ui-ux/themes.md)
- [Left Sidebar -- Projects](./sidebar-left-projects.md)
