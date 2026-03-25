use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowRunRow {
    pub id: String,
    pub workflow_id: String,
    pub status: String,
    pub current_step: Option<String>,
    pub started_at: String,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StepResultRow {
    pub id: String,
    pub run_id: String,
    pub step_id: String,
    pub agent_id: String,
    pub skill_id: String,
    pub status: String,
    pub output: Option<String>,
    pub duration_ms: Option<i64>,
    pub started_at: String,
    pub completed_at: Option<String>,
}

// ── Workflow Runs ──

pub fn insert_run(conn: &Connection, r: &WorkflowRunRow) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT INTO workflow_runs (id, workflow_id, status, current_step, started_at, completed_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![r.id, r.workflow_id, r.status, r.current_step, r.started_at, r.completed_at],
    )?;
    Ok(())
}

pub fn update_run(conn: &Connection, r: &WorkflowRunRow) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE workflow_runs SET status = ?2, current_step = ?3, completed_at = ?4 WHERE id = ?1",
        params![r.id, r.status, r.current_step, r.completed_at],
    )?;
    Ok(())
}

pub fn get_run(conn: &Connection, id: &str) -> Result<Option<WorkflowRunRow>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, workflow_id, status, current_step, started_at, completed_at FROM workflow_runs WHERE id = ?1"
    )?;
    let mut rows = stmt.query(params![id])?;
    match rows.next()? {
        Some(row) => Ok(Some(WorkflowRunRow {
            id: row.get(0)?,
            workflow_id: row.get(1)?,
            status: row.get(2)?,
            current_step: row.get(3)?,
            started_at: row.get(4)?,
            completed_at: row.get(5)?,
        })),
        None => Ok(None),
    }
}

pub fn get_active_run(conn: &Connection, workflow_id: &str) -> Result<Option<WorkflowRunRow>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, workflow_id, status, current_step, started_at, completed_at FROM workflow_runs WHERE workflow_id = ?1 AND status = 'running' LIMIT 1"
    )?;
    let mut rows = stmt.query(params![workflow_id])?;
    match rows.next()? {
        Some(row) => Ok(Some(WorkflowRunRow {
            id: row.get(0)?,
            workflow_id: row.get(1)?,
            status: row.get(2)?,
            current_step: row.get(3)?,
            started_at: row.get(4)?,
            completed_at: row.get(5)?,
        })),
        None => Ok(None),
    }
}

// ── Step Results ──

pub fn insert_step_result(conn: &Connection, r: &StepResultRow) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT INTO workflow_step_results (id, run_id, step_id, agent_id, skill_id, status, output, duration_ms, started_at, completed_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![r.id, r.run_id, r.step_id, r.agent_id, r.skill_id, r.status, r.output, r.duration_ms, r.started_at, r.completed_at],
    )?;
    Ok(())
}

pub fn update_step_result(conn: &Connection, r: &StepResultRow) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE workflow_step_results SET status = ?2, output = ?3, duration_ms = ?4, completed_at = ?5 WHERE id = ?1",
        params![r.id, r.status, r.output, r.duration_ms, r.completed_at],
    )?;
    Ok(())
}

pub fn list_step_results(conn: &Connection, run_id: &str) -> Result<Vec<StepResultRow>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, run_id, step_id, agent_id, skill_id, status, output, duration_ms, started_at, completed_at FROM workflow_step_results WHERE run_id = ?1 ORDER BY started_at ASC"
    )?;
    let rows = stmt.query_map(params![run_id], |row| {
        Ok(StepResultRow {
            id: row.get(0)?,
            run_id: row.get(1)?,
            step_id: row.get(2)?,
            agent_id: row.get(3)?,
            skill_id: row.get(4)?,
            status: row.get(5)?,
            output: row.get(6)?,
            duration_ms: row.get(7)?,
            started_at: row.get(8)?,
            completed_at: row.get(9)?,
        })
    })?;
    rows.collect()
}
