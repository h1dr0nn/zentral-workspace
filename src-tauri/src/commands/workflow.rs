use crate::persistence::Db;
use crate::persistence::models::{WorkflowRow, WorkflowStepRow};
use crate::persistence::workflow_runs;
use serde::{Deserialize, Serialize};
use tauri::Manager;

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

// ── Workflow Execution Commands ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowRunDto {
    pub id: String,
    pub workflow_id: String,
    pub status: String,
    pub current_step: Option<String>,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub step_results: Vec<StepResultDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StepResultDto {
    pub id: String,
    pub step_id: String,
    pub agent_id: String,
    pub skill_id: String,
    pub status: String,
    pub output: Option<String>,
    pub duration_ms: Option<i64>,
}

#[tauri::command]
pub async fn run_workflow(
    db: tauri::State<'_, Db>,
    app: tauri::AppHandle,
    workflow_id: String,
) -> Result<String, String> {
    let db = db.inner().clone();

    // Get Claude config
    let state = app.state::<crate::config::AppSettings>();
    let claude_path = {
        let p = state.claude_cli_path.lock().unwrap().clone();
        if p.is_empty() { "claude".to_string() } else { p }
    };
    let model = state.default_model.lock().unwrap().clone();

    tokio::task::spawn_blocking(move || {
        crate::automation::workflow_runner::execute(&db, &app, &workflow_id, &claude_path, &model)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_workflow_run(
    db: tauri::State<'_, Db>,
    run_id: String,
) -> Result<Option<WorkflowRunDto>, String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().map_err(|e| e.to_string())?;
        let run = workflow_runs::get_run(&conn, &run_id).map_err(|e| e.to_string())?;
        match run {
            Some(r) => {
                let results = workflow_runs::list_step_results(&conn, &r.id)
                    .map_err(|e| e.to_string())?;
                Ok(Some(WorkflowRunDto {
                    id: r.id,
                    workflow_id: r.workflow_id,
                    status: r.status,
                    current_step: r.current_step,
                    started_at: r.started_at,
                    completed_at: r.completed_at,
                    step_results: results.into_iter().map(|sr| StepResultDto {
                        id: sr.id,
                        step_id: sr.step_id,
                        agent_id: sr.agent_id,
                        skill_id: sr.skill_id,
                        status: sr.status,
                        output: sr.output,
                        duration_ms: sr.duration_ms,
                    }).collect(),
                }))
            }
            None => Ok(None),
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn cancel_workflow_run(
    db: tauri::State<'_, Db>,
    run_id: String,
) -> Result<(), String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().map_err(|e| e.to_string())?;
        if let Some(mut run) = workflow_runs::get_run(&conn, &run_id).map_err(|e| e.to_string())? {
            run.status = "cancelled".into();
            run.completed_at = Some(chrono::Utc::now().to_rfc3339());
            workflow_runs::update_run(&conn, &run).map_err(|e| e.to_string())?;
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}
