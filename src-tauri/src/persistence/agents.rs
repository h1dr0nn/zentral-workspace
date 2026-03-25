use rusqlite::{params, Connection};
use super::models::AgentRow;

pub fn list(conn: &Connection) -> Result<Vec<AgentRow>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, name, role, status, skills, is_secretary, project_ids, is_builtin FROM agents ORDER BY is_secretary DESC, name ASC"
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(AgentRow {
            id: row.get(0)?,
            name: row.get(1)?,
            role: row.get(2)?,
            status: row.get(3)?,
            skills: row.get(4)?,
            is_secretary: row.get(5)?,
            project_ids: row.get(6)?,
            is_builtin: row.get(7)?,
        })
    })?;
    rows.collect()
}

pub fn get(conn: &Connection, id: &str) -> Result<Option<AgentRow>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, name, role, status, skills, is_secretary, project_ids, is_builtin FROM agents WHERE id = ?1"
    )?;
    let mut rows = stmt.query(params![id])?;
    match rows.next()? {
        Some(row) => Ok(Some(AgentRow {
            id: row.get(0)?,
            name: row.get(1)?,
            role: row.get(2)?,
            status: row.get(3)?,
            skills: row.get(4)?,
            is_secretary: row.get(5)?,
            project_ids: row.get(6)?,
            is_builtin: row.get(7)?,
        })),
        None => Ok(None),
    }
}

pub fn insert(conn: &Connection, a: &AgentRow) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT OR IGNORE INTO agents (id, name, role, status, skills, is_secretary, project_ids, is_builtin) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![a.id, a.name, a.role, a.status, a.skills, a.is_secretary, a.project_ids, a.is_builtin],
    )?;
    Ok(())
}

pub fn update(conn: &Connection, a: &AgentRow) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE agents SET name = ?2, role = ?3, status = ?4, skills = ?5, is_secretary = ?6, project_ids = ?7, is_builtin = ?8 WHERE id = ?1",
        params![a.id, a.name, a.role, a.status, a.skills, a.is_secretary, a.project_ids, a.is_builtin],
    )?;
    Ok(())
}

/// Upsert: insert if not exists, update if exists. Used for builtin seeding.
pub fn upsert(conn: &Connection, a: &AgentRow) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT INTO agents (id, name, role, status, skills, is_secretary, project_ids, is_builtin)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, role = excluded.role, skills = excluded.skills, is_secretary = excluded.is_secretary, is_builtin = excluded.is_builtin",
        params![a.id, a.name, a.role, a.status, a.skills, a.is_secretary, a.project_ids, a.is_builtin],
    )?;
    Ok(())
}

pub fn delete(conn: &Connection, id: &str) -> Result<(), rusqlite::Error> {
    conn.execute("DELETE FROM agents WHERE id = ?1 AND is_builtin = 0", params![id])?;
    Ok(())
}
