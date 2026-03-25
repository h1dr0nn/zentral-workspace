use crate::persistence::Db;
use crate::persistence::models::SkillRow;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillDto {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String,
    pub prompt: String,
    pub builtin: bool,
}

impl From<SkillRow> for SkillDto {
    fn from(r: SkillRow) -> Self {
        Self {
            id: r.id,
            name: r.name,
            description: r.description,
            category: r.category,
            prompt: r.prompt,
            builtin: r.is_builtin,
        }
    }
}

impl From<&SkillDto> for SkillRow {
    fn from(d: &SkillDto) -> Self {
        Self {
            id: d.id.clone(),
            name: d.name.clone(),
            description: d.description.clone(),
            category: d.category.clone(),
            prompt: d.prompt.clone(),
            is_builtin: d.builtin,
        }
    }
}

#[tauri::command]
pub async fn list_skills(db: tauri::State<'_, Db>) -> Result<Vec<SkillDto>, String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().map_err(|e| e.to_string())?;
        let rows = crate::persistence::skills::list(&conn).map_err(|e| e.to_string())?;
        Ok(rows.into_iter().map(SkillDto::from).collect())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn create_skill(
    db: tauri::State<'_, Db>,
    name: String,
    description: String,
    category: String,
    prompt: String,
) -> Result<SkillDto, String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        let dto = SkillDto {
            id: format!("skill-{}", uuid::Uuid::new_v4()),
            name,
            description,
            category,
            prompt,
            builtin: false,
        };
        let row = SkillRow::from(&dto);
        let conn = db.lock().map_err(|e| e.to_string())?;
        crate::persistence::skills::insert(&conn, &row).map_err(|e| e.to_string())?;
        Ok(dto)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn update_skill(
    db: tauri::State<'_, Db>,
    skill: SkillDto,
) -> Result<SkillDto, String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        let row = SkillRow::from(&skill);
        let conn = db.lock().map_err(|e| e.to_string())?;
        crate::persistence::skills::update(&conn, &row).map_err(|e| e.to_string())?;
        Ok(skill)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn delete_skill(db: tauri::State<'_, Db>, id: String) -> Result<(), String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().map_err(|e| e.to_string())?;
        crate::persistence::skills::delete(&conn, &id).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}
