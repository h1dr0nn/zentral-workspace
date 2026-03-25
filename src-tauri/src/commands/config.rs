use crate::config::{AppSettings, AppSettingsDto};
use tauri::Manager;

#[tauri::command]
pub fn get_settings() -> Result<AppSettingsDto, String> {
    Ok(AppSettingsDto::default())
}

#[tauri::command]
pub fn update_settings(app: tauri::AppHandle, settings: AppSettingsDto) -> Result<AppSettingsDto, String> {
    // Sync runtime-critical fields into managed state
    let state = app.state::<AppSettings>();
    *state.claude_cli_path.lock().unwrap() = settings.claude_cli_path.clone();
    *state.default_model.lock().unwrap() = settings.default_model.clone();
    Ok(settings)
}
