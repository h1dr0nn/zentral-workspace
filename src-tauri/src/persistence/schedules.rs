use rusqlite::{params, Connection};
use super::models::ScheduleRow;

pub fn list(conn: &Connection) -> Result<Vec<ScheduleRow>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, name, agent_id, skill_id, project_id, frequency, cron_expression, prompt, description, status, next_run_at, last_run_at, created_at FROM schedules ORDER BY created_at DESC"
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(ScheduleRow {
            id: row.get(0)?,
            name: row.get(1)?,
            agent_id: row.get(2)?,
            skill_id: row.get(3)?,
            project_id: row.get(4)?,
            frequency: row.get(5)?,
            cron_expression: row.get(6)?,
            prompt: row.get(7)?,
            description: row.get(8)?,
            status: row.get(9)?,
            next_run_at: row.get(10)?,
            last_run_at: row.get(11)?,
            created_at: row.get(12)?,
        })
    })?;
    rows.collect()
}

pub fn insert(conn: &Connection, s: &ScheduleRow) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT OR IGNORE INTO schedules (id, name, agent_id, skill_id, project_id, frequency, cron_expression, prompt, description, status, next_run_at, last_run_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        params![s.id, s.name, s.agent_id, s.skill_id, s.project_id, s.frequency, s.cron_expression, s.prompt, s.description, s.status, s.next_run_at, s.last_run_at, s.created_at],
    )?;
    Ok(())
}

pub fn update(conn: &Connection, s: &ScheduleRow) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE schedules SET name = ?2, agent_id = ?3, skill_id = ?4, project_id = ?5, frequency = ?6, cron_expression = ?7, prompt = ?8, description = ?9, status = ?10, next_run_at = ?11, last_run_at = ?12 WHERE id = ?1",
        params![s.id, s.name, s.agent_id, s.skill_id, s.project_id, s.frequency, s.cron_expression, s.prompt, s.description, s.status, s.next_run_at, s.last_run_at],
    )?;
    Ok(())
}

pub fn delete(conn: &Connection, id: &str) -> Result<(), rusqlite::Error> {
    conn.execute("DELETE FROM schedules WHERE id = ?1", params![id])?;
    Ok(())
}

/// Return schedules that are active and due (next_run_at <= now).
pub fn list_due(conn: &Connection, now: &str) -> Result<Vec<ScheduleRow>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, name, agent_id, skill_id, project_id, frequency, cron_expression, prompt, description, status, next_run_at, last_run_at, created_at FROM schedules WHERE status = 'active' AND next_run_at <= ?1"
    )?;
    let rows = stmt.query_map(params![now], |row| {
        Ok(ScheduleRow {
            id: row.get(0)?,
            name: row.get(1)?,
            agent_id: row.get(2)?,
            skill_id: row.get(3)?,
            project_id: row.get(4)?,
            frequency: row.get(5)?,
            cron_expression: row.get(6)?,
            prompt: row.get(7)?,
            description: row.get(8)?,
            status: row.get(9)?,
            next_run_at: row.get(10)?,
            last_run_at: row.get(11)?,
            created_at: row.get(12)?,
        })
    })?;
    rows.collect()
}
