use serde_json::{json, Value};
use uuid::Uuid;
use chrono::Utc;
use crate::persistence::{knowledge, models::KnowledgeDocumentRow};
use super::super::McpState;
use super::ToolDef;

pub fn tools() -> Vec<ToolDef> {
    vec![
        ToolDef {
            name: "list_documents",
            description: "List all knowledge documents",
            input_schema: json!({ "type": "object", "properties": {} }),
        },
        ToolDef {
            name: "create_document",
            description: "Create a new knowledge document",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "title":    { "type": "string" },
                    "content":  { "type": "string" },
                    "category": { "type": "string" },
                    "tags":     { "type": "array", "items": { "type": "string" } }
                },
                "required": ["title", "content"]
            }),
        },
        ToolDef {
            name: "get_document",
            description: "Get a knowledge document by ID",
            input_schema: json!({
                "type": "object",
                "properties": { "id": { "type": "string" } },
                "required": ["id"]
            }),
        },
        ToolDef {
            name: "update_document",
            description: "Update a knowledge document",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "id":      { "type": "string" },
                    "title":   { "type": "string" },
                    "content": { "type": "string" },
                    "category":{ "type": "string" }
                },
                "required": ["id"]
            }),
        },
        ToolDef {
            name: "delete_document",
            description: "Delete a knowledge document",
            input_schema: json!({
                "type": "object",
                "properties": { "id": { "type": "string" } },
                "required": ["id"]
            }),
        },
    ]
}

pub fn list_documents(_args: Value, state: &McpState) -> Result<Value, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let rows = knowledge::list(&conn).map_err(|e| e.to_string())?;
    Ok(json!(rows))
}

pub fn create_document(args: Value, state: &McpState) -> Result<Value, String> {
    let now = Utc::now().to_rfc3339();
    let tags = args.get("tags").cloned().unwrap_or(json!([]));
    let row = KnowledgeDocumentRow {
        id: Uuid::new_v4().to_string(),
        title: args["title"].as_str().ok_or("Missing title")?.into(),
        content: args["content"].as_str().ok_or("Missing content")?.into(),
        category: args.get("category").and_then(Value::as_str).unwrap_or("General").into(),
        tags: tags.to_string(),
        project_ids: "[]".into(),
        agent_ids: "[]".into(),
        created_at: now.clone(),
        updated_at: now,
    };
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    knowledge::insert(&conn, &row).map_err(|e| e.to_string())?;
    Ok(json!(row))
}

pub fn get_document(args: Value, state: &McpState) -> Result<Value, String> {
    let id = args["id"].as_str().ok_or("Missing id")?;
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let rows = knowledge::list(&conn).map_err(|e| e.to_string())?;
    rows.into_iter()
        .find(|d| d.id == id)
        .map(|d| json!(d))
        .ok_or_else(|| format!("Document not found: {}", id))
}

pub fn update_document(args: Value, state: &McpState) -> Result<Value, String> {
    let id = args["id"].as_str().ok_or("Missing id")?;
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let rows = knowledge::list(&conn).map_err(|e| e.to_string())?;
    let mut row = rows.into_iter().find(|d| d.id == id)
        .ok_or_else(|| format!("Document not found: {}", id))?;
    if let Some(v) = args["title"].as_str() { row.title = v.into(); }
    if let Some(v) = args["content"].as_str() { row.content = v.into(); }
    if let Some(v) = args["category"].as_str() { row.category = v.into(); }
    row.updated_at = Utc::now().to_rfc3339();
    knowledge::update(&conn, &row).map_err(|e| e.to_string())?;
    Ok(json!(row))
}

pub fn delete_document(args: Value, state: &McpState) -> Result<Value, String> {
    let id = args["id"].as_str().ok_or("Missing id")?;
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    knowledge::delete(&conn, id).map_err(|e| e.to_string())?;
    Ok(json!({ "deleted": id }))
}
