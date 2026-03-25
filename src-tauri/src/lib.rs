mod agent;
mod commands;
mod config;
mod persistence;
mod process;
mod project;
mod telegram;

use commands::{agent as agent_cmd, config as config_cmd, project as project_cmd, session, telegram as telegram_cmd};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            agent_cmd::create_agent,
            agent_cmd::delete_agent,
            agent_cmd::list_agents,
            agent_cmd::send_message,
            project_cmd::switch_project,
            project_cmd::list_projects,
            config_cmd::get_settings,
            config_cmd::update_settings,
            telegram_cmd::start_telegram_bot,
            telegram_cmd::stop_telegram_bot,
            session::create_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
