use crate::persistence::Db;
use crate::persistence::{agents, history, skills, workflow_runs, workflows};
use crate::persistence::models::HistoryEventRow;
use crate::persistence::workflow_runs::{StepResultRow, WorkflowRunRow};
use crate::automation::knowledge_injector;
use serde::Serialize;
use std::io::BufRead;
use std::process::{Command, Stdio};
use std::time::Instant;
use tauri::Emitter;

#[derive(Clone, Serialize)]
pub struct WorkflowRunEvent {
    pub run_id: String,
    pub workflow_id: String,
    pub status: String,
    pub current_step: Option<String>,
}

/// Execute a workflow synchronously (called from spawn_blocking).
/// Steps run sequentially with branching support.
pub fn execute(
    db: &Db,
    app: &tauri::AppHandle,
    workflow_id: &str,
    claude_path: &str,
    model: &str,
) -> Result<String, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    // Check no active run
    if let Some(_) = workflow_runs::get_active_run(&conn, workflow_id).map_err(|e| e.to_string())? {
        return Err("Workflow already has an active run".into());
    }

    // Load workflow + steps
    let wf_rows = workflows::list(&conn).map_err(|e| e.to_string())?;
    let wf = wf_rows.iter().find(|w| w.id == workflow_id)
        .ok_or("Workflow not found")?;
    let steps = workflows::list_steps(&conn, workflow_id).map_err(|e| e.to_string())?;

    if steps.is_empty() {
        return Err("Workflow has no steps".into());
    }

    // Create run record
    let run_id = format!("run-{}", uuid::Uuid::new_v4());
    let now = chrono::Utc::now().to_rfc3339();
    let mut run = WorkflowRunRow {
        id: run_id.clone(),
        workflow_id: workflow_id.to_string(),
        status: "running".into(),
        current_step: None,
        started_at: now.clone(),
        completed_at: None,
    };
    workflow_runs::insert_run(&conn, &run).map_err(|e| e.to_string())?;
    drop(conn); // Release lock before long-running execution

    let _ = app.emit("workflow:run-update", WorkflowRunEvent {
        run_id: run_id.clone(),
        workflow_id: workflow_id.to_string(),
        status: "running".into(),
        current_step: None,
    });

    let workflow_start = Instant::now();
    let mut current_step_idx = 0;
    let mut workflow_status = "completed".to_string();
    let step_count = steps.len();

    while current_step_idx < steps.len() {
        let step = &steps[current_step_idx];
        let step_start = Instant::now();

        // Update current step
        {
            let conn = db.lock().map_err(|e| e.to_string())?;
            run.current_step = Some(step.id.clone());
            workflow_runs::update_run(&conn, &run).map_err(|e| e.to_string())?;
        }

        // Build system prompt with knowledge context
        let system_prompt = {
            let conn = db.lock().map_err(|e| e.to_string())?;
            let agent = agents::get(&conn, &step.agent_id).map_err(|e| e.to_string())?;
            let skill = skills::list(&conn).map_err(|e| e.to_string())?
                .into_iter().find(|s| s.id == step.skill_id);

            let agent_role = agent.map(|a| a.role).unwrap_or_default();
            let skill_prompt = skill.map(|s| s.prompt).unwrap_or_default();
            let knowledge = knowledge_injector::build_context(&conn, &step.agent_id, wf.project_id.as_deref())
                .unwrap_or_default();

            format!("{}\n\n{}\n\n{}", knowledge, agent_role, skill_prompt)
        };

        // Create step result record
        let result_id = format!("sr-{}", uuid::Uuid::new_v4());
        let step_now = chrono::Utc::now().to_rfc3339();
        let mut step_result = StepResultRow {
            id: result_id.clone(),
            run_id: run_id.clone(),
            step_id: step.id.clone(),
            agent_id: step.agent_id.clone(),
            skill_id: step.skill_id.clone(),
            status: "running".into(),
            output: None,
            duration_ms: None,
            started_at: step_now,
            completed_at: None,
        };
        {
            let conn = db.lock().map_err(|e| e.to_string())?;
            workflow_runs::insert_step_result(&conn, &step_result).map_err(|e| e.to_string())?;
        }

        // Execute: spawn Claude CLI and capture full output
        let message = if step.label.is_empty() {
            format!("Execute step {} of workflow", current_step_idx + 1)
        } else {
            step.label.clone()
        };

        let output = run_agent_sync(claude_path, model, &message, &system_prompt);
        let duration = step_start.elapsed().as_millis() as i64;

        let (step_status, next_step_idx) = match &output {
            Ok(_) => {
                // Success — follow on_success or next step
                let next = if let Some(ref target) = step.on_success {
                    steps.iter().position(|s| s.id == *target).unwrap_or(current_step_idx + 1)
                } else {
                    current_step_idx + 1
                };
                ("success".to_string(), next)
            }
            Err(_) => {
                // Failure — follow on_failure or abort
                if let Some(ref target) = step.on_failure {
                    let next = steps.iter().position(|s| s.id == *target).unwrap_or(steps.len());
                    ("failure".to_string(), next)
                } else {
                    ("failure".to_string(), steps.len()) // abort
                }
            }
        };

        // Update step result
        step_result.status = step_status.clone();
        step_result.output = Some(output.unwrap_or_else(|e| e));
        step_result.duration_ms = Some(duration);
        step_result.completed_at = Some(chrono::Utc::now().to_rfc3339());
        {
            let conn = db.lock().map_err(|e| e.to_string())?;
            workflow_runs::update_step_result(&conn, &step_result).map_err(|e| e.to_string())?;
        }

        if step_status == "failure" && step.on_failure.is_none() {
            workflow_status = "failed".into();
            break;
        }

        current_step_idx = next_step_idx;
    }

    // Finalize run
    let total_duration = workflow_start.elapsed().as_millis() as i64;
    run.status = workflow_status.clone();
    run.completed_at = Some(chrono::Utc::now().to_rfc3339());
    run.current_step = None;
    {
        let conn = db.lock().map_err(|e| e.to_string())?;
        workflow_runs::update_run(&conn, &run).map_err(|e| e.to_string())?;

        // Update workflow.last_run_at
        if let Some(mut wf_row) = workflows::list(&conn).map_err(|e| e.to_string())?
            .into_iter().find(|w| w.id == workflow_id)
        {
            wf_row.last_run_at = Some(chrono::Utc::now().to_rfc3339());
            let _ = workflows::update(&conn, &wf_row);
        }

        // Log history event
        let event = HistoryEventRow {
            id: format!("evt-{}", uuid::Uuid::new_v4()),
            event_type: "workflow_run".into(),
            agent_id: "system".into(),
            project_id: wf.project_id.clone(),
            skill_id: None,
            workflow_id: Some(workflow_id.to_string()),
            summary: format!("Ran workflow \"{}\" ({} steps) — {}", wf.name, step_count, workflow_status),
            details: None,
            status: if workflow_status == "completed" { "success".into() } else { "failure".into() },
            duration: Some(total_duration),
            timestamp: chrono::Utc::now().to_rfc3339(),
        };
        let _ = history::insert(&conn, &event);

        // Emit history event to frontend
        let _ = app.emit("history:new-event", &event);
    }

    let _ = app.emit("workflow:run-update", WorkflowRunEvent {
        run_id: run_id.clone(),
        workflow_id: workflow_id.to_string(),
        status: workflow_status,
        current_step: None,
    });

    Ok(run_id)
}

