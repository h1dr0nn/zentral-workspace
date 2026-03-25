-- Migration 001: Initial schema
-- All array fields stored as JSON text columns

CREATE TABLE IF NOT EXISTS projects (
    id             TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    path           TEXT NOT NULL,
    context_badges TEXT NOT NULL DEFAULT '[]',
    last_opened_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agents (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    role         TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'idle',
    skills       TEXT NOT NULL DEFAULT '[]',
    is_secretary INTEGER NOT NULL DEFAULT 0,
    project_ids  TEXT NOT NULL DEFAULT '[]',
    is_builtin   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS skills (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    category    TEXT NOT NULL DEFAULT '',
    prompt      TEXT NOT NULL DEFAULT '',
    is_builtin  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id        TEXT PRIMARY KEY,
    chat_key  TEXT NOT NULL,
    agent_id  TEXT NOT NULL,
    role      TEXT NOT NULL CHECK(role IN ('user', 'agent', 'system', 'delegation')),
    content   TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    source    TEXT DEFAULT 'local'
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_key ON chat_messages(chat_key);
CREATE INDEX IF NOT EXISTS idx_chat_messages_key_ts ON chat_messages(chat_key, timestamp);

CREATE TABLE IF NOT EXISTS schedules (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    agent_id        TEXT NOT NULL,
    skill_id        TEXT NOT NULL,
    project_id      TEXT,
    frequency       TEXT NOT NULL DEFAULT 'daily',
    cron_expression TEXT NOT NULL DEFAULT '',
    prompt          TEXT NOT NULL DEFAULT '',
    description     TEXT NOT NULL DEFAULT '',
    status          TEXT NOT NULL DEFAULT 'active',
    next_run_at     TEXT NOT NULL,
    last_run_at     TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS workflows (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    project_id  TEXT,
    status      TEXT NOT NULL DEFAULT 'draft',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    last_run_at TEXT
);

CREATE TABLE IF NOT EXISTS workflow_steps (
    id          TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    agent_id    TEXT NOT NULL,
    skill_id    TEXT NOT NULL,
    label       TEXT NOT NULL DEFAULT '',
    step_order  INTEGER NOT NULL DEFAULT 0,
    on_success  TEXT,
    on_failure  TEXT
);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_wf ON workflow_steps(workflow_id);

CREATE TABLE IF NOT EXISTS history_events (
    id          TEXT PRIMARY KEY,
    type        TEXT NOT NULL,
    agent_id    TEXT NOT NULL,
    project_id  TEXT,
    skill_id    TEXT,
    workflow_id TEXT,
    summary     TEXT NOT NULL,
    details     TEXT,
    status      TEXT NOT NULL DEFAULT 'running',
    duration    INTEGER,
    timestamp   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_history_ts ON history_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_history_agent ON history_events(agent_id);

CREATE TABLE IF NOT EXISTS knowledge_documents (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    content     TEXT NOT NULL DEFAULT '',
    category    TEXT NOT NULL DEFAULT 'notes',
    tags        TEXT NOT NULL DEFAULT '[]',
    project_ids TEXT NOT NULL DEFAULT '[]',
    agent_ids   TEXT NOT NULL DEFAULT '[]',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
