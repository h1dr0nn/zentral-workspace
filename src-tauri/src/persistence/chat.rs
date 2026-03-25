use rusqlite::{params, Connection};
use super::models::ChatMessageRow;

pub fn get_by_key(conn: &Connection, chat_key: &str) -> Result<Vec<ChatMessageRow>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, chat_key, agent_id, role, content, timestamp, source FROM chat_messages WHERE chat_key = ?1 ORDER BY timestamp ASC"
    )?;
    let rows = stmt.query_map(params![chat_key], |row| {
        Ok(ChatMessageRow {
            id: row.get(0)?,
            chat_key: row.get(1)?,
            agent_id: row.get(2)?,
            role: row.get(3)?,
            content: row.get(4)?,
            timestamp: row.get(5)?,
            source: row.get(6)?,
        })
    })?;
    rows.collect()
}

pub fn insert(conn: &Connection, m: &ChatMessageRow) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT OR IGNORE INTO chat_messages (id, chat_key, agent_id, role, content, timestamp, source) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![m.id, m.chat_key, m.agent_id, m.role, m.content, m.timestamp, m.source],
    )?;
    Ok(())
}

pub fn insert_many(conn: &Connection, messages: &[ChatMessageRow]) -> Result<(), rusqlite::Error> {
    let tx = conn.unchecked_transaction()?;
    for m in messages {
        tx.execute(
            "INSERT OR IGNORE INTO chat_messages (id, chat_key, agent_id, role, content, timestamp, source) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![m.id, m.chat_key, m.agent_id, m.role, m.content, m.timestamp, m.source],
        )?;
    }
    tx.commit()?;
    Ok(())
}

pub fn delete_by_key(conn: &Connection, chat_key: &str) -> Result<(), rusqlite::Error> {
    conn.execute("DELETE FROM chat_messages WHERE chat_key = ?1", params![chat_key])?;
    Ok(())
}
