use crate::persistence::Db;
use crate::persistence::models::AgentRow;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentDto {
    pub id: String,
    pub name: String,
    pub role: String,
    pub status: String,
    pub skills: Vec<String>,
    pub is_secretary: bool,
    pub project_ids: Vec<String>,
    pub is_builtin: bool,
}

impl From<AgentRow> for AgentDto {
    fn from(r: AgentRow) -> Self {
        Self {
            id: r.id,
            name: r.name,
            role: r.role,
            status: r.status,
            skills: serde_json::from_str(&r.skills).unwrap_or_default(),
            is_secretary: r.is_secretary,
            project_ids: serde_json::from_str(&r.project_ids).unwrap_or_default(),
            is_builtin: r.is_builtin,
        }
    }
}

impl From<&AgentDto> for AgentRow {
    fn from(d: &AgentDto) -> Self {
        Self {
            id: d.id.clone(),
            name: d.name.clone(),
            role: d.role.clone(),
            status: d.status.clone(),
            skills: serde_json::to_string(&d.skills).unwrap_or_else(|_| "[]".into()),
            is_secretary: d.is_secretary,
            project_ids: serde_json::to_string(&d.project_ids).unwrap_or_else(|_| "[]".into()),
            is_builtin: d.is_builtin,
        }
    }
}

#[tauri::command]
pub async fn list_agents(db: tauri::State<'_, Db>) -> Result<Vec<AgentDto>, String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().map_err(|e| e.to_string())?;
        let rows = crate::persistence::agents::list(&conn).map_err(|e| e.to_string())?;
        Ok(rows.into_iter().map(AgentDto::from).collect())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn create_agent(
    db: tauri::State<'_, Db>,
    name: String,
    role: String,
    skills: Vec<String>,
) -> Result<AgentDto, String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        let dto = AgentDto {
            id: format!("agent-custom-{}", uuid::Uuid::new_v4()),
            name,
            role,
            status: "idle".into(),
            skills,
            is_secretary: false,
            project_ids: vec![],
            is_builtin: false,
        };
        let row = AgentRow::from(&dto);
        let conn = db.lock().map_err(|e| e.to_string())?;
        crate::persistence::agents::insert(&conn, &row).map_err(|e| e.to_string())?;
        Ok(dto)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn update_agent(
    db: tauri::State<'_, Db>,
    agent: AgentDto,
) -> Result<AgentDto, String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        let row = AgentRow::from(&agent);
        let conn = db.lock().map_err(|e| e.to_string())?;
        crate::persistence::agents::update(&conn, &row).map_err(|e| e.to_string())?;
        Ok(agent)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn delete_agent(db: tauri::State<'_, Db>, id: String) -> Result<(), String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().map_err(|e| e.to_string())?;
        crate::persistence::agents::delete(&conn, &id).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn send_message(_agent_id: String, _message: String) -> Result<(), String> {
    // Placeholder — actual messaging goes through send_chat_message in chat.rs
    Ok(())
}
