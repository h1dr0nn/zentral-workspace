mod agent;
mod commands;
mod config;
mod persistence;
mod process;
mod project;
mod telegram;

use commands::{
    agent as agent_cmd, auth as auth_cmd, chat as chat_cmd, config as config_cmd,
    project as project_cmd, session, telegram as telegram_cmd,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(config::AppSettings::default())
        .invoke_handler(tauri::generate_handler![
            // Auth
            auth_cmd::check_auth_status,
            auth_cmd::start_login,
            auth_cmd::logout,
            // Chat
            chat_cmd::send_chat_message,
            // Agents
            agent_cmd::create_agent,
            agent_cmd::delete_agent,
            agent_cmd::list_agents,
            agent_cmd::send_message,
            // Projects
            project_cmd::switch_project,
            project_cmd::list_projects,
            // Config
            config_cmd::get_settings,
            config_cmd::update_settings,
            // Telegram
            telegram_cmd::start_telegram_bot,
            telegram_cmd::stop_telegram_bot,
            // Session
            session::create_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
