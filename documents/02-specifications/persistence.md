# Persistence Layer Specification

> SQLite-based persistence layer that stores all application data including agents, skills, projects, chat history, and settings in a single database file.

> **Status:** draft
> **Last updated:** 2026-03-24

---

## Overview

Every piece of long-lived state -- agents, skills, projects, chat history, and user settings -- lives in one SQLite file. A single database simplifies backups (copy one file), avoids format-conversion bugs, and gives every query the full power of SQL indexes and transactions.

## Database Location

The database file is created on first launch at the path returned by the Tauri path resolver:

```
<app_data_dir>/zentral.db
```

On each platform this resolves to:

| Platform | Typical path |
|----------|-------------|
| Linux | `~/.local/share/com.zentral.app/zentral.db` |
| macOS | `~/Library/Application Support/com.zentral.app/zentral.db` |
| Windows | `%APPDATA%/com.zentral.app/zentral.db` |

The directory is created automatically by Tauri. The database file is created by `rusqlite` when the connection is opened with `Connection::open`.

## Connection Management

A single connection is wrapped in `Arc<Mutex<rusqlite::Connection>>` and registered as Tauri managed state. Every command handler receives it via dependency injection.

```rust
use std::sync::{Arc, Mutex};
use rusqlite::Connection;
use tauri::Manager;

pub struct DbState(pub Arc<Mutex<Connection>>);

pub fn init_db(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let data_dir = app
        .path()
        .app_data_dir()
        .expect("failed to resolve app data dir");
    std::fs::create_dir_all(&data_dir)?;

    let db_path = data_dir.join("zentral.db");
    let conn = Connection::open(&db_path)?;

    // Enable WAL mode for concurrent reads while a write is in progress.
    conn.execute_batch("PRAGMA journal_mode = WAL;")?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;

    run_migrations(&conn)?;

    app.manage(DbState(Arc::new(Mutex::new(conn))));
    Ok(())
}
```

WAL (Write-Ahead Logging) mode allows the frontend to fire multiple read commands without blocking on a concurrent write. Because Tauri command handlers run on a thread pool, this avoids the most common source of "database is locked" errors.

## Schema

### Agents

```sql
CREATE TABLE agents (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT '',
    session_id  TEXT,
    status      TEXT NOT NULL DEFAULT 'stopped',
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
);
```

`id` is a UUID v4 string. `status` is one of `stopped`, `running`, `error`. Timestamps are Unix epoch seconds.

### Skills

```sql
CREATE TABLE skills (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    category    TEXT NOT NULL DEFAULT 'general',
    is_builtin  INTEGER NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL
);
```

Built-in skills (`is_builtin = 1`) are seeded by the migration runner and cannot be deleted through the UI.

### Agent-Skill Junction

```sql
CREATE TABLE agent_skills (
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    PRIMARY KEY (agent_id, skill_id)
);
```

A many-to-many relationship. Deleting an agent or skill cascades to remove the junction rows.

### Projects

```sql
CREATE TABLE projects (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    path        TEXT NOT NULL UNIQUE,
    created_at  INTEGER NOT NULL,
    last_opened INTEGER NOT NULL
);
```

`path` is the absolute filesystem path to the project root. The UNIQUE constraint prevents duplicate registrations of the same directory.

### Chat Messages

```sql
CREATE TABLE chat_messages (
    id        TEXT PRIMARY KEY,
    agent_id  TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    role      TEXT NOT NULL,
    content   TEXT NOT NULL,
    source    TEXT NOT NULL DEFAULT 'app',
    timestamp INTEGER NOT NULL
);
```

`role` is one of `user`, `assistant`, `system`. `source` distinguishes messages originating from the desktop app (`app`) versus the Telegram bridge (`telegram`).

### Settings

```sql
CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

All values are stored as text. Callers parse to the expected type (integer, boolean, JSON array) on read.

## Indexes

```sql
CREATE INDEX idx_chat_messages_agent_id
    ON chat_messages(agent_id);

CREATE INDEX idx_chat_messages_timestamp
    ON chat_messages(timestamp);

CREATE INDEX idx_agents_status
    ON agents(status);

CREATE INDEX idx_projects_last_opened
    ON projects(last_opened DESC);

CREATE INDEX idx_skills_category
    ON skills(category);

CREATE INDEX idx_agent_skills_skill_id
    ON agent_skills(skill_id);
