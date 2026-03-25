use crate::persistence::Db;
use crate::persistence::models::ScheduleRow;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleDto {
    pub id: String,
    pub name: String,
    pub agent_id: String,
    pub skill_id: String,
    pub project_id: Option<String>,
    pub frequency: String,
    pub cron_expression: String,
    pub prompt: String,
    pub description: String,
    pub status: String,
    pub next_run_at: String,
    pub last_run_at: Option<String>,
    pub created_at: String,
}

impl From<ScheduleRow> for ScheduleDto {
    fn from(r: ScheduleRow) -> Self {
        Self {
            id: r.id,
            name: r.name,
            agent_id: r.agent_id,
            skill_id: r.skill_id,
            project_id: r.project_id,
            frequency: r.frequency,
            cron_expression: r.cron_expression,
            prompt: r.prompt,
            description: r.description,
            status: r.status,
            next_run_at: r.next_run_at,
            last_run_at: r.last_run_at,
            created_at: r.created_at,
        }
    }
}

impl From<&ScheduleDto> for ScheduleRow {
    fn from(d: &ScheduleDto) -> Self {
        Self {
            id: d.id.clone(),
            name: d.name.clone(),
            agent_id: d.agent_id.clone(),
            skill_id: d.skill_id.clone(),
            project_id: d.project_id.clone(),
            frequency: d.frequency.clone(),
            cron_expression: d.cron_expression.clone(),
            prompt: d.prompt.clone(),
            description: d.description.clone(),
            status: d.status.clone(),
            next_run_at: d.next_run_at.clone(),
            last_run_at: d.last_run_at.clone(),
            created_at: d.created_at.clone(),
        }
    }
}

#[tauri::command]
pub async fn list_schedules(db: tauri::State<'_, Db>) -> Result<Vec<ScheduleDto>, String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().map_err(|e| e.to_string())?;
        let rows = crate::persistence::schedules::list(&conn).map_err(|e| e.to_string())?;
        Ok(rows.into_iter().map(ScheduleDto::from).collect())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn create_schedule(
    db: tauri::State<'_, Db>,
    schedule: ScheduleDto,
) -> Result<ScheduleDto, String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        let mut dto = schedule;
        dto.id = format!("sched-{}", uuid::Uuid::new_v4());
        dto.created_at = chrono::Utc::now().to_rfc3339();
        let row = ScheduleRow::from(&dto);
        let conn = db.lock().map_err(|e| e.to_string())?;
        crate::persistence::schedules::insert(&conn, &row).map_err(|e| e.to_string())?;
        Ok(dto)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn update_schedule(
    db: tauri::State<'_, Db>,
    schedule: ScheduleDto,
) -> Result<ScheduleDto, String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        let row = ScheduleRow::from(&schedule);
        let conn = db.lock().map_err(|e| e.to_string())?;
        crate::persistence::schedules::update(&conn, &row).map_err(|e| e.to_string())?;
        Ok(schedule)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn delete_schedule(db: tauri::State<'_, Db>, id: String) -> Result<(), String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().map_err(|e| e.to_string())?;
        crate::persistence::schedules::delete(&conn, &id).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn toggle_schedule_status(db: tauri::State<'_, Db>, id: String) -> Result<ScheduleDto, String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().map_err(|e| e.to_string())?;
        let rows = crate::persistence::schedules::list(&conn).map_err(|e| e.to_string())?;
        let row = rows.into_iter().find(|r| r.id == id).ok_or("Schedule not found")?;
        let new_status = if row.status == "active" { "paused" } else { "active" };
        let mut updated = row;
        updated.status = new_status.to_string();
        crate::persistence::schedules::update(&conn, &updated).map_err(|e| e.to_string())?;
        Ok(ScheduleDto::from(updated))
    })
    .await
    .map_err(|e| e.to_string())?
}
