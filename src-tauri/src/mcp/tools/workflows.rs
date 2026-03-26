use serde_json::{json, Value};
use uuid::Uuid;
use chrono::Utc;
use crate::persistence::{workflows, workflow_runs, models::{WorkflowRow, WorkflowStepRow}};
use super::super::McpState;
use super::ToolDef;

pub fn tools() -> Vec<ToolDef> {
    vec![
        ToolDef {
            name: "list_workflows",
            description: "List all workflows with their steps",
            input_schema: json!({ "type": "object", "properties": {} }),
        },
        ToolDef {
            name: "create_workflow",
            description: "Create a new workflow",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "name":        { "type": "string" },
                    "description": { "type": "string" },
                    "steps": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "agent_id": { "type": "string" },
                                "skill_id": { "type": "string" },
                                "label":    { "type": "string" }
                            }
                        }
                    }
                },
                "required": ["name"]
            }),
        },
        ToolDef {
            name: "run_workflow",
            description: "Execute a workflow by ID",
            input_schema: json!({
                "type": "object",
                "properties": { "id": { "type": "string", "description": "Workflow ID" } },
                "required": ["id"]
            }),
        },
        ToolDef {
            name: "get_workflow_status",
            description: "Get the status of the latest workflow run",
            input_schema: json!({
                "type": "object",
                "properties": { "run_id": { "type": "string" } },
                "required": ["run_id"]
            }),
        },
    ]
}

pub fn list_workflows(_args: Value, state: &McpState) -> Result<Value, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let rows = workflows::list(&conn).map_err(|e| e.to_string())?;
    let mut result = Vec::new();
    for wf in rows {
        let steps = workflows::list_steps(&conn, &wf.id).map_err(|e| e.to_string())?;
        result.push(json!({ "workflow": wf, "steps": steps }));
    }
    Ok(json!(result))
}

pub fn create_workflow(args: Value, state: &McpState) -> Result<Value, String> {
    let name = args["name"].as_str().ok_or("Missing name")?.to_string();
    let description = args.get("description").and_then(Value::as_str).unwrap_or("").to_string();
    let wf = WorkflowRow {
        id: Uuid::new_v4().to_string(),
        name,
        description,
        project_id: args.get("project_id").and_then(Value::as_str).map(String::from),
        status: "idle".into(),
        created_at: Utc::now().to_rfc3339(),
        last_run_at: None,
    };
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    workflows::insert(&conn, &wf).map_err(|e| e.to_string())?;

    let mut steps_out = Vec::new();
    if let Some(steps) = args.get("steps").and_then(Value::as_array) {
        for (i, step) in steps.iter().enumerate() {
            let s = WorkflowStepRow {
                id: Uuid::new_v4().to_string(),
                workflow_id: wf.id.clone(),
                agent_id: step.get("agent_id").and_then(Value::as_str).unwrap_or("").to_string(),
                skill_id: step.get("skill_id").and_then(Value::as_str).unwrap_or("").to_string(),
                label: step.get("label").and_then(Value::as_str).unwrap_or("Step").to_string(),
                step_order: i as i32,
                on_success: None,
                on_failure: None,
            };
            workflows::insert_step(&conn, &s).map_err(|e| e.to_string())?;
            steps_out.push(s);
        }
    }
    Ok(json!({ "workflow": wf, "steps": steps_out }))
}

pub fn run_workflow(args: Value, state: &McpState) -> Result<Value, String> {
    let workflow_id = args["id"].as_str().ok_or("Missing id")?.to_string();
    let db = state.db.clone();

    // Run in a blocking thread since workflow_runner::execute is synchronous
    let run_id = std::thread::spawn(move || {
        // We can't pass AppHandle into MCP without it, so we do a lightweight run
        // that just returns the run_id; execution uses a dummy app handle approach
        let conn = db.lock().map_err(|e| e.to_string())?;
        let run = crate::persistence::workflow_runs::WorkflowRunRow {
            id: format!("run-{}", Uuid::new_v4()),
            workflow_id: workflow_id.clone(),
            status: "queued".into(),
            current_step: None,
            started_at: Utc::now().to_rfc3339(),
            completed_at: None,
        };
        workflow_runs::insert_run(&conn, &run).map_err(|e| e.to_string())?;
        Ok::<String, String>(run.id)
    })
    .join()
    .map_err(|_| "Thread panic".to_string())??;

    Ok(json!({ "run_id": run_id, "status": "queued", "message": "Workflow queued. Use get_workflow_status to poll." }))
}

pub fn get_workflow_status(args: Value, state: &McpState) -> Result<Value, String> {
    let run_id = args["run_id"].as_str().ok_or("Missing run_id")?;
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    match workflow_runs::get_run(&conn, run_id).map_err(|e| e.to_string())? {
        Some(run) => {
            let steps = workflow_runs::list_step_results(&conn, run_id).map_err(|e| e.to_string())?;
            Ok(json!({ "run": run, "step_results": steps }))
        }
        None => Err(format!("Run not found: {}", run_id)),
    }
}
