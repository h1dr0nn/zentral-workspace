use crate::persistence::Db;
use crate::persistence::models::{WorkflowRow, WorkflowStepRow};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowStepDto {
    pub id: String,
    pub agent_id: String,
    pub skill_id: String,
    pub label: String,
    pub order: i32,
    pub on_success: Option<String>,
    pub on_failure: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowDto {
    pub id: String,
    pub name: String,
    pub description: String,
    pub project_id: Option<String>,
    pub status: String,
    pub steps: Vec<WorkflowStepDto>,
    pub created_at: String,
    pub last_run_at: Option<String>,
}

fn workflow_with_steps(r: WorkflowRow, steps: Vec<WorkflowStepRow>) -> WorkflowDto {
    WorkflowDto {
        id: r.id,
        name: r.name,
        description: r.description,
        project_id: r.project_id,
        status: r.status,
        steps: steps.into_iter().map(|s| WorkflowStepDto {
            id: s.id,
            agent_id: s.agent_id,
            skill_id: s.skill_id,
            label: s.label,
            order: s.step_order,
            on_success: s.on_success,
            on_failure: s.on_failure,
        }).collect(),
        created_at: r.created_at,
        last_run_at: r.last_run_at,
    }
}

#[tauri::command]
pub async fn list_workflows(db: tauri::State<'_, Db>) -> Result<Vec<WorkflowDto>, String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().map_err(|e| e.to_string())?;
        let workflows = crate::persistence::workflows::list(&conn).map_err(|e| e.to_string())?;
        let mut result = Vec::new();
        for w in workflows {
            let steps = crate::persistence::workflows::list_steps(&conn, &w.id).map_err(|e| e.to_string())?;
            result.push(workflow_with_steps(w, steps));
        }
        Ok(result)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn create_workflow(
    db: tauri::State<'_, Db>,
    workflow: WorkflowDto,
) -> Result<WorkflowDto, String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        let wf_id = format!("wf-{}", uuid::Uuid::new_v4());
        let now = chrono::Utc::now().to_rfc3339();
        let row = WorkflowRow {
            id: wf_id.clone(),
            name: workflow.name,
            description: workflow.description,
            project_id: workflow.project_id,
            status: workflow.status,
            created_at: now,
            last_run_at: None,
        };
        let step_rows: Vec<WorkflowStepRow> = workflow.steps.into_iter().map(|s| {
            WorkflowStepRow {
                id: format!("step-{}", uuid::Uuid::new_v4()),
                workflow_id: wf_id.clone(),
                agent_id: s.agent_id,
                skill_id: s.skill_id,
                label: s.label,
                step_order: s.order,
                on_success: s.on_success,
                on_failure: s.on_failure,
            }
        }).collect();
        let conn = db.lock().map_err(|e| e.to_string())?;
        crate::persistence::workflows::insert(&conn, &row).map_err(|e| e.to_string())?;
        crate::persistence::workflows::replace_steps(&conn, &wf_id, &step_rows).map_err(|e| e.to_string())?;
        Ok(workflow_with_steps(row, step_rows))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn update_workflow(
    db: tauri::State<'_, Db>,
    workflow: WorkflowDto,
) -> Result<WorkflowDto, String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        let row = WorkflowRow {
            id: workflow.id.clone(),
            name: workflow.name.clone(),
            description: workflow.description.clone(),
            project_id: workflow.project_id.clone(),
            status: workflow.status.clone(),
            created_at: workflow.created_at.clone(),
            last_run_at: workflow.last_run_at.clone(),
        };
        let step_rows: Vec<WorkflowStepRow> = workflow.steps.iter().map(|s| {
            WorkflowStepRow {
                id: s.id.clone(),
                workflow_id: workflow.id.clone(),
                agent_id: s.agent_id.clone(),
                skill_id: s.skill_id.clone(),
                label: s.label.clone(),
                step_order: s.order,
                on_success: s.on_success.clone(),
                on_failure: s.on_failure.clone(),
            }
        }).collect();
        let conn = db.lock().map_err(|e| e.to_string())?;
        crate::persistence::workflows::update(&conn, &row).map_err(|e| e.to_string())?;
        crate::persistence::workflows::replace_steps(&conn, &workflow.id, &step_rows).map_err(|e| e.to_string())?;
        Ok(workflow)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn delete_workflow(db: tauri::State<'_, Db>, id: String) -> Result<(), String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().map_err(|e| e.to_string())?;
        crate::persistence::workflows::delete(&conn, &id).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}
