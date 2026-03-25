use crate::persistence::Db;
use crate::persistence::models::ProjectRow;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectDto {
    pub id: String,
    pub name: String,
    pub path: String,
    pub context_badges: Vec<String>,
    pub last_opened_at: String,
}

impl From<ProjectRow> for ProjectDto {
    fn from(r: ProjectRow) -> Self {
        Self {
            id: r.id,
            name: r.name,
            path: r.path,
            context_badges: serde_json::from_str(&r.context_badges).unwrap_or_default(),
            last_opened_at: r.last_opened_at,
        }
    }
}

impl From<&ProjectDto> for ProjectRow {
    fn from(d: &ProjectDto) -> Self {
        Self {
            id: d.id.clone(),
            name: d.name.clone(),
            path: d.path.clone(),
            context_badges: serde_json::to_string(&d.context_badges).unwrap_or_else(|_| "[]".into()),
            last_opened_at: d.last_opened_at.clone(),
        }
    }
}

#[tauri::command]
pub async fn list_projects(db: tauri::State<'_, Db>) -> Result<Vec<ProjectDto>, String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().map_err(|e| e.to_string())?;
        let rows = crate::persistence::projects::list(&conn).map_err(|e| e.to_string())?;
        Ok(rows.into_iter().map(ProjectDto::from).collect())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn create_project(
    db: tauri::State<'_, Db>,
    name: String,
    path: String,
    context_badges: Vec<String>,
) -> Result<ProjectDto, String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        let dto = ProjectDto {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            path,
            context_badges,
            last_opened_at: chrono::Utc::now().to_rfc3339(),
        };
        let row = ProjectRow::from(&dto);
        let conn = db.lock().map_err(|e| e.to_string())?;
        crate::persistence::projects::insert(&conn, &row).map_err(|e| e.to_string())?;
        Ok(dto)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn update_project(
    db: tauri::State<'_, Db>,
    project: ProjectDto,
) -> Result<ProjectDto, String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        let row = ProjectRow::from(&project);
        let conn = db.lock().map_err(|e| e.to_string())?;
        crate::persistence::projects::update(&conn, &row).map_err(|e| e.to_string())?;
        Ok(project)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn delete_project(db: tauri::State<'_, Db>, id: String) -> Result<(), String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().map_err(|e| e.to_string())?;
        crate::persistence::projects::delete(&conn, &id).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn switch_project(db: tauri::State<'_, Db>, id: String) -> Result<ProjectDto, String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().map_err(|e| e.to_string())?;
        let row = crate::persistence::projects::get(&conn, &id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| format!("Project {} not found", id))?;
        let mut updated = row;
        updated.last_opened_at = chrono::Utc::now().to_rfc3339();
        crate::persistence::projects::update(&conn, &updated).map_err(|e| e.to_string())?;
        Ok(ProjectDto::from(updated))
    })
    .await
    .map_err(|e| e.to_string())?
}