/// Run Claude CLI synchronously — blocks until complete, returns full output text.
fn run_agent_sync(
    claude_path: &str,
    model: &str,
    message: &str,
    system_prompt: &str,
) -> Result<String, String> {
    let mut cmd = Command::new(claude_path);
    cmd.args(["-p", message])
        .args(["--output-format", "stream-json"])
        .args(["--verbose"])
        .args(["--model", model])
        .args(["--system-prompt", system_prompt])
        .args(["--tools", ""])
        .args(["--no-session-persistence"])
        .args(["--no-chrome"])
        .args(["--disable-slash-commands"])
        .stdout(Stdio::piped())
        .stderr(Stdio::null());

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn claude: {}", e))?;
    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let reader = std::io::BufReader::new(stdout);

    let mut last_text = String::new();

    for line in reader.lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => break,
        };
        if line.trim().is_empty() { continue; }

        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&line) {
            match parsed["type"].as_str() {
                Some("assistant") => {
                    if let Some(content) = parsed["message"]["content"].as_array() {
                        let text: String = content.iter()
                            .filter_map(|c| {
                                if c["type"].as_str() == Some("text") {
                                    c["text"].as_str().map(String::from)
                                } else {
                                    None
                                }
                            })
                            .collect::<Vec<_>>()
                            .join("");
                        if !text.is_empty() {
                            last_text = text;
                        }
                    }
                }
                Some("result") => {
                    if parsed["is_error"].as_bool() == Some(true) {
                        let error = parsed["result"].as_str().unwrap_or("Unknown error");
                        let _ = child.wait();
                        return Err(error.to_string());
                    }
                    if let Some(result) = parsed["result"].as_str() {
                        last_text = result.to_string();
                    }
                }
                _ => {}
            }
        }
    }

    let _ = child.wait();
    Ok(last_text)
}
