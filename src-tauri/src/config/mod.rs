use serde::{Deserialize, Serialize};
use std::sync::Mutex;

/// App-level managed state (held by Tauri).
/// Fields that the backend reads at runtime are wrapped in Mutex for interior mutability.
pub struct AppSettings {
    pub claude_cli_path: Mutex<String>,
    pub default_model: Mutex<String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            claude_cli_path: Mutex::new(String::new()),
            default_model: Mutex::new("claude-sonnet-4-20250514".to_string()),
        }
    }
}

/// Serializable settings exchanged with the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettingsDto {
    pub theme: String,
    pub font_family: String,
    pub font_size: u32,
    pub telegram_bot_token: String,
    pub telegram_chat_id: String,
    pub telegram_enabled: bool,
    pub default_model: String,
    pub default_max_tokens: u32,
    pub claude_cli_path: String,
}

impl Default for AppSettingsDto {
    fn default() -> Self {
        Self {
            theme: "dark".to_string(),
            font_family: "Inter".to_string(),
            font_size: 14,
            telegram_bot_token: String::new(),
            telegram_chat_id: String::new(),
            telegram_enabled: false,
            default_model: "claude-sonnet-4-20250514".to_string(),
            default_max_tokens: 8192,
            claude_cli_path: String::new(),
        }
    }
}
