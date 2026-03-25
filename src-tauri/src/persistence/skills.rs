use rusqlite::{params, Connection};
use super::models::SkillRow;

pub fn list(conn: &Connection) -> Result<Vec<SkillRow>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, name, description, category, prompt, is_builtin FROM skills ORDER BY category, name"
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(SkillRow {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            category: row.get(3)?,
            prompt: row.get(4)?,
            is_builtin: row.get(5)?,
        })
    })?;
    rows.collect()
}

pub fn insert(conn: &Connection, s: &SkillRow) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT OR IGNORE INTO skills (id, name, description, category, prompt, is_builtin) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![s.id, s.name, s.description, s.category, s.prompt, s.is_builtin],
    )?;
    Ok(())
}

pub fn upsert(conn: &Connection, s: &SkillRow) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT INTO skills (id, name, description, category, prompt, is_builtin)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description, category = excluded.category, prompt = excluded.prompt, is_builtin = excluded.is_builtin",
        params![s.id, s.name, s.description, s.category, s.prompt, s.is_builtin],
    )?;
    Ok(())
}

pub fn update(conn: &Connection, s: &SkillRow) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE skills SET name = ?2, description = ?3, category = ?4, prompt = ?5 WHERE id = ?1",
        params![s.id, s.name, s.description, s.category, s.prompt],
    )?;
    Ok(())
}

pub fn delete(conn: &Connection, id: &str) -> Result<(), rusqlite::Error> {
    conn.execute("DELETE FROM skills WHERE id = ?1 AND is_builtin = 0", params![id])?;
    Ok(())
}
