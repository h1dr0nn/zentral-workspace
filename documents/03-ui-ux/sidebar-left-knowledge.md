# Left Sidebar -- Knowledge

> Knowledge base tab with category-grouped document list, search, detail view with content rendering, and document creation dialog.

> **Status:** draft
> **Last updated:** 2026-03-25

---

## Overview

The Knowledge tab in the left sidebar manages the shared document repository. It uses a two-mode interface: **list mode** shows documents grouped by category, and **detail mode** shows the full content of a selected document. Users can create, edit, search, and delete documents.

The tab is activated by clicking the **BookOpen** icon in the Activity Bar.

## Layout -- List Mode

```
┌───────────────────────┐
│ KNOWLEDGE   [+] [...]  │
├───────────────────────┤
│ [🔍 Search docs...]    │
├───────────────────────┤
│ SPECS                  │
│ Project Architecture    │
│ [architecture][frontend]│
│ Updated 2d ago          │
│                         │
│ GUIDELINES             │
│ Git Conventions          │
│ [git] [workflow]         │
│ Updated 5d ago           │
│                         │
│ REFERENCES             │
│ API Endpoints Reference  │
│ [api] [rest]             │
│ Updated 1w ago           │
│                         │
│ NOTES                  │
│ Meeting Notes 2026-03    │
│ [meetings]               │
│ Updated 1d ago           │
└───────────────────────┘
```

## Layout -- Detail Mode

```
┌───────────────────────┐
│ ← Project Architecture │
│ [specs] Updated 2d ago │
├───────────────────────┤
│ Tags:                  │
│ [architecture][frontend]│
│                        │
│ Projects:              │
│ [my-app]               │
│                        │
│ Agents:                │
│ [Koda] [Flux]          │
├───────────────────────┤
│                        │
│ The application follows│
│ a three-layer          │
│ architecture:          │
│                        │
│ - Presentation: React  │
│   components with      │
│   Zustand state        │
│ - Bridge: Tauri IPC    │
│   commands             │
│ - Core: Rust backend   │
│   modules              │
│                        │
│ Each layer communicates│
│ through well-defined   │
│ interfaces...          │
│                        │
└───────────────────────┘
```

## Header

### List Mode Header

| Element | Description |
|---------|-------------|
| Title | "KNOWLEDGE" uppercase label |
| Add button | **[+]** opens `AddKnowledgeDialog` |
| More menu | Dropdown with "Import Document" option (future) |

### Detail Mode Header

| Element | Description |
|---------|-------------|
| Back arrow | **←** returns to list mode (sets `activeDocumentId = null`) |
| Document title | Displayed as header text |
| Category badge | Category label as `Badge` |
| Updated time | Relative timestamp |

## Search

The search input is always visible at the top of the list mode, below the header:

```
┌───────────────────────┐
│ 🔍 Search docs...      │
└───────────────────────┘
```

- Filters documents by matching against `title` and `tags`.
- Debounced at 300ms.
- When active, category grouping is flattened — all matching documents shown in a single list sorted by relevance (title match first, then tag match).

## Category Groups

Documents are grouped by category following the same pattern as `SkillsTab`:

| Category | Display Order | Icon Suggestion |
|----------|--------------|-----------------|
| Specs | 1 | — |
| Guidelines | 2 | — |
| References | 3 | — |
| Notes | 4 | — |

Category headers: `text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-3 py-1`

Categories with no documents are hidden.

## Knowledge Card

Each document in list mode renders as a card:

| Element | Description | Style |
|---------|-------------|-------|
| Title | Document title | `text-sm font-medium` |
| Tags | Tag badges, max 3 visible + overflow | `Badge` variant="outline", `text-[10px]` |
| Updated time | "Updated 2d ago" | `text-xs text-muted-foreground` |
| Context menu | Edit, Duplicate, Delete | `DropdownMenu` |

### Card Interaction

- **Click card**: Enters detail mode (sets `activeDocumentId`).
- **Hover**: Reveals the MoreVertical dropdown trigger.

### Context Menu

| Action | Behavior |
|--------|----------|
| Edit | Opens `AddKnowledgeDialog` in edit mode |
| Duplicate | Creates a copy with " (copy)" appended to title |
| Delete | Removes document after confirmation |

## Detail Panel

The detail view shows the full document with metadata and content.

### Metadata Section

| Element | Description | Style |
|---------|-------------|-------|
| Tags | All tag badges | `Badge` variant="outline" |
| Projects | Linked project names as badges | `Badge` variant="secondary" |
| Agents | Linked agent names as badges | `Badge` variant="secondary" |

