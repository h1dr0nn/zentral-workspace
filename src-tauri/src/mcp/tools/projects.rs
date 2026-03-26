use serde_json::{json, Value};
use uuid::Uuid;
use chrono::Utc;
use crate::persistence::{projects, settings, models::ProjectRow};
use super::super::McpState;
use super::ToolDef;

pub fn tools() -> Vec<ToolDef> {
    vec![
        ToolDef {
            name: "list_projects",
            description: "List all projects",
            input_schema: json!({ "type": "object", "properties": {} }),
        },
        ToolDef {
            name: "get_active_project",
            description: "Get the currently active project",
            input_schema: json!({ "type": "object", "properties": {} }),
        },
        ToolDef {
            name: "create_project",
            description: "Create a new project",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "name": { "type": "string" },
                    "path": { "type": "string", "description": "Filesystem path of the project" }
                },
                "required": ["name", "path"]
            }),
        },
        ToolDef {
            name: "switch_project",
            description: "Switch to a different active project",
            input_schema: json!({
                "type": "object",
                "properties": { "id": { "type": "string", "description": "Project ID to switch to" } },
                "required": ["id"]
            }),
        },
    ]
}

pub fn list_projects(_args: Value, state: &McpState) -> Result<Value, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let rows = projects::list(&conn).map_err(|e| e.to_string())?;
    Ok(json!(rows))
}

pub fn get_active_project(_args: Value, state: &McpState) -> Result<Value, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let id = settings::get(&conn, "active_project").map_err(|e| e.to_string())?;
    match id {
        Some(pid) => match projects::get(&conn, &pid).map_err(|e| e.to_string())? {
            Some(row) => Ok(json!(row)),
            None => Ok(json!(null)),
        },
        None => Ok(json!(null)),
    }
}

pub fn create_project(args: Value, state: &McpState) -> Result<Value, String> {
    let name = args["name"].as_str().ok_or("Missing name")?.to_string();
    let path = args["path"].as_str().ok_or("Missing path")?.to_string();
    let row = ProjectRow {
        id: Uuid::new_v4().to_string(),
        name,
        path,
        context_badges: "[]".into(),
        last_opened_at: Utc::now().to_rfc3339(),
    };
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    projects::insert(&conn, &row).map_err(|e| e.to_string())?;
    Ok(json!(row))
}

pub fn switch_project(args: Value, state: &McpState) -> Result<Value, String> {
    let id = args["id"].as_str().ok_or("Missing id")?;
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let project = projects::get(&conn, id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Project not found: {}", id))?;
    settings::upsert(&conn, "active_project", id).map_err(|e| e.to_string())?;
    Ok(json!({ "active_project": project }))
}
