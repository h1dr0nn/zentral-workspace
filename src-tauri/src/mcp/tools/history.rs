use serde_json::{json, Value};
use crate::persistence::history;
use super::super::McpState;
use super::ToolDef;

pub fn tools() -> Vec<ToolDef> {
    vec![
        ToolDef {
            name: "get_history",
            description: "Get history events with optional filters",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "agent_id":   { "type": "string" },
                    "project_id": { "type": "string" },
                    "type":       { "type": "string", "description": "Event type filter" },
                    "status":     { "type": "string", "description": "Status filter (success/failed/running)" },
                    "limit":      { "type": "integer", "default": 50 },
                    "offset":     { "type": "integer", "default": 0 }
                }
            }),
        },
        ToolDef {
            name: "get_stats",
            description: "Get history statistics (counts by type, status, agent)",
            input_schema: json!({ "type": "object", "properties": {} }),
        },
    ]
}

pub fn get_history(args: Value, state: &McpState) -> Result<Value, String> {
    let agent_id   = args.get("agent_id").and_then(Value::as_str);
    let project_id = args.get("project_id").and_then(Value::as_str);
    let event_type = args.get("type").and_then(Value::as_str);
    let status     = args.get("status").and_then(Value::as_str);
    let limit      = args.get("limit").and_then(Value::as_i64).unwrap_or(50);
    let offset     = args.get("offset").and_then(Value::as_i64).unwrap_or(0);

    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let rows = history::list(&conn, agent_id, project_id, event_type, status, limit, offset)
        .map_err(|e| e.to_string())?;
    Ok(json!(rows))
}

pub fn get_stats(_args: Value, state: &McpState) -> Result<Value, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    let total: i64 = conn.query_row("SELECT COUNT(*) FROM history_events", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;

    let by_status: Vec<(String, i64)> = {
        let mut stmt = conn.prepare("SELECT status, COUNT(*) FROM history_events GROUP BY status")
            .map_err(|e| e.to_string())?;
        let x: Vec<_> = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?)))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        x
    };

    let by_type: Vec<(String, i64)> = {
        let mut stmt = conn.prepare("SELECT type, COUNT(*) FROM history_events GROUP BY type")
            .map_err(|e| e.to_string())?;
        let x: Vec<_> = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?)))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        x
    };

    let by_agent: Vec<(String, i64)> = {
        let mut stmt = conn.prepare("SELECT agent_id, COUNT(*) FROM history_events GROUP BY agent_id ORDER BY COUNT(*) DESC LIMIT 10")
            .map_err(|e| e.to_string())?;
        let x: Vec<_> = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?)))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        x
    };

    Ok(json!({
        "total": total,
        "by_status": by_status,
        "by_type": by_type,
        "by_agent": by_agent
    }))
}
