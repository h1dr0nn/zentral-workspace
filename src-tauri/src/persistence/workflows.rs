use rusqlite::{params, Connection};
use super::models::{WorkflowRow, WorkflowStepRow};

pub fn list(conn: &Connection) -> Result<Vec<WorkflowRow>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, name, description, project_id, status, created_at, last_run_at FROM workflows ORDER BY created_at DESC"
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(WorkflowRow {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            project_id: row.get(3)?,
            status: row.get(4)?,
            created_at: row.get(5)?,
            last_run_at: row.get(6)?,
        })
    })?;
    rows.collect()
}

pub fn insert(conn: &Connection, w: &WorkflowRow) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT OR IGNORE INTO workflows (id, name, description, project_id, status, created_at, last_run_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![w.id, w.name, w.description, w.project_id, w.status, w.created_at, w.last_run_at],
    )?;
    Ok(())
}

pub fn update(conn: &Connection, w: &WorkflowRow) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE workflows SET name = ?2, description = ?3, project_id = ?4, status = ?5, last_run_at = ?6 WHERE id = ?1",
        params![w.id, w.name, w.description, w.project_id, w.status, w.last_run_at],
    )?;
    Ok(())
}

pub fn delete(conn: &Connection, id: &str) -> Result<(), rusqlite::Error> {
    // workflow_steps cascade-deleted via FK
    conn.execute("DELETE FROM workflows WHERE id = ?1", params![id])?;
    Ok(())
}

// ── Steps ──

pub fn list_steps(conn: &Connection, workflow_id: &str) -> Result<Vec<WorkflowStepRow>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, workflow_id, agent_id, skill_id, label, step_order, on_success, on_failure FROM workflow_steps WHERE workflow_id = ?1 ORDER BY step_order ASC"
    )?;
    let rows = stmt.query_map(params![workflow_id], |row| {
        Ok(WorkflowStepRow {
            id: row.get(0)?,
            workflow_id: row.get(1)?,
            agent_id: row.get(2)?,
            skill_id: row.get(3)?,
            label: row.get(4)?,
            step_order: row.get(5)?,
            on_success: row.get(6)?,
            on_failure: row.get(7)?,
        })
    })?;
    rows.collect()
}

pub fn insert_step(conn: &Connection, s: &WorkflowStepRow) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT OR IGNORE INTO workflow_steps (id, workflow_id, agent_id, skill_id, label, step_order, on_success, on_failure) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![s.id, s.workflow_id, s.agent_id, s.skill_id, s.label, s.step_order, s.on_success, s.on_failure],
    )?;
    Ok(())
}

pub fn update_step(conn: &Connection, s: &WorkflowStepRow) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE workflow_steps SET agent_id = ?2, skill_id = ?3, label = ?4, step_order = ?5, on_success = ?6, on_failure = ?7 WHERE id = ?1",
        params![s.id, s.agent_id, s.skill_id, s.label, s.step_order, s.on_success, s.on_failure],
    )?;
    Ok(())
}

pub fn delete_step(conn: &Connection, id: &str) -> Result<(), rusqlite::Error> {
    conn.execute("DELETE FROM workflow_steps WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn reorder_steps(conn: &Connection, workflow_id: &str, step_ids: &[String]) -> Result<(), rusqlite::Error> {
    let tx = conn.unchecked_transaction()?;
    for (i, id) in step_ids.iter().enumerate() {
        tx.execute(
            "UPDATE workflow_steps SET step_order = ?1 WHERE id = ?2 AND workflow_id = ?3",
            params![i as i32, id, workflow_id],
        )?;
    }
    tx.commit()?;
    Ok(())
}

/// Replace all steps for a workflow (used during import).
pub fn replace_steps(conn: &Connection, workflow_id: &str, steps: &[WorkflowStepRow]) -> Result<(), rusqlite::Error> {
    let tx = conn.unchecked_transaction()?;
    tx.execute("DELETE FROM workflow_steps WHERE workflow_id = ?1", params![workflow_id])?;
    for s in steps {
        tx.execute(
            "INSERT INTO workflow_steps (id, workflow_id, agent_id, skill_id, label, step_order, on_success, on_failure) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![s.id, s.workflow_id, s.agent_id, s.skill_id, s.label, s.step_order, s.on_success, s.on_failure],
        )?;
    }
    tx.commit()?;
    Ok(())
}
