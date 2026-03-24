#[tauri::command]
pub fn start_telegram_bot(token: String) -> Result<(), String> {
    let _ = token;
    Ok(())
}

#[tauri::command]
pub fn stop_telegram_bot() -> Result<(), String> {
    Ok(())
}
