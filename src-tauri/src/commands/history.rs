use crate::persistence::Db;
use crate::persistence::models::HistoryEventRow;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEventDto {
    pub id: String,
    #[serde(rename = "type")]
    pub event_type: String,
    pub agent_id: String,
    pub project_id: Option<String>,
    pub skill_id: Option<String>,
    pub workflow_id: Option<String>,
    pub summary: String,
    pub details: Option<String>,
    pub status: String,
    pub duration: Option<i64>,
    pub timestamp: String,
}

impl From<HistoryEventRow> for HistoryEventDto {
    fn from(r: HistoryEventRow) -> Self {
        Self {
            id: r.id,
            event_type: r.event_type,
            agent_id: r.agent_id,
            project_id: r.project_id,
            skill_id: r.skill_id,
            workflow_id: r.workflow_id,
            summary: r.summary,
            details: r.details,
            status: r.status,
            duration: r.duration,
            timestamp: r.timestamp,
        }
    }
}

impl From<&HistoryEventDto> for HistoryEventRow {
    fn from(d: &HistoryEventDto) -> Self {
        Self {
            id: d.id.clone(),
            event_type: d.event_type.clone(),
            agent_id: d.agent_id.clone(),
            project_id: d.project_id.clone(),
            skill_id: d.skill_id.clone(),
            workflow_id: d.workflow_id.clone(),
            summary: d.summary.clone(),
            details: d.details.clone(),
            status: d.status.clone(),
            duration: d.duration,
            timestamp: d.timestamp.clone(),
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct HistoryFilter {
    pub agent_id: Option<String>,
    pub project_id: Option<String>,
    pub event_type: Option<String>,
    pub status: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[tauri::command]
pub async fn list_history(
    db: tauri::State<'_, Db>,
    filter: HistoryFilter,
) -> Result<Vec<HistoryEventDto>, String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().map_err(|e| e.to_string())?;
        let rows = crate::persistence::history::list(
            &conn,
            filter.agent_id.as_deref(),
            filter.project_id.as_deref(),
            filter.event_type.as_deref(),
            filter.status.as_deref(),
            filter.limit.unwrap_or(500),
            filter.offset.unwrap_or(0),
        )
        .map_err(|e| e.to_string())?;
        Ok(rows.into_iter().map(HistoryEventDto::from).collect())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn add_history_event(
    db: tauri::State<'_, Db>,
    event: HistoryEventDto,
) -> Result<HistoryEventDto, String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        let mut dto = event;
        if dto.id.is_empty() {
            dto.id = format!("evt-{}", uuid::Uuid::new_v4());
        }
        if dto.timestamp.is_empty() {
            dto.timestamp = chrono::Utc::now().to_rfc3339();
        }
        let row = HistoryEventRow::from(&dto);
        let conn = db.lock().map_err(|e| e.to_string())?;
        crate::persistence::history::insert(&conn, &row).map_err(|e| e.to_string())?;
        Ok(dto)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn clear_history(db: tauri::State<'_, Db>) -> Result<(), String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().map_err(|e| e.to_string())?;
        crate::persistence::history::clear(&conn).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}
