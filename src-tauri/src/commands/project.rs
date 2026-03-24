use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct ProjectResponse {
    pub id: String,
    pub name: String,
    pub path: String,
    pub language: Option<String>,
}

#[tauri::command]
pub fn switch_project(path: String) -> Result<ProjectResponse, String> {
    Ok(ProjectResponse {
        id: uuid::Uuid::new_v4().to_string(),
        name: path.split('/').last().unwrap_or("unknown").to_string(),
        path,
        language: None,
    })
}

#[tauri::command]
pub fn list_projects() -> Result<Vec<ProjectResponse>, String> {
    Ok(vec![])
}
