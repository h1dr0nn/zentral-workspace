# Phase 5 -- Automation

> Adds proactive automation capabilities: recurring schedules, multi-step workflows, activity history, and a shared knowledge base.

> **Status:** ui-complete — backend not implemented
> **Last updated:** 2026-03-25
>
> **What works:** All 4 Activity Bar tabs (Schedules, Workflows, History, Knowledge) with full CRUD UI. Zustand stores persist to localStorage. Schedule frequency presets, workflow step reordering, history filtering/search, knowledge categories/tags/detail view.
> **What's missing:** Backend execution engines (scheduling engine, workflow runner, history event recording, knowledge context injection). No SQLite persistence. No actual cron firing or workflow execution.

---

## Overview

Phase 5 transforms agents from reactive chat assistants into proactive autonomous workers. Users can schedule recurring tasks, build multi-step pipelines, review a full activity log, and maintain a shared knowledge base that agents reference during execution.

Four new tabs are added to the Activity Bar, each with a dedicated Zustand store, sidebar tab UI, and backend specification.

## Tasks

### Schedules

Implement a recurring task scheduler that binds agents to skills on time-based triggers.

| Item | Detail |
|------|--------|
| Store | `scheduleStore.ts` — Schedule CRUD, toggle active/paused |
| Backend | Scheduling engine (background thread), cron expression parsing, `next_run_at` computation |
| SQLite | `schedules` table with foreign keys to agents, skills, projects |
| UI | `SchedulesTab`, `ScheduleCard`, `AddScheduleDialog` in left sidebar |
| Activity Bar | Clock icon, id: "schedules" |

Acceptance criteria:

- Users can create schedules that bind an agent + skill + optional project to a cron pattern.
- Frequency presets (daily, weekly, monthly) generate cron expressions automatically.
- The toggle switch pauses/resumes a schedule without deleting it.
- The scheduling engine fires due schedules within 60 seconds of their `next_run_at` time.
- Missed schedules (app was closed) do not retroactively execute.
- Each schedule trigger creates a history event.

### Workflows

Implement multi-step agent pipelines with conditional branching.

| Item | Detail |
|------|--------|
| Store | `workflowStore.ts` — Workflow + step CRUD, reorder, active workflow tracking |
| Backend | Execution engine (sequential step runner), timeout handling, run tracking |
| SQLite | `workflows`, `workflow_steps`, `workflow_runs`, `workflow_step_results` tables |
| UI | `WorkflowsTab` (list + detail modes), `WorkflowCard`, `WorkflowStepList`, `AddWorkflowDialog`, `AddWorkflowStepDialog` |
| Activity Bar | Workflow icon, id: "workflows" |

Acceptance criteria:

- Users can create workflows with 1–20 ordered steps.
- Each step binds an agent to a skill with optional success/failure branching.
- Steps in the detail view can be reordered via drag-and-drop (`@dnd-kit/sortable`).
- Running a workflow executes steps sequentially, following branching rules.
- Only one run per workflow at a time; concurrent run attempts are rejected.
- Each workflow run creates a history event with overall status and duration.
- The detail view shows a visual pipeline with connecting dashed lines.

### Activity History

Implement a centralized event log with filtering and date grouping.

| Item | Detail |
|------|--------|
| Store | `historyStore.ts` — Event append, filter state, clear all |
| Backend | Event recording from all sources (agent lifecycle, skill runs, schedules, workflows) |
| SQLite | `history_events` table with indices on timestamp, agent, project, type, status |
| UI | `HistoryTab`, `HistoryEventCard` (expandable), `HistoryFilters` (collapsible) |
| Activity Bar | History icon, id: "history", badge showing failure count |

Acceptance criteria:

- All agent actions, workflow runs, and schedule triggers are logged as history events.
- Events display in a newest-first timeline grouped by date (Today, Yesterday, older dates).
- Users can filter by agent, project, event type, and status (AND-combined).
- Free-text search matches against event summaries.
- Events with details are expandable with smooth animation (`framer-motion`).
- The "Clear History" action removes all events after confirmation.
- Retention policy (from Settings) automatically prunes old events (except errors).
- The Activity Bar icon shows a badge for today's failure count.

### Knowledge Base

Implement a shared document repository with agent context injection.

| Item | Detail |
|------|--------|
| Store | `knowledgeStore.ts` — Document CRUD, active document tracking |
| Backend | Document storage, agent context injection during spawning |
| SQLite | `knowledge_documents`, `knowledge_doc_projects`, `knowledge_doc_agents` tables |
| UI | `KnowledgeTab` (list + detail modes), `KnowledgeCard`, `KnowledgeDetailPanel`, `AddKnowledgeDialog` |
| Activity Bar | BookOpen icon, id: "knowledge" |

Acceptance criteria:

- Users can create documents with title, content, category, tags, and project/agent links.
- Documents are grouped by category (specs, guidelines, references, notes) in the sidebar.
- Search filters documents by title and tags.
- The detail view shows full content with metadata badges (tags, linked projects, linked agents).
- When an agent is spawned, relevant knowledge documents are injected into its system prompt.
- Context injection respects a budget of 10 documents / 16,384 characters.
- Documents can be duplicated and deleted.

### Activity Bar Integration

Wire all four new tabs into the existing Activity Bar and Left Sidebar.

| Item | Detail |
|------|--------|
| ActivityBar | Add 4 items to `topItems[]`: schedules, workflows, history, knowledge |
| LeftSidebar | Add 4 conditional render blocks for new tab components |
| Icons | Clock, Workflow, History, BookOpen from lucide-react |

Acceptance criteria:

- All 6 Activity Bar icons (projects, skills, schedules, workflows, history, knowledge) render correctly.
- Clicking each icon switches the left sidebar to the corresponding tab.
- The active indicator (left border) tracks the selected tab.

## Definition of Done

Phase 5 is complete when:

1. All four new tabs are accessible from the Activity Bar.
2. Schedules can be created, toggled, and fire on time.
3. Workflows can be built, reordered, and executed with branching.
4. All agent activity is logged in the history timeline with working filters.
5. Knowledge documents can be created and are injected into agent context.
6. All new UI fits within the sidebar's 160–260px resizable width.
7. New components follow existing patterns (shadcn/ui, Zustand, Card/Dialog/ScrollArea).
8. No regressions in existing tabs (projects, skills, agents, chat, terminal).

## References

- [Roadmap Overview](roadmap.md)
- [Phase 4 Polish](phase-4-polish.md)
- [Schedules Specification](../02-specifications/schedules.md)
- [Workflows Specification](../02-specifications/workflows.md)
- [Activity History Specification](../02-specifications/activity-history.md)
- [Knowledge Base Specification](../02-specifications/knowledge-base.md)
- [Left Sidebar -- Schedules](../03-ui-ux/sidebar-left-schedules.md)
- [Left Sidebar -- Workflows](../03-ui-ux/sidebar-left-workflows.md)
- [Left Sidebar -- History](../03-ui-ux/sidebar-left-history.md)
- [Left Sidebar -- Knowledge](../03-ui-ux/sidebar-left-knowledge.md)