```

| Index | Rationale |
|-------|-----------|
| `idx_chat_messages_agent_id` | Chat history is almost always filtered by agent. |
| `idx_chat_messages_timestamp` | Pagination and retention-policy deletes scan by time. |
| `idx_agents_status` | Dashboard filters agents by running/stopped/error. |
| `idx_projects_last_opened` | "Recent projects" list sorts by last opened descending. |
| `idx_skills_category` | Skill browser groups by category. |
| `idx_agent_skills_skill_id` | Reverse lookup: "which agents have this skill?" |

## Migration Strategy

Migrations are embedded in the binary as numbered SQL strings. A version table tracks which migrations have been applied.

```sql
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at INTEGER NOT NULL
);
```

On every app start the migration runner executes all pending migrations inside a transaction.

```rust
struct Migration {
    version: i64,
    sql: &'static str,
}

const MIGRATIONS: &[Migration] = &[
    Migration {
        version: 1,
        sql: include_str!("../migrations/001_initial.sql"),
    },
    // Future migrations are appended here.
];

pub fn run_migrations(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_version (
            version    INTEGER PRIMARY KEY,
            applied_at INTEGER NOT NULL
        );"
    )?;

    let current: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_version",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    for m in MIGRATIONS {
        if m.version > current {
            let tx = conn.transaction()?;
            tx.execute_batch(m.sql)?;
            tx.execute(
                "INSERT INTO schema_version (version, applied_at) VALUES (?1, ?2)",
                rusqlite::params![m.version, epoch_secs()],
            )?;
            tx.commit()?;
        }
    }

    Ok(())
}

fn epoch_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64
}
```

Rules for writing migrations:

- Never modify a migration that has already been released.
- Each migration file is a sequence of SQL statements ending with semicolons.
- Destructive changes (DROP COLUMN, DROP TABLE) require a two-step migration: first deprecate, then remove in the next release.

## CRUD Operations

All functions accept a `&Connection` reference obtained by locking the `DbState` mutex.

### Agents

```rust
use rusqlite::{params, Connection, Result};

pub fn insert_agent(conn: &Connection, agent: &Agent) -> Result<()> {
    conn.execute(
        "INSERT INTO agents (id, name, role, session_id, status, created_at, updated_at)
         VALUES (:id, :name, :role, :session_id, :status, :created_at, :updated_at)",
        rusqlite::named_params! {
            ":id": agent.id,
            ":name": agent.name,
            ":role": agent.role,
            ":session_id": agent.session_id,
            ":status": agent.status,
            ":created_at": agent.created_at,
            ":updated_at": agent.updated_at,
        },
    )?;
    Ok(())
}

pub fn get_agent_by_id(conn: &Connection, id: &str) -> Result<Option<Agent>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, role, session_id, status, created_at, updated_at
         FROM agents WHERE id = :id"
    )?;
    let mut rows = stmt.query(rusqlite::named_params! { ":id": id })?;
    match rows.next()? {
        Some(row) => Ok(Some(Agent {
            id: row.get(0)?,
            name: row.get(1)?,
            role: row.get(2)?,
            session_id: row.get(3)?,
            status: row.get(4)?,
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
        })),
        None => Ok(None),
    }
}

pub fn list_agents(conn: &Connection) -> Result<Vec<Agent>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, role, session_id, status, created_at, updated_at
         FROM agents ORDER BY created_at DESC"
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Agent {
            id: row.get(0)?,
            name: row.get(1)?,
            role: row.get(2)?,
            session_id: row.get(3)?,
            status: row.get(4)?,
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
        })
    })?;
    rows.collect()
}

pub fn update_agent(conn: &Connection, agent: &Agent) -> Result<usize> {
    conn.execute(
        "UPDATE agents
         SET name = :name, role = :role, session_id = :session_id,
             status = :status, updated_at = :updated_at
         WHERE id = :id",
        rusqlite::named_params! {
            ":id": agent.id,
            ":name": agent.name,
            ":role": agent.role,
            ":session_id": agent.session_id,
            ":status": agent.status,
            ":updated_at": agent.updated_at,
        },
    )
}

pub fn delete_agent(conn: &Connection, id: &str) -> Result<usize> {
    conn.execute(
        "DELETE FROM agents WHERE id = :id",
        rusqlite::named_params! { ":id": id },
    )
}
```

### Skills

```rust
pub fn insert_skill(conn: &Connection, skill: &Skill) -> Result<()> {
    conn.execute(
        "INSERT INTO skills (id, name, description, category, is_builtin, created_at)
         VALUES (:id, :name, :description, :category, :is_builtin, :created_at)",
        rusqlite::named_params! {
            ":id": skill.id,
            ":name": skill.name,
            ":description": skill.description,
            ":category": skill.category,
            ":is_builtin": skill.is_builtin,
            ":created_at": skill.created_at,
        },
    )?;
    Ok(())
}

