use crate::persistence::Db;
use crate::persistence::models::*;
use serde::Deserialize;
use std::collections::HashMap;

#[tauri::command]
pub async fn check_needs_migration(db: tauri::State<'_, Db>) -> Result<bool, String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().map_err(|e| e.to_string())?;
        // Check if migration sentinel exists
        let sentinel = crate::persistence::settings::get(&conn, "migration_complete")
            .map_err(|e| e.to_string())?;
        if sentinel.is_some() {
            return Ok(false);
        }
        // Check if any data exists (if so, no migration needed — user started fresh with SQLite)
        let count: i64 = conn.query_row(
            "SELECT (SELECT COUNT(*) FROM projects) + (SELECT COUNT(*) FROM agents WHERE is_builtin = 0)",
            [],
            |r| r.get(0),
        ).map_err(|e| e.to_string())?;
        Ok(count == 0)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn import_projects(db: tauri::State<'_, Db>, projects: Vec<ProjectRow>) -> Result<(), String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().map_err(|e| e.to_string())?;
        for p in &projects {
            crate::persistence::projects::insert(&conn, p).map_err(|e| e.to_string())?;
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn import_agents(db: tauri::State<'_, Db>, agents: Vec<AgentRow>) -> Result<(), String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().map_err(|e| e.to_string())?;
        for a in &agents {
            crate::persistence::agents::upsert(&conn, a).map_err(|e| e.to_string())?;
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn import_skills(db: tauri::State<'_, Db>, skills: Vec<SkillRow>) -> Result<(), String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().map_err(|e| e.to_string())?;
        for s in &skills {
            crate::persistence::skills::insert(&conn, s).map_err(|e| e.to_string())?;
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(Debug, Deserialize)]
pub struct ChatImportPayload {
    pub messages: HashMap<String, Vec<ChatMessageRow>>,
}

#[tauri::command]
pub async fn import_chat_messages(db: tauri::State<'_, Db>, messages: HashMap<String, Vec<ChatMessageRow>>) -> Result<(), String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().map_err(|e| e.to_string())?;
        for (_key, msgs) in &messages {
            crate::persistence::chat::insert_many(&conn, msgs).map_err(|e| e.to_string())?;
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn import_schedules(db: tauri::State<'_, Db>, schedules: Vec<ScheduleRow>) -> Result<(), String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().map_err(|e| e.to_string())?;
        for s in &schedules {
            crate::persistence::schedules::insert(&conn, s).map_err(|e| e.to_string())?;
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn import_workflows(db: tauri::State<'_, Db>, workflows: Vec<serde_json::Value>) -> Result<(), String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().map_err(|e| e.to_string())?;
        for wf_val in &workflows {
            let id = wf_val["id"].as_str().unwrap_or_default().to_string();
            let row = WorkflowRow {
                id: id.clone(),
                name: wf_val["name"].as_str().unwrap_or_default().to_string(),
                description: wf_val["description"].as_str().unwrap_or_default().to_string(),
                project_id: wf_val["projectId"].as_str().map(String::from),
                status: wf_val["status"].as_str().unwrap_or("draft").to_string(),
                created_at: wf_val["createdAt"].as_str().unwrap_or_default().to_string(),
                last_run_at: wf_val["lastRunAt"].as_str().map(String::from),
            };
            crate::persistence::workflows::insert(&conn, &row).map_err(|e| e.to_string())?;

            if let Some(steps) = wf_val["steps"].as_array() {
                let step_rows: Vec<WorkflowStepRow> = steps.iter().map(|s| {
                    WorkflowStepRow {
                        id: s["id"].as_str().unwrap_or_default().to_string(),
                        workflow_id: id.clone(),
                        agent_id: s["agentId"].as_str().unwrap_or_default().to_string(),
                        skill_id: s["skillId"].as_str().unwrap_or_default().to_string(),
                        label: s["label"].as_str().unwrap_or_default().to_string(),
                        step_order: s["order"].as_i64().unwrap_or(0) as i32,
                        on_success: s["onSuccess"].as_str().map(String::from),
                        on_failure: s["onFailure"].as_str().map(String::from),
                    }
                }).collect();
                crate::persistence::workflows::replace_steps(&conn, &id, &step_rows).map_err(|e| e.to_string())?;
            }
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn import_history(db: tauri::State<'_, Db>, events: Vec<HistoryEventRow>) -> Result<(), String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().map_err(|e| e.to_string())?;
        for e in &events {
            crate::persistence::history::insert(&conn, e).map_err(|e| e.to_string())?;
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn import_knowledge(db: tauri::State<'_, Db>, documents: Vec<KnowledgeDocumentRow>) -> Result<(), String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().map_err(|e| e.to_string())?;
        for d in &documents {
            crate::persistence::knowledge::insert(&conn, d).map_err(|e| e.to_string())?;
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn mark_migration_complete(db: tauri::State<'_, Db>) -> Result<(), String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().map_err(|e| e.to_string())?;
        crate::persistence::settings::upsert(&conn, "migration_complete", "true")
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}
