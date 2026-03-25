use rusqlite::{params, Connection};
use super::models::KnowledgeDocumentRow;

pub fn list(conn: &Connection) -> Result<Vec<KnowledgeDocumentRow>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, title, content, category, tags, project_ids, agent_ids, created_at, updated_at FROM knowledge_documents ORDER BY updated_at DESC"
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(KnowledgeDocumentRow {
            id: row.get(0)?,
            title: row.get(1)?,
            content: row.get(2)?,
            category: row.get(3)?,
            tags: row.get(4)?,
            project_ids: row.get(5)?,
            agent_ids: row.get(6)?,
            created_at: row.get(7)?,
            updated_at: row.get(8)?,
        })
    })?;
    rows.collect()
}

pub fn insert(conn: &Connection, d: &KnowledgeDocumentRow) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT OR IGNORE INTO knowledge_documents (id, title, content, category, tags, project_ids, agent_ids, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![d.id, d.title, d.content, d.category, d.tags, d.project_ids, d.agent_ids, d.created_at, d.updated_at],
    )?;
    Ok(())
}

pub fn update(conn: &Connection, d: &KnowledgeDocumentRow) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE knowledge_documents SET title = ?2, content = ?3, category = ?4, tags = ?5, project_ids = ?6, agent_ids = ?7, updated_at = ?8 WHERE id = ?1",
        params![d.id, d.title, d.content, d.category, d.tags, d.project_ids, d.agent_ids, d.updated_at],
    )?;
    Ok(())
}

pub fn delete(conn: &Connection, id: &str) -> Result<(), rusqlite::Error> {
    conn.execute("DELETE FROM knowledge_documents WHERE id = ?1", params![id])?;
    Ok(())
}
