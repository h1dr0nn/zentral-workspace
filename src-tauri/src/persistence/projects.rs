use rusqlite::{params, Connection};
use super::models::ProjectRow;

pub fn list(conn: &Connection) -> Result<Vec<ProjectRow>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, name, path, context_badges, last_opened_at FROM projects ORDER BY last_opened_at DESC"
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(ProjectRow {
            id: row.get(0)?,
            name: row.get(1)?,
            path: row.get(2)?,
            context_badges: row.get(3)?,
            last_opened_at: row.get(4)?,
        })
    })?;
    rows.collect()
}

pub fn get(conn: &Connection, id: &str) -> Result<Option<ProjectRow>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, name, path, context_badges, last_opened_at FROM projects WHERE id = ?1"
    )?;
    let mut rows = stmt.query(params![id])?;
    match rows.next()? {
        Some(row) => Ok(Some(ProjectRow {
            id: row.get(0)?,
            name: row.get(1)?,
            path: row.get(2)?,
            context_badges: row.get(3)?,
            last_opened_at: row.get(4)?,
        })),
        None => Ok(None),
    }
}

pub fn insert(conn: &Connection, p: &ProjectRow) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT OR IGNORE INTO projects (id, name, path, context_badges, last_opened_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![p.id, p.name, p.path, p.context_badges, p.last_opened_at],
    )?;
    Ok(())
}

pub fn update(conn: &Connection, p: &ProjectRow) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE projects SET name = ?2, path = ?3, context_badges = ?4, last_opened_at = ?5 WHERE id = ?1",
        params![p.id, p.name, p.path, p.context_badges, p.last_opened_at],
    )?;
    Ok(())
}

pub fn delete(conn: &Connection, id: &str) -> Result<(), rusqlite::Error> {
    conn.execute("DELETE FROM projects WHERE id = ?1", params![id])?;
    Ok(())
}
