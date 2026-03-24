use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct SettingsResponse {
    pub theme: String,
    pub font_family: String,
    pub font_size: u32,
    pub default_model: String,
    pub default_max_tokens: u32,
}

#[tauri::command]
pub fn get_settings() -> Result<SettingsResponse, String> {
    Ok(SettingsResponse {
        theme: "dark".to_string(),
        font_family: "Inter".to_string(),
        font_size: 14,
        default_model: "claude-sonnet-4-20250514".to_string(),
        default_max_tokens: 8192,
    })
}

#[tauri::command]
pub fn update_settings(settings: SettingsResponse) -> Result<SettingsResponse, String> {
    Ok(settings)
}
