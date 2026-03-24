use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub theme: String,
    pub font_family: String,
    pub font_size: u32,
    pub telegram_bot_token: String,
    pub telegram_chat_id: String,
    pub telegram_enabled: bool,
    pub default_model: String,
    pub default_max_tokens: u32,
}

impl Default for AppSettings {
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
        }
    }
}
