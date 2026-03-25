# Knowledge Base

> Shared document repository that provides persistent context to agents, organized by category with project and agent linking.

> **Status:** draft
> **Last updated:** 2026-03-25

---

## Overview

The Knowledge Base is a structured collection of documents that agents can reference when executing tasks. Each document has a title, content, category, tags, and optional links to projects and agents. When an agent is spawned, relevant knowledge documents are injected into its context, giving it access to project conventions, API references, meeting notes, and other persistent information.

Unlike chat messages (ephemeral, per-conversation) or skills (behavioral instructions), knowledge documents represent factual context — the "what" rather than the "how".

```
+--------------------+       +--------------------+       +--------------------+
|  Knowledge Docs    |       |  doc_projects      |       |    Projects        |
|                    | 1---N |  (junction)         | N---1 |                    |
|  id                |------>|  doc_id            |<------|  id                |
|  title             |       |  project_id        |       |  name              |
|  content           |       +--------------------+       +--------------------+
|  category          |
|  tags              |       +--------------------+       +--------------------+
|  created_at        | 1---N |  doc_agents        | N---1 |    Agents          |
|  updated_at        |------>|  doc_id            |<------|  id                |
+--------------------+       |  agent_id          |       |  name              |
                             +--------------------+       +--------------------+
```

---

