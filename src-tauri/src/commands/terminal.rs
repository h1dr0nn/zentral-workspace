use crate::process::pty::PtyManager;

fn default_shell() -> String {
    #[cfg(target_os = "windows")]
    {
        std::env::var("COMSPEC").unwrap_or_else(|_| "powershell.exe".to_string())
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
    }
}

#[tauri::command]
pub fn pty_spawn(
    manager: tauri::State<'_, PtyManager>,
    app: tauri::AppHandle,
    id: String,
    shell: Option<String>,
    cwd: Option<String>,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let shell = shell
        .filter(|s| !s.is_empty())
        .unwrap_or_else(default_shell);
    crate::process::pty::spawn(manager.inner(), app, id, shell, cwd, cols, rows)
}

#[tauri::command]
pub fn pty_write(
    manager: tauri::State<'_, PtyManager>,
    id: String,
    data: String,
) -> Result<(), String> {
    crate::process::pty::write(manager.inner(), &id, &data)
}

#[tauri::command]
pub fn pty_resize(
    manager: tauri::State<'_, PtyManager>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    crate::process::pty::resize(manager.inner(), &id, cols, rows)
}

#[tauri::command]
pub fn pty_kill(
    manager: tauri::State<'_, PtyManager>,
    id: String,
) -> Result<(), String> {
    crate::process::pty::kill(manager.inner(), &id)
}