If no projects or agents are linked, those sections are hidden.

### Content Section

Document content is rendered as plain text with preserved whitespace for the initial implementation:

```typescript
<div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
  {document.content}
</div>
```

Future enhancement: render as Markdown using `react-markdown` (already a project dependency).

### Detail Actions

A floating action bar at the bottom of the detail view:

```
┌───────────────────────┐
│    [Edit] [Delete]     │
└───────────────────────┘
```

## Add Knowledge Dialog

The **[+]** button opens the `AddKnowledgeDialog`.

### Dialog Layout

```
┌────────────────────────────────┐
│ New Document                [X] │
├────────────────────────────────┤
│ Title                           │
│ ┌──────────────────────────┐    │
│ │ Project Architecture     │    │
│ └──────────────────────────┘    │
│ Category                        │
│ ┌──────────────────────────┐    │
│ │ Specs                  ▼ │    │
│ └──────────────────────────┘    │
│ Tags (comma-separated)          │
│ ┌──────────────────────────┐    │
│ │ architecture, frontend   │    │
│ └──────────────────────────┘    │
│ Content                         │
│ ┌──────────────────────────┐    │
│ │                          │    │
│ │ The application follows  │    │
│ │ a three-layer arch...    │    │
│ │                          │    │
│ │                          │    │
│ │                          │    │
│ │                          │    │
│ │                          │    │
│ └──────────────────────────┘    │
│ Projects                        │
│ ☑ my-app                       │
│ ☐ api-server                   │
│ ☐ infra                        │
│ Agents                          │
│ ☑ Koda                         │
│ ☑ Flux                         │
│ ☐ Vex                          │
│ ☐ Nova                         │
├────────────────────────────────┤
│             [Cancel] [Create]   │
└────────────────────────────────┘
```

### Dialog Fields

| Field | Component | Validation |
|-------|-----------|------------|
| Title | `Input` | Required, 1–128 chars |
| Category | `Select` | Required, one of notes/references/specs/guidelines |
| Tags | `Input` | Optional, comma-separated, cleaned + lowercased |
| Content | `textarea` (8 rows) | Required, 1–65536 chars |
| Projects | `Checkbox` list | Optional, from projectStore |
| Agents | `Checkbox` list | Optional, from agentStore (excludes secretary) |

### Dialog Width

`sm:max-w-[600px]`

### Tag Parsing

The tags input accepts comma-separated values. On submit, the string is:
1. Split by commas.
2. Each value trimmed of whitespace.
3. Converted to lowercase.
4. Empty strings removed.
5. Duplicates removed.

## Empty State

```
┌───────────────────────┐
│ KNOWLEDGE   [+] [...]  │
├───────────────────────┤
│                        │
│  No documents yet.     │
│  Click + to create a   │
│  knowledge document.   │
│                        │
└───────────────────────┘
```

## Components

### KnowledgeTab

Top-level container. Manages list/detail mode, search state, and dialog visibility.

### KnowledgeCard

Renders a single document in list mode with tag badges and context menu.

```typescript
interface KnowledgeCardProps {
  document: KnowledgeDocument;
  onSelect: (id: string) => void;
  onEdit: (doc: KnowledgeDocument) => void;
  onDuplicate: (doc: KnowledgeDocument) => void;
  onDelete: (id: string) => void;
}
```

### KnowledgeDetailPanel

Renders the full document view with metadata, content, and action buttons.

```typescript
interface KnowledgeDetailPanelProps {
  document: KnowledgeDocument;
  onBack: () => void;
  onEdit: (doc: KnowledgeDocument) => void;
  onDelete: (id: string) => void;
}
```

### AddKnowledgeDialog

Modal form for creating and editing documents.

```typescript
interface AddKnowledgeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editDocument?: KnowledgeDocument | null;
}
```

## shadcn/ui Usage

| Component | Usage |
|-----------|-------|
| `ScrollArea` | Wraps document list and detail content |
| `Badge` | Category, tag, project, and agent badges |
| `Button` | [+], Back, Edit, Delete, dialog actions |
| `Dialog` | Document creation/edit modal |
| `DropdownMenu` | Card context menu, header more menu |
| `Input` | Title, tags, search fields |
| `Select` | Category dropdown |
| `Checkbox` | Project and agent multi-select |
| `Label` | Form field labels |
| `Separator` | Between category groups, between metadata and content |

## References

- [Knowledge Base Specification](../02-specifications/knowledge-base.md)
- [Left Sidebar -- Projects](sidebar-left-projects.md)
- [Design System](design-system.md)
- [Themes](themes.md)