## KnowledgeDocument Struct

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeDocument {
    /// Unique identifier (UUID v4).
    pub id: String,
    /// Document title.
    pub title: String,
    /// Document content in plain text (Markdown support planned).
    pub content: String,
    /// Organizational category.
    pub category: KnowledgeCategory,
    /// Free-form tags for search and filtering.
    pub tags: Vec<String>,
    /// Projects this document is relevant to.
    pub project_ids: Vec<String>,
    /// Agents that should receive this document as context.
    pub agent_ids: Vec<String>,
    /// ISO 8601 creation timestamp.
    pub created_at: String,
    /// ISO 8601 last modification timestamp.
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum KnowledgeCategory {
    Notes,       // Meeting notes, brainstorming, scratch
    References,  // API docs, external links, lookup tables
    Specs,       // Technical specifications, architecture decisions
    Guidelines,  // Coding conventions, style guides, processes
}
```

### Validation Rules

| Field       | Constraint                                                  |
|-------------|-------------------------------------------------------------|
| title       | 1–128 characters, free text                                 |
| content     | 1–65536 characters (64 KB limit for initial implementation) |
| category    | One of `notes`, `references`, `specs`, `guidelines`         |
| tags        | 0–20 tags, each 1–32 characters, lowercase alphanumeric + hyphens |
| project_ids | Each must reference an existing project                     |
| agent_ids   | Each must reference an existing agent                       |

---

## Categories

Documents are organized into four categories that reflect their purpose:

| Category     | Purpose                                      | Examples                                      |
|--------------|----------------------------------------------|-----------------------------------------------|
| Notes        | Informal, temporal documents                 | Meeting notes, brainstorming sessions, TODOs  |
| References   | Lookup material                              | API endpoint tables, config references, links |
| Specs        | Formal technical documents                   | Architecture decisions, data models, schemas  |
| Guidelines   | Process and convention documents             | Git conventions, code style, review checklists|

Categories serve as the primary grouping in the sidebar UI and as a filter dimension.

---

## Agent Context Injection

When an agent is spawned, the system queries the knowledge base for documents relevant to the agent's current context:

### Relevance Criteria

A document is considered relevant to an agent if any of the following are true:

1. The document's `agent_ids` list includes the agent's ID.
2. The document's `project_ids` list includes the currently active project's ID.
3. The document's category is `guidelines` (guidelines apply globally).

### Injection Format

Relevant documents are injected into the agent's system prompt as a structured context block:

```
## Knowledge Base Context

### [Specs] Project Architecture
Tags: architecture, frontend
---
The application follows a three-layer architecture:
- Presentation: React components with Zustand state
- Bridge: Tauri IPC commands
- Core: Rust backend modules
---

### [Guidelines] Git Conventions
Tags: git, workflow
---
- Branch naming: feature/*, bugfix/*, chore/*
- Commit messages: conventional commits format
- PR titles: max 72 characters
---
```

### Context Budget

To avoid consuming too much of the agent's context window, knowledge injection is budgeted:

| Constraint           | Limit    |
|----------------------|----------|
| Max documents        | 10       |
| Max total characters | 16,384   |
| Priority order       | 1. Agent-linked, 2. Project-linked, 3. Global guidelines |

If the total content exceeds the character budget, documents are truncated from the lowest priority. A "[truncated]" marker is appended.

---

## SQLite Schema

```sql
CREATE TABLE IF NOT EXISTS knowledge_documents (
    id         TEXT PRIMARY KEY,
    title      TEXT NOT NULL,
    content    TEXT NOT NULL,
    category   TEXT NOT NULL DEFAULT 'notes',
    tags       TEXT NOT NULL DEFAULT '[]',   -- JSON array of strings
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS knowledge_doc_projects (
    doc_id     TEXT NOT NULL,
    project_id TEXT NOT NULL,
    PRIMARY KEY (doc_id, project_id),
    FOREIGN KEY (doc_id) REFERENCES knowledge_documents (id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS knowledge_doc_agents (
    doc_id   TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    PRIMARY KEY (doc_id, agent_id),
    FOREIGN KEY (doc_id) REFERENCES knowledge_documents (id) ON DELETE CASCADE,
    FOREIGN KEY (agent_id) REFERENCES agents (id) ON DELETE CASCADE
);

CREATE INDEX idx_knowledge_category ON knowledge_documents (category);
CREATE INDEX idx_knowledge_updated ON knowledge_documents (updated_at DESC);
```

### Notes on Schema Design

- `tags` is stored as a JSON array string. SQLite's `json_each()` function enables querying by individual tags when needed.
- Junction tables `knowledge_doc_projects` and `knowledge_doc_agents` use CASCADE on both sides — deleting a document, project, or agent cleans up the links.
- `updated_at` is indexed for "recently updated" sorting in the UI.

---

## IPC Commands

### list_knowledge_documents

Returns all documents, optionally filtered by category or project.

```rust
#[tauri::command]
pub async fn list_knowledge_documents(
    state: tauri::State<'_, AppState>,
    category: Option<String>,
    project_id: Option<String>,
) -> Result<Vec<KnowledgeDocument>, String> { ... }
```

### get_knowledge_document

Returns a single document by ID with full content.

```rust
#[tauri::command]
pub async fn get_knowledge_document(
    state: tauri::State<'_, AppState>,
    doc_id: String,
) -> Result<KnowledgeDocument, String> { ... }
```

### create_knowledge_document

Creates a new document with optional project and agent links.

```rust
#[tauri::command]
pub async fn create_knowledge_document(
    state: tauri::State<'_, AppState>,
    title: String,
    content: String,
    category: String,
    tags: Vec<String>,
    project_ids: Vec<String>,
    agent_ids: Vec<String>,
) -> Result<KnowledgeDocument, String> { ... }
```

### update_knowledge_document

Updates document fields. Replaces project and agent links entirely (not additive).

```rust
#[tauri::command]
pub async fn update_knowledge_document(
    state: tauri::State<'_, AppState>,
    doc_id: String,
    patch: KnowledgeDocumentPatch,
) -> Result<KnowledgeDocument, String> { ... }
```

### delete_knowledge_document

Deletes a document and all its links.

```rust
#[tauri::command]
pub async fn delete_knowledge_document(
    state: tauri::State<'_, AppState>,
    doc_id: String,
) -> Result<(), String> { ... }
```

### get_agent_knowledge

Returns documents relevant to a specific agent in a specific project context. Used internally during agent spawning for context injection.

```rust
pub fn get_agent_knowledge(
    conn: &rusqlite::Connection,
    agent_id: &str,
    project_id: &str,
) -> Result<Vec<KnowledgeDocument>, rusqlite::Error> {
    // Returns documents where:
    // 1. agent_id is in doc_agents, OR
    // 2. project_id is in doc_projects, OR
    // 3. category = 'guidelines'
    // Ordered by: agent-linked first, then project-linked, then global
    // Limited to 10 documents, 16384 total characters
    ...
}
```

### Command Registration

```rust
tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
        list_knowledge_documents,
        get_knowledge_document,
        create_knowledge_document,
        update_knowledge_document,
        delete_knowledge_document,
    ])
```

---

## Zustand Store

```typescript
import { create } from "zustand";

export type KnowledgeCategory = "notes" | "references" | "specs" | "guidelines";

export interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  category: KnowledgeCategory;
  tags: string[];
  projectIds: string[];
  agentIds: string[];
  createdAt: string;
  updatedAt: string;
}

interface KnowledgeStore {
  documents: KnowledgeDocument[];
  activeDocumentId: string | null;
  addDocument: (doc: Omit<KnowledgeDocument, "id" | "createdAt" | "updatedAt">) => void;
  removeDocument: (id: string) => void;
  updateDocument: (id: string, patch: Partial<KnowledgeDocument>) => void;
  setActiveDocument: (id: string | null) => void;
}
```

---

## Future Enhancements

| Enhancement              | Description                                                       |
|--------------------------|-------------------------------------------------------------------|
| Markdown rendering       | Render document content as Markdown in the detail panel           |
| File attachments         | Attach PDFs, images, and other files to documents                 |
| Full-text search         | SQLite FTS5 for fast search across document content               |
| Version history          | Track changes to documents over time                              |
| Import/export            | Import Markdown files, export documents as Markdown or JSON       |
| Semantic search          | Use embeddings for "find documents related to this task"          |

---

## References

- [Agent Manager](agent-manager.md) — context injection during agent spawning
- [Agent Spawner](agent-spawner.md) — system prompt construction
- [Skill Pool](skill-pool.md) — complementary context (skills = how, knowledge = what)
- [Persistence](persistence.md) — SQLite access patterns
- [Left Sidebar -- Knowledge](../03-ui-ux/sidebar-left-knowledge.md) — UI specification
