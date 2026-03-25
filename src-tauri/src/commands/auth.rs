use serde::{Deserialize, Serialize};
use std::process::Command;
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthStatus {
    #[serde(rename = "loggedIn")]
    pub logged_in: bool,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(rename = "subscriptionType", default)]
    pub subscription_type: Option<String>,
    #[serde(rename = "orgName", default)]
    pub org_name: Option<String>,
}

fn get_claude_path(app: &tauri::AppHandle) -> String {
    let state = app.state::<crate::config::AppSettings>();
    let path = state.claude_cli_path.lock().unwrap().clone();
    if path.is_empty() { "claude".to_string() } else { path }
}

#[tauri::command]
pub fn check_auth_status(app: tauri::AppHandle) -> Result<AuthStatus, String> {
    let claude = get_claude_path(&app);
    let output = Command::new(&claude)
        .args(["auth", "status"])
        .output()
        .map_err(|e| format!("Failed to run claude CLI: {}. Is it installed?", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str::<AuthStatus>(&stdout)
        .map_err(|e| format!("Failed to parse auth status: {}. Output: {}", e, stdout))
}

#[tauri::command]
pub fn start_login(app: tauri::AppHandle) -> Result<(), String> {
    let claude = get_claude_path(&app);
    // Spawn login process detached — it opens browser for OAuth
    Command::new(&claude)
        .args(["auth", "login"])
        .spawn()
        .map_err(|e| format!("Failed to start login: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn logout(app: tauri::AppHandle) -> Result<(), String> {
    let claude = get_claude_path(&app);
    Command::new(&claude)
        .args(["auth", "logout"])
        .output()
        .map_err(|e| format!("Failed to logout: {}", e))?;
    Ok(())
}