pub fn get_skill_by_id(conn: &Connection, id: &str) -> Result<Option<Skill>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, description, category, is_builtin, created_at
         FROM skills WHERE id = :id"
    )?;
    let mut rows = stmt.query(rusqlite::named_params! { ":id": id })?;
    match rows.next()? {
        Some(row) => Ok(Some(Skill {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            category: row.get(3)?,
            is_builtin: row.get(4)?,
            created_at: row.get(5)?,
        })),
        None => Ok(None),
    }
}

pub fn list_skills(conn: &Connection) -> Result<Vec<Skill>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, description, category, is_builtin, created_at
         FROM skills ORDER BY category, name"
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Skill {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            category: row.get(3)?,
            is_builtin: row.get(4)?,
            created_at: row.get(5)?,
        })
    })?;
    rows.collect()
}

pub fn update_skill(conn: &Connection, skill: &Skill) -> Result<usize> {
    conn.execute(
        "UPDATE skills
         SET name = :name, description = :description,
             category = :category
         WHERE id = :id AND is_builtin = 0",
        rusqlite::named_params! {
            ":id": skill.id,
            ":name": skill.name,
            ":description": skill.description,
            ":category": skill.category,
        },
    )
}

pub fn delete_skill(conn: &Connection, id: &str) -> Result<usize> {
    conn.execute(
        "DELETE FROM skills WHERE id = :id AND is_builtin = 0",
        rusqlite::named_params! { ":id": id },
    )
}
```

### Agent-Skill Junction

```rust
pub fn assign_skill(conn: &Connection, agent_id: &str, skill_id: &str) -> Result<()> {
    conn.execute(
        "INSERT OR IGNORE INTO agent_skills (agent_id, skill_id)
         VALUES (:agent_id, :skill_id)",
        rusqlite::named_params! {
            ":agent_id": agent_id,
            ":skill_id": skill_id,
        },
    )?;
    Ok(())
}

pub fn revoke_skill(conn: &Connection, agent_id: &str, skill_id: &str) -> Result<usize> {
    conn.execute(
        "DELETE FROM agent_skills WHERE agent_id = :agent_id AND skill_id = :skill_id",
        rusqlite::named_params! {
            ":agent_id": agent_id,
            ":skill_id": skill_id,
        },
    )
}

pub fn list_skills_for_agent(conn: &Connection, agent_id: &str) -> Result<Vec<Skill>> {
    let mut stmt = conn.prepare(
        "SELECT s.id, s.name, s.description, s.category, s.is_builtin, s.created_at
         FROM skills s
         INNER JOIN agent_skills a_s ON a_s.skill_id = s.id
         WHERE a_s.agent_id = :agent_id
         ORDER BY s.name"
    )?;
    let rows = stmt.query_map(
        rusqlite::named_params! { ":agent_id": agent_id },
        |row| {
            Ok(Skill {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                category: row.get(3)?,
                is_builtin: row.get(4)?,
                created_at: row.get(5)?,
            })
        },
    )?;
    rows.collect()
}

pub fn list_agents_for_skill(conn: &Connection, skill_id: &str) -> Result<Vec<Agent>> {
    let mut stmt = conn.prepare(
        "SELECT a.id, a.name, a.role, a.session_id, a.status, a.created_at, a.updated_at
         FROM agents a
         INNER JOIN agent_skills a_s ON a_s.agent_id = a.id
         WHERE a_s.skill_id = :skill_id
         ORDER BY a.name"
    )?;
    let rows = stmt.query_map(
        rusqlite::named_params! { ":skill_id": skill_id },
        |row| {
            Ok(Agent {
                id: row.get(0)?,
                name: row.get(1)?,
                role: row.get(2)?,
                session_id: row.get(3)?,
                status: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        },
    )?;
    rows.collect()
}
```

### Projects

```rust
pub fn insert_project(conn: &Connection, project: &Project) -> Result<()> {
    conn.execute(
        "INSERT INTO projects (id, name, path, created_at, last_opened)
         VALUES (:id, :name, :path, :created_at, :last_opened)",
        rusqlite::named_params! {
            ":id": project.id,
            ":name": project.name,
            ":path": project.path,
            ":created_at": project.created_at,
            ":last_opened": project.last_opened,
        },
    )?;
    Ok(())
}

pub fn get_project_by_id(conn: &Connection, id: &str) -> Result<Option<Project>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, path, created_at, last_opened
         FROM projects WHERE id = :id"
    )?;
    let mut rows = stmt.query(rusqlite::named_params! { ":id": id })?;
    match rows.next()? {
        Some(row) => Ok(Some(Project {
            id: row.get(0)?,
            name: row.get(1)?,
            path: row.get(2)?,
            created_at: row.get(3)?,
            last_opened: row.get(4)?,
        })),
        None => Ok(None),
    }
}

