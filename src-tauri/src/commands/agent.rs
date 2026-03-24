use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct CreateAgentInput {
    pub name: String,
    pub role: String,
    pub skills: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct AgentResponse {
    pub id: String,
    pub name: String,
    pub role: String,
    pub status: String,
}

#[tauri::command]
pub fn create_agent(name: String, role: String, skills: Vec<String>) -> Result<AgentResponse, String> {
    let id = uuid::Uuid::new_v4().to_string();
    Ok(AgentResponse {
        id,
        name,
        role,
        status: "idle".to_string(),
    })
}

#[tauri::command]
pub fn delete_agent(id: String) -> Result<(), String> {
    let _ = id;
    Ok(())
}

#[tauri::command]
pub fn list_agents() -> Result<Vec<AgentResponse>, String> {
    Ok(vec![])
}

#[tauri::command]
pub fn send_message(agent_id: String, message: String) -> Result<(), String> {
    let _ = (agent_id, message);
    Ok(())
}
