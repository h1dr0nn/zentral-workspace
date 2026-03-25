use rusqlite::{params, Connection};
use super::models::HistoryEventRow;

pub fn list(
    conn: &Connection,
    agent_id: Option<&str>,
    project_id: Option<&str>,
    event_type: Option<&str>,
    status: Option<&str>,
    limit: i64,
    offset: i64,
) -> Result<Vec<HistoryEventRow>, rusqlite::Error> {
    let mut sql = String::from(
        "SELECT id, type, agent_id, project_id, skill_id, workflow_id, summary, details, status, duration, timestamp FROM history_events WHERE 1=1"
    );
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut idx = 1;

    if let Some(v) = agent_id {
        sql.push_str(&format!(" AND agent_id = ?{}", idx));
        param_values.push(Box::new(v.to_string()));
        idx += 1;
    }
    if let Some(v) = project_id {
        sql.push_str(&format!(" AND project_id = ?{}", idx));
        param_values.push(Box::new(v.to_string()));
        idx += 1;
    }
    if let Some(v) = event_type {
        sql.push_str(&format!(" AND type = ?{}", idx));
        param_values.push(Box::new(v.to_string()));
        idx += 1;
    }
    if let Some(v) = status {
        sql.push_str(&format!(" AND status = ?{}", idx));
        param_values.push(Box::new(v.to_string()));
        idx += 1;
    }

    sql.push_str(&format!(" ORDER BY timestamp DESC LIMIT ?{} OFFSET ?{}", idx, idx + 1));
    param_values.push(Box::new(limit));
    param_values.push(Box::new(offset));

    let refs: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|b| b.as_ref()).collect();
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(refs.as_slice(), |row| {
        Ok(HistoryEventRow {
            id: row.get(0)?,
            event_type: row.get(1)?,
            agent_id: row.get(2)?,
            project_id: row.get(3)?,
            skill_id: row.get(4)?,
            workflow_id: row.get(5)?,
            summary: row.get(6)?,
            details: row.get(7)?,
            status: row.get(8)?,
            duration: row.get(9)?,
            timestamp: row.get(10)?,
        })
    })?;
    rows.collect()
}

pub fn insert(conn: &Connection, e: &HistoryEventRow) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT OR IGNORE INTO history_events (id, type, agent_id, project_id, skill_id, workflow_id, summary, details, status, duration, timestamp) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![e.id, e.event_type, e.agent_id, e.project_id, e.skill_id, e.workflow_id, e.summary, e.details, e.status, e.duration, e.timestamp],
    )?;
    Ok(())
}

pub fn clear(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute("DELETE FROM history_events", [])?;
    Ok(())
}