pub fn list_projects(conn: &Connection) -> Result<Vec<Project>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, path, created_at, last_opened
         FROM projects ORDER BY last_opened DESC"
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Project {
            id: row.get(0)?,
            name: row.get(1)?,
            path: row.get(2)?,
            created_at: row.get(3)?,
            last_opened: row.get(4)?,
        })
    })?;
    rows.collect()
}

pub fn update_project(conn: &Connection, project: &Project) -> Result<usize> {
    conn.execute(
        "UPDATE projects
         SET name = :name, path = :path, last_opened = :last_opened
         WHERE id = :id",
        rusqlite::named_params! {
            ":id": project.id,
            ":name": project.name,
            ":path": project.path,
            ":last_opened": project.last_opened,
        },
    )
}

pub fn delete_project(conn: &Connection, id: &str) -> Result<usize> {
    conn.execute(
        "DELETE FROM projects WHERE id = :id",
        rusqlite::named_params! { ":id": id },
    )
}
```

### Chat Messages

```rust
pub fn insert_message(conn: &Connection, msg: &ChatMessage) -> Result<()> {
    conn.execute(
        "INSERT INTO chat_messages (id, agent_id, role, content, source, timestamp)
         VALUES (:id, :agent_id, :role, :content, :source, :timestamp)",
        rusqlite::named_params! {
            ":id": msg.id,
            ":agent_id": msg.agent_id,
            ":role": msg.role,
            ":content": msg.content,
            ":source": msg.source,
            ":timestamp": msg.timestamp,
        },
    )?;
    Ok(())
}

pub fn get_message_by_id(conn: &Connection, id: &str) -> Result<Option<ChatMessage>> {
    let mut stmt = conn.prepare(
        "SELECT id, agent_id, role, content, source, timestamp
         FROM chat_messages WHERE id = :id"
    )?;
    let mut rows = stmt.query(rusqlite::named_params! { ":id": id })?;
    match rows.next()? {
        Some(row) => Ok(Some(ChatMessage {
            id: row.get(0)?,
            agent_id: row.get(1)?,
            role: row.get(2)?,
            content: row.get(3)?,
            source: row.get(4)?,
            timestamp: row.get(5)?,
        })),
        None => Ok(None),
    }
}

pub fn list_messages_for_agent(
    conn: &Connection,
    agent_id: &str,
    limit: i64,
    offset: i64,
) -> Result<Vec<ChatMessage>> {
    let mut stmt = conn.prepare(
        "SELECT id, agent_id, role, content, source, timestamp
         FROM chat_messages
         WHERE agent_id = :agent_id
         ORDER BY timestamp ASC
         LIMIT :limit OFFSET :offset"
    )?;
    let rows = stmt.query_map(
        rusqlite::named_params! {
            ":agent_id": agent_id,
            ":limit": limit,
            ":offset": offset,
        },
        |row| {
            Ok(ChatMessage {
                id: row.get(0)?,
                agent_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                source: row.get(4)?,
                timestamp: row.get(5)?,
            })
        },
    )?;
    rows.collect()
}

pub fn update_message(conn: &Connection, msg: &ChatMessage) -> Result<usize> {
    conn.execute(
        "UPDATE chat_messages SET content = :content WHERE id = :id",
        rusqlite::named_params! {
            ":id": msg.id,
            ":content": msg.content,
        },
    )
}

pub fn delete_message(conn: &Connection, id: &str) -> Result<usize> {
    conn.execute(
        "DELETE FROM chat_messages WHERE id = :id",
        rusqlite::named_params! { ":id": id },
    )
}
```

### Settings

```rust
pub fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<()> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (:key, :value)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        rusqlite::named_params! {
            ":key": key,
            ":value": value,
        },
    )?;
    Ok(())
}

pub fn get_setting(conn: &Connection, key: &str) -> Result<Option<String>> {
    let mut stmt = conn.prepare(
        "SELECT value FROM settings WHERE key = :key"
    )?;
    let mut rows = stmt.query(rusqlite::named_params! { ":key": key })?;
    match rows.next()? {
        Some(row) => Ok(Some(row.get(0)?)),
        None => Ok(None),
    }
}

pub fn list_settings(conn: &Connection) -> Result<Vec<(String, String)>> {
    let mut stmt = conn.prepare("SELECT key, value FROM settings ORDER BY key")?;
    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;
    rows.collect()
}

