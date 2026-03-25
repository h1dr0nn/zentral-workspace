use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use tauri::Emitter;

/// A running PTY session.
pub struct PtySession {
    writer: Box<dyn Write + Send>,
    master: Box<dyn MasterPty + Send>,
}

/// Shared state: maps tab ID → PTY session.
pub type PtyManager = Arc<Mutex<HashMap<String, PtySession>>>;

pub fn new_manager() -> PtyManager {
    Arc::new(Mutex::new(HashMap::new()))
}

#[derive(Clone, Serialize)]
pub struct PtyDataEvent {
    pub id: String,
    pub data: String,
}

#[derive(Clone, Serialize)]
pub struct PtyExitEvent {
    pub id: String,
    pub code: i32,
}

/// Spawn a new PTY with the given shell and dimensions.
pub fn spawn(
    manager: &PtyManager,
    app: tauri::AppHandle,
    id: String,
    shell: String,
    cwd: Option<String>,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let pty_system = native_pty_system();

    let size = PtySize {
        rows,
        cols,
        pixel_width: 0,
        pixel_height: 0,
    };

    let pair = pty_system
        .openpty(size)
        .map_err(|e| format!("Failed to open PTY: {}", e))?;

    let mut cmd = CommandBuilder::new(&shell);
    // Set environment for better terminal experience
    cmd.env("TERM", "xterm-256color");

    // Suppress startup banners
    let shell_lower = shell.to_lowercase();
    if shell_lower.contains("powershell") {
        cmd.arg("-NoLogo");
    }

    // Set working directory to project path if provided
    if let Some(dir) = &cwd {
        let path = std::path::Path::new(dir);
        if path.is_dir() {
            cmd.cwd(path);
        }
    }

    let _child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn shell: {}", e))?;

    // Drop the slave — we only interact via the master
    drop(pair.slave);

    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to clone PTY reader: {}", e))?;

    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to take PTY writer: {}", e))?;

    let session = PtySession {
        writer,
        master: pair.master,
    };

    manager
        .lock()
        .map_err(|e| e.to_string())?
        .insert(id.clone(), session);

    // Spawn reader thread — streams PTY output to frontend
    let reader_id = id.clone();
    let reader_app = app.clone();
    let reader_manager = manager.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    // Convert to string, replacing invalid UTF-8 with replacement char
                    let text = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = reader_app.emit(
                        "pty:data",
                        PtyDataEvent {
                            id: reader_id.clone(),
                            data: text,
                        },
                    );
                }
                Err(_) => break,
            }
        }
        // Process exited — clean up
        let _ = reader_app.emit(
            "pty:exit",
            PtyExitEvent {
                id: reader_id.clone(),
                code: 0,
            },
        );
        // Remove session from manager
        if let Ok(mut mgr) = reader_manager.lock() {
            mgr.remove(&reader_id);
        }
    });

    Ok(())
}

/// Write data to a PTY session.
pub fn write(manager: &PtyManager, id: &str, data: &str) -> Result<(), String> {
    let mut mgr = manager.lock().map_err(|e| e.to_string())?;
    let session = mgr.get_mut(id).ok_or("PTY session not found")?;
    session
        .writer
        .write_all(data.as_bytes())
        .map_err(|e| format!("Failed to write to PTY: {}", e))?;
    session
        .writer
        .flush()
        .map_err(|e| format!("Failed to flush PTY: {}", e))?;
    Ok(())
}

/// Resize a PTY session.
pub fn resize(manager: &PtyManager, id: &str, cols: u16, rows: u16) -> Result<(), String> {
    let mgr = manager.lock().map_err(|e| e.to_string())?;
    let session = mgr.get(id).ok_or("PTY session not found")?;
    session
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to resize PTY: {}", e))?;
    Ok(())
}

/// Kill a PTY session and remove it from the manager.
pub fn kill(manager: &PtyManager, id: &str) -> Result<(), String> {
    let mut mgr = manager.lock().map_err(|e| e.to_string())?;
    // Dropping the session closes the master PTY, which signals the child to exit
    mgr.remove(id);
    Ok(())
}
