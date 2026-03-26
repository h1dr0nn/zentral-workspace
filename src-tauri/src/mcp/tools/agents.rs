use serde_json::{json, Value};
use uuid::Uuid;
use crate::persistence::{agents, models::AgentRow};
use super::super::McpState;
use super::ToolDef;

pub fn tools() -> Vec<ToolDef> {
    vec![
        ToolDef {
            name: "list_agents",
            description: "List all agents in Zentral",
            input_schema: json!({ "type": "object", "properties": {} }),
        },
        ToolDef {
            name: "get_agent",
            description: "Get a specific agent by ID",
            input_schema: json!({
                "type": "object",
                "properties": { "id": { "type": "string", "description": "Agent ID" } },
                "required": ["id"]
            }),
        },
        ToolDef {
            name: "create_agent",
            description: "Create a new agent",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "name":  { "type": "string" },
                    "role":  { "type": "string" },
                    "skills": { "type": "array", "items": { "type": "string" } }
                },
                "required": ["name", "role"]
            }),
        },
        ToolDef {
            name: "update_agent",
            description: "Update an existing agent",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "id":     { "type": "string" },
                    "name":   { "type": "string" },
                    "role":   { "type": "string" },
                    "status": { "type": "string" },
                    "skills": { "type": "array", "items": { "type": "string" } }
                },
                "required": ["id"]
            }),
        },
        ToolDef {
            name: "delete_agent",
            description: "Delete an agent (only non-builtin agents)",
            input_schema: json!({
                "type": "object",
                "properties": { "id": { "type": "string" } },
                "required": ["id"]
            }),
        },
    ]
}

pub fn list_agents(_args: Value, state: &McpState) -> Result<Value, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let rows = agents::list(&conn).map_err(|e| e.to_string())?;
    Ok(json!(rows))
}

pub fn get_agent(args: Value, state: &McpState) -> Result<Value, String> {
    let id = args["id"].as_str().ok_or("Missing id")?;
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    match agents::get(&conn, id).map_err(|e| e.to_string())? {
        Some(row) => Ok(json!(row)),
        None => Err(format!("Agent not found: {}", id)),
    }
}

pub fn create_agent(args: Value, state: &McpState) -> Result<Value, String> {
    let name = args["name"].as_str().ok_or("Missing name")?.to_string();
    let role = args["role"].as_str().ok_or("Missing role")?.to_string();
    let skills = args.get("skills").cloned().unwrap_or(json!([]));
    let row = AgentRow {
        id: Uuid::new_v4().to_string(),
        name,
        role,
        status: "idle".into(),
        skills: skills.to_string(),
        is_secretary: false,
        project_ids: "[]".into(),
        is_builtin: false,
    };
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    agents::insert(&conn, &row).map_err(|e| e.to_string())?;
    Ok(json!(row))
}

pub fn update_agent(args: Value, state: &McpState) -> Result<Value, String> {
    let id = args["id"].as_str().ok_or("Missing id")?.to_string();
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut row = agents::get(&conn, &id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Agent not found: {}", id))?;
    if let Some(v) = args["name"].as_str() { row.name = v.into(); }
    if let Some(v) = args["role"].as_str() { row.role = v.into(); }
    if let Some(v) = args["status"].as_str() { row.status = v.into(); }
    if let Some(v) = args.get("skills") { row.skills = v.to_string(); }
    agents::update(&conn, &row).map_err(|e| e.to_string())?;
    Ok(json!(row))
}

pub fn delete_agent(args: Value, state: &McpState) -> Result<Value, String> {
    let id = args["id"].as_str().ok_or("Missing id")?;
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    agents::delete(&conn, id).map_err(|e| e.to_string())?;
    Ok(json!({ "deleted": id }))
}