pub fn delete_setting(conn: &Connection, key: &str) -> Result<usize> {
    conn.execute(
        "DELETE FROM settings WHERE key = :key",
        rusqlite::named_params! { ":key": key },
    )
}
```

## Why SQLite Over JSONL

The Agentrooms project uses append-only JSONL files for persistence. Zentral chose SQLite instead for the following reasons.

| Aspect | SQLite | JSONL (Agentrooms) |
|--------|--------|--------------------|
| Queries | SQL with indexes | Read entire file |
| Concurrency | WAL mode | File locking issues |
| Atomicity | Transactions | Manual |
| Schema | Enforced | Freeform |
| Performance | O(log n) lookups | O(n) scan |
| Relations | Foreign keys, joins | Application-level |
| Tooling | DB Browser, sqlite3 CLI | Text editors |
| Backup | Single file copy | Copy all files |
| Size limit | Terabytes | Practical limit ~100 MB |

SQLite adds a compile-time dependency (`rusqlite` with the `bundled` feature) but eliminates an entire class of data-integrity bugs that JSONL cannot prevent.

## Settings Keys

The `settings` table stores application-wide configuration. Below are the recognized keys.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `theme` | string | `"dark"` | Active color theme name. |
| `font_size` | integer | `14` | Terminal and editor font size in pixels. |
| `font_family` | string | `"JetBrains Mono"` | Preferred monospace font. |
| `telegram_bot_token` | string | `""` | Telegram Bot API token. Empty disables the bridge. |
| `telegram_enabled` | boolean | `"false"` | Master toggle for the Telegram bridge. |
| `telegram_chat_ids` | JSON array | `"[]"` | Allowed Telegram chat IDs as a JSON array of integers. |
| `max_concurrent_agents` | integer | `"5"` | Maximum number of agents running simultaneously. |
| `default_shell` | string | `""` | Shell binary path. Empty means auto-detect. |
| `chat_retention_days` | integer | `"0"` | Days to keep chat messages. `0` means keep forever. |
| `editor_vim_mode` | boolean | `"false"` | Enable vim keybindings in text inputs. |

All values are stored as strings. The application layer is responsible for parsing and validation.

## Data Cleanup

### Chat History Retention

The `chat_retention_days` setting controls automatic cleanup. When set to a value greater than zero, a maintenance routine runs on app start and deletes messages older than the threshold.

```rust
pub fn cleanup_old_messages(conn: &Connection, retention_days: i64) -> Result<usize> {
    if retention_days <= 0 {
        return Ok(0);
    }
    let cutoff = epoch_secs() - (retention_days * 86400);
    conn.execute(
        "DELETE FROM chat_messages WHERE timestamp < :cutoff",
        rusqlite::named_params! { ":cutoff": cutoff },
    )
}
```

### Manual Cleanup

Two additional operations are exposed for user-initiated cleanup.

Clear all messages for a single agent:

```rust
pub fn clear_agent_history(conn: &Connection, agent_id: &str) -> Result<usize> {
    conn.execute(
        "DELETE FROM chat_messages WHERE agent_id = :agent_id",
        rusqlite::named_params! { ":agent_id": agent_id },
    )
}
```

Clear all chat history across every agent:

```rust
pub fn clear_all_history(conn: &Connection) -> Result<usize> {
    conn.execute("DELETE FROM chat_messages", [])
}
```

Both operations are guarded by a confirmation dialog in the frontend before the Tauri command is invoked.

### Data Flow Diagram

```
+-------------------+       invoke()        +------------------+
|  React Frontend   | -------------------->  |  Tauri Commands  |
|  (TypeScript)     | <--------------------  |  (Rust)          |
+-------------------+       response         +------------------+
                                                     |
                                              lock DbState mutex
                                                     |
                                                     v
                                             +---------------+
                                             |   rusqlite    |
                                             |  Connection   |
                                             +---------------+
                                                     |
                                                     v
                                             +---------------+
                                             |  zentral.db   |
                                             |  (SQLite WAL) |
                                             +---------------+
```

## References

- [agent-manager.md](./agent-manager.md) -- Agent lifecycle and state transitions
- [skill-pool.md](./skill-pool.md) -- Skill definitions and built-in skill catalog
- [project-workspace.md](./project-workspace.md) -- Project registration and workspace switching
- [telegram-bot.md](./telegram-bot.md) -- Telegram bridge and message routing
- [secretary-agent.md](./secretary-agent.md) -- Secretary agent orchestration
- [rusqlite documentation](https://docs.rs/rusqlite/latest/rusqlite/)
- [SQLite WAL mode](https://www.sqlite.org/wal.html)
