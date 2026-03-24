use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct SessionResponse {
    pub id: String,
}

#[tauri::command]
pub fn create_session() -> Result<SessionResponse, String> {
    Ok(SessionResponse {
        id: uuid::Uuid::new_v4().to_string(),
    })
}
