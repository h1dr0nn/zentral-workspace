-- Migration 002: Workflow execution tracking

CREATE TABLE IF NOT EXISTS workflow_runs (
    id           TEXT PRIMARY KEY,
    workflow_id  TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    status       TEXT NOT NULL DEFAULT 'running',
    current_step TEXT,
    started_at   TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_wf ON workflow_runs(workflow_id);

CREATE TABLE IF NOT EXISTS workflow_step_results (
    id           TEXT PRIMARY KEY,
    run_id       TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
    step_id      TEXT NOT NULL,
    agent_id     TEXT NOT NULL,
    skill_id     TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'running',
    output       TEXT,
    duration_ms  INTEGER,
    started_at   TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_step_results_run ON workflow_step_results(run_id);
