pub mod migrations;
pub mod models;

pub mod settings;
pub mod projects;
pub mod agents;
pub mod skills;
pub mod chat;
pub mod schedules;
pub mod workflows;
pub mod history;
pub mod knowledge;
pub mod workflow_runs;

#[cfg(test)]
mod tests;

use rusqlite::Connection;
use std::sync::{Arc, Mutex};

/// Shared database handle managed by Tauri.
pub type Db = Arc<Mutex<Connection>>;

pub struct Database;

impl Database {
    /// Open (or create) the SQLite database and run migrations.
    pub fn init() -> Result<Db, Box<dyn std::error::Error>> {
        let data_dir = dirs::data_dir()
            .ok_or("Could not determine data directory")?
            .join("zentral");
        std::fs::create_dir_all(&data_dir)?;
        let db_path = data_dir.join("zentral.db");

        log::info!("Opening database at {}", db_path.display());

        let conn = Connection::open(&db_path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;

        migrations::run(&conn)?;

        Ok(Arc::new(Mutex::new(conn)))
    }

    /// Create an in-memory database for testing.
    #[cfg(test)]
    pub fn init_memory() -> Result<Connection, Box<dyn std::error::Error>> {
        let conn = Connection::open_in_memory()?;
        conn.execute_batch("PRAGMA foreign_keys=ON;")?;
        migrations::run(&conn)?;
        Ok(conn)
    }
}
