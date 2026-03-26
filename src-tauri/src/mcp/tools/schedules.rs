use serde_json::{json, Value};
use uuid::Uuid;
use chrono::Utc;
use crate::persistence::{schedules, models::ScheduleRow};
use super::super::McpState;
use super::ToolDef;

pub fn tools() -> Vec<ToolDef> {
    vec![
        ToolDef {
            name: "list_schedules",
            description: "List all schedules",
            input_schema: json!({ "type": "object", "properties": {} }),
        },
        ToolDef {
            name: "create_schedule",
            description: "Create a new schedule",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "name":            { "type": "string" },
                    "agent_id":        { "type": "string" },
                    "skill_id":        { "type": "string" },
                    "cron_expression": { "type": "string", "description": "Cron expression e.g. '0 9 * * 1-5'" },
                    "frequency":       { "type": "string" },
                    "prompt":          { "type": "string" },
                    "description":     { "type": "string" }
                },
                "required": ["name", "agent_id", "skill_id", "cron_expression"]
            }),
        },
        ToolDef {
            name: "update_schedule",
            description: "Update an existing schedule",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "id":   { "type": "string" },
                    "name": { "type": "string" },
                    "cron_expression": { "type": "string" },
                    "prompt": { "type": "string" },
                    "status": { "type": "string" }
                },
                "required": ["id"]
            }),
        },
        ToolDef {
            name: "toggle_schedule",
            description: "Toggle schedule between active and paused",
            input_schema: json!({
                "type": "object",
                "properties": { "id": { "type": "string" } },
                "required": ["id"]
            }),
        },
        ToolDef {
            name: "delete_schedule",
            description: "Delete a schedule",
            input_schema: json!({
                "type": "object",
                "properties": { "id": { "type": "string" } },
                "required": ["id"]
            }),
        },
    ]
}

pub fn list_schedules(_args: Value, state: &McpState) -> Result<Value, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let rows = schedules::list(&conn).map_err(|e| e.to_string())?;
    Ok(json!(rows))
}

pub fn create_schedule(args: Value, state: &McpState) -> Result<Value, String> {
    let row = ScheduleRow {
        id: Uuid::new_v4().to_string(),
        name: args["name"].as_str().ok_or("Missing name")?.into(),
        agent_id: args["agent_id"].as_str().ok_or("Missing agent_id")?.into(),
        skill_id: args["skill_id"].as_str().ok_or("Missing skill_id")?.into(),
        project_id: args.get("project_id").and_then(Value::as_str).map(String::from),
        frequency: args.get("frequency").and_then(Value::as_str).unwrap_or("custom").into(),
        cron_expression: args["cron_expression"].as_str().ok_or("Missing cron_expression")?.into(),
        prompt: args.get("prompt").and_then(Value::as_str).unwrap_or("").into(),
        description: args.get("description").and_then(Value::as_str).unwrap_or("").into(),
        status: "active".into(),
        next_run_at: Utc::now().to_rfc3339(),
        last_run_at: None,
        created_at: Utc::now().to_rfc3339(),
    };
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    schedules::insert(&conn, &row).map_err(|e| e.to_string())?;
    Ok(json!(row))
}

pub fn update_schedule(args: Value, state: &McpState) -> Result<Value, String> {
    let id = args["id"].as_str().ok_or("Missing id")?;
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let rows = schedules::list(&conn).map_err(|e| e.to_string())?;
    let mut row = rows.into_iter().find(|s| s.id == id)
        .ok_or_else(|| format!("Schedule not found: {}", id))?;
    if let Some(v) = args["name"].as_str() { row.name = v.into(); }
    if let Some(v) = args["cron_expression"].as_str() { row.cron_expression = v.into(); }
    if let Some(v) = args["prompt"].as_str() { row.prompt = v.into(); }
    if let Some(v) = args["status"].as_str() { row.status = v.into(); }
    schedules::update(&conn, &row).map_err(|e| e.to_string())?;
    Ok(json!(row))
}

pub fn toggle_schedule(args: Value, state: &McpState) -> Result<Value, String> {
    let id = args["id"].as_str().ok_or("Missing id")?;
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let rows = schedules::list(&conn).map_err(|e| e.to_string())?;
    let mut row = rows.into_iter().find(|s| s.id == id)
        .ok_or_else(|| format!("Schedule not found: {}", id))?;
    row.status = if row.status == "active" { "paused".into() } else { "active".into() };
    schedules::update(&conn, &row).map_err(|e| e.to_string())?;
    Ok(json!({ "id": id, "status": row.status }))
}

pub fn delete_schedule(args: Value, state: &McpState) -> Result<Value, String> {
    let id = args["id"].as_str().ok_or("Missing id")?;
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    schedules::delete(&conn, id).map_err(|e| e.to_string())?;
    Ok(json!({ "deleted": id }))
}
