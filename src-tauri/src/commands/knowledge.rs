use crate::persistence::Db;
use crate::persistence::models::KnowledgeDocumentRow;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeDocumentDto {
    pub id: String,
    pub title: String,
    pub content: String,
    pub category: String,
    pub tags: Vec<String>,
    pub project_ids: Vec<String>,
    pub agent_ids: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl From<KnowledgeDocumentRow> for KnowledgeDocumentDto {
    fn from(r: KnowledgeDocumentRow) -> Self {
        Self {
            id: r.id,
            title: r.title,
            content: r.content,
            category: r.category,
            tags: serde_json::from_str(&r.tags).unwrap_or_default(),
            project_ids: serde_json::from_str(&r.project_ids).unwrap_or_default(),
            agent_ids: serde_json::from_str(&r.agent_ids).unwrap_or_default(),
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }
}

impl From<&KnowledgeDocumentDto> for KnowledgeDocumentRow {
    fn from(d: &KnowledgeDocumentDto) -> Self {
        Self {
            id: d.id.clone(),
            title: d.title.clone(),
            content: d.content.clone(),
            category: d.category.clone(),
            tags: serde_json::to_string(&d.tags).unwrap_or_else(|_| "[]".into()),
            project_ids: serde_json::to_string(&d.project_ids).unwrap_or_else(|_| "[]".into()),
            agent_ids: serde_json::to_string(&d.agent_ids).unwrap_or_else(|_| "[]".into()),
            created_at: d.created_at.clone(),
            updated_at: d.updated_at.clone(),
        }
    }
}

#[tauri::command]
pub async fn list_knowledge_documents(db: tauri::State<'_, Db>) -> Result<Vec<KnowledgeDocumentDto>, String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().map_err(|e| e.to_string())?;
        let rows = crate::persistence::knowledge::list(&conn).map_err(|e| e.to_string())?;
        Ok(rows.into_iter().map(KnowledgeDocumentDto::from).collect())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn create_knowledge_document(
    db: tauri::State<'_, Db>,
    document: KnowledgeDocumentDto,
) -> Result<KnowledgeDocumentDto, String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        let now = chrono::Utc::now().to_rfc3339();
        let mut dto = document;
        dto.id = format!("doc-{}", uuid::Uuid::new_v4());
        dto.created_at = now.clone();
        dto.updated_at = now;
        let row = KnowledgeDocumentRow::from(&dto);
        let conn = db.lock().map_err(|e| e.to_string())?;
        crate::persistence::knowledge::insert(&conn, &row).map_err(|e| e.to_string())?;
        Ok(dto)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn update_knowledge_document(
    db: tauri::State<'_, Db>,
    document: KnowledgeDocumentDto,
) -> Result<KnowledgeDocumentDto, String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        let mut dto = document;
        dto.updated_at = chrono::Utc::now().to_rfc3339();
        let row = KnowledgeDocumentRow::from(&dto);
        let conn = db.lock().map_err(|e| e.to_string())?;
        crate::persistence::knowledge::update(&conn, &row).map_err(|e| e.to_string())?;
        Ok(dto)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn delete_knowledge_document(db: tauri::State<'_, Db>, id: String) -> Result<(), String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().map_err(|e| e.to_string())?;
        crate::persistence::knowledge::delete(&conn, &id).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}
