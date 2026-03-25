use crate::config::AppSettings;
use crate::persistence::Db;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingsDto {
    pub theme: String,
    pub font_size: u32,
    pub chat_font_size: u32,
    pub default_shell: String,
    pub max_concurrent_agents: u32,
    pub default_agent_timeout: u32,
    pub auto_restart_on_crash: bool,
    pub crash_loop_threshold: u32,
    pub telegram_enabled: bool,
    pub telegram_bot_token: String,
    pub telegram_allowed_chat_ids: String,
    pub chat_token_budget: u32,
    pub chat_retention: String,
    pub claude_cli_path: String,
}

impl Default for SettingsDto {
    fn default() -> Self {
        Self {
            theme: String::new(),
            font_size: 14,
            chat_font_size: 14,
            default_shell: String::new(),
            max_concurrent_agents: 5,
            default_agent_timeout: 30,
            auto_restart_on_crash: true,
            crash_loop_threshold: 3,
            telegram_enabled: false,
            telegram_bot_token: String::new(),
            telegram_allowed_chat_ids: String::new(),
            chat_token_budget: 4000,
            chat_retention: "all".to_string(),
            claude_cli_path: String::new(),
        }
    }
}

impl SettingsDto {
    fn to_map(&self) -> HashMap<String, String> {
        let mut m = HashMap::new();
        m.insert("theme".into(), self.theme.clone());
        m.insert("font_size".into(), self.font_size.to_string());
        m.insert("chat_font_size".into(), self.chat_font_size.to_string());
        m.insert("default_shell".into(), self.default_shell.clone());
        m.insert("max_concurrent_agents".into(), self.max_concurrent_agents.to_string());
        m.insert("default_agent_timeout".into(), self.default_agent_timeout.to_string());
        m.insert("auto_restart_on_crash".into(), self.auto_restart_on_crash.to_string());
        m.insert("crash_loop_threshold".into(), self.crash_loop_threshold.to_string());
        m.insert("telegram_enabled".into(), self.telegram_enabled.to_string());
        m.insert("telegram_bot_token".into(), self.telegram_bot_token.clone());
        m.insert("telegram_allowed_chat_ids".into(), self.telegram_allowed_chat_ids.clone());
        m.insert("chat_token_budget".into(), self.chat_token_budget.to_string());
        m.insert("chat_retention".into(), self.chat_retention.clone());
        m.insert("claude_cli_path".into(), self.claude_cli_path.clone());
        m
    }

    fn from_map(m: &HashMap<String, String>) -> Self {
        let def = Self::default();
        Self {
            theme: m.get("theme").cloned().unwrap_or(def.theme),
            font_size: m.get("font_size").and_then(|v| v.parse().ok()).unwrap_or(def.font_size),
            chat_font_size: m.get("chat_font_size").and_then(|v| v.parse().ok()).unwrap_or(def.chat_font_size),
            default_shell: m.get("default_shell").cloned().unwrap_or(def.default_shell),
            max_concurrent_agents: m.get("max_concurrent_agents").and_then(|v| v.parse().ok()).unwrap_or(def.max_concurrent_agents),
            default_agent_timeout: m.get("default_agent_timeout").and_then(|v| v.parse().ok()).unwrap_or(def.default_agent_timeout),
            auto_restart_on_crash: m.get("auto_restart_on_crash").map(|v| v == "true").unwrap_or(def.auto_restart_on_crash),
            crash_loop_threshold: m.get("crash_loop_threshold").and_then(|v| v.parse().ok()).unwrap_or(def.crash_loop_threshold),
            telegram_enabled: m.get("telegram_enabled").map(|v| v == "true").unwrap_or(def.telegram_enabled),
            telegram_bot_token: m.get("telegram_bot_token").cloned().unwrap_or(def.telegram_bot_token),
            telegram_allowed_chat_ids: m.get("telegram_allowed_chat_ids").cloned().unwrap_or(def.telegram_allowed_chat_ids),
            chat_token_budget: m.get("chat_token_budget").and_then(|v| v.parse().ok()).unwrap_or(def.chat_token_budget),
            chat_retention: m.get("chat_retention").cloned().unwrap_or(def.chat_retention),
            claude_cli_path: m.get("claude_cli_path").cloned().unwrap_or(def.claude_cli_path),
        }
    }
}

#[tauri::command]
pub async fn get_settings(db: tauri::State<'_, Db>) -> Result<SettingsDto, String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().map_err(|e| e.to_string())?;
        let map = crate::persistence::settings::get_all(&conn).map_err(|e| e.to_string())?;
        Ok(SettingsDto::from_map(&map))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn update_settings(
    app: tauri::AppHandle,
    db: tauri::State<'_, Db>,
    settings: SettingsDto,
) -> Result<SettingsDto, String> {
    // Sync runtime-critical fields into managed state
    let state = app.state::<AppSettings>();
    *state.claude_cli_path.lock().unwrap() = settings.claude_cli_path.clone();
    *state.default_model.lock().unwrap() = if settings.claude_cli_path.is_empty() {
        "claude-sonnet-4-20250514".to_string()
    } else {
        state.default_model.lock().unwrap().clone()
    };

    let db = db.inner().clone();
    let s = settings.clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().map_err(|e| e.to_string())?;
        crate::persistence::settings::upsert_many(&conn, &s.to_map()).map_err(|e| e.to_string())?;
        Ok(settings)
    })
    .await
    .map_err(|e| e.to_string())?
}
