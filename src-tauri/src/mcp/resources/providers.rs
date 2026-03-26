use serde_json::{json, Value};
use crate::persistence::{agents, knowledge, projects, schedules, settings, skills, workflows, history};
use super::super::McpState;

pub fn agents(state: &McpState) -> Result<Value, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let rows = agents::list(&conn).map_err(|e| e.to_string())?;
    Ok(json!(rows))
}

pub fn agent_by_id(id: &str, state: &McpState) -> Result<Value, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    match agents::get(&conn, id).map_err(|e| e.to_string())? {
        Some(row) => Ok(json!(row)),
        None => Err(format!("Agent not found: {}", id)),
    }
}

pub fn projects(state: &McpState) -> Result<Value, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let rows = projects::list(&conn).map_err(|e| e.to_string())?;
    Ok(json!(rows))
}

pub fn active_project(state: &McpState) -> Result<Value, String> {
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

pub fn skills(state: &McpState) -> Result<Value, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let rows = skills::list(&conn).map_err(|e| e.to_string())?;
    Ok(json!(rows))
}

pub fn schedules(state: &McpState) -> Result<Value, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let rows = schedules::list(&conn).map_err(|e| e.to_string())?;
    Ok(json!(rows))
}

pub fn workflows(state: &McpState) -> Result<Value, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let wf_rows = workflows::list(&conn).map_err(|e| e.to_string())?;
    let mut result = Vec::new();
    for wf in wf_rows {
        let steps = workflows::list_steps(&conn, &wf.id).map_err(|e| e.to_string())?;
        result.push(json!({ "workflow": wf, "steps": steps }));
    }
    Ok(json!(result))
}

pub fn knowledge(state: &McpState) -> Result<Value, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let rows = knowledge::list(&conn).map_err(|e| e.to_string())?;
    Ok(json!(rows))
}

pub fn document_by_id(id: &str, state: &McpState) -> Result<Value, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let rows = knowledge::list(&conn).map_err(|e| e.to_string())?;
    rows.into_iter()
        .find(|d| d.id == id)
        .map(|d| json!(d))
        .ok_or_else(|| format!("Document not found: {}", id))
}

pub fn history_recent(state: &McpState) -> Result<Value, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let rows = history::list(&conn, None, None, None, None, 50, 0)
        .map_err(|e| e.to_string())?;
    Ok(json!(rows))
}

pub fn settings(state: &McpState) -> Result<Value, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let map = settings::get_all(&conn).map_err(|e| e.to_string())?;
    Ok(json!(map))
}

pub fn status(state: &McpState) -> Result<Value, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    let agent_count: i64 = conn.query_row("SELECT COUNT(*) FROM agents", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    let online_count: i64 = conn.query_row("SELECT COUNT(*) FROM agents WHERE status = 'online'", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    let schedule_count: i64 = conn.query_row("SELECT COUNT(*) FROM schedules WHERE status = 'active'", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    let project_count: i64 = conn.query_row("SELECT COUNT(*) FROM projects", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;

    let active_project_id = settings::get(&conn, "active_project").map_err(|e| e.to_string())?;
    let active_project = match active_project_id {
        Some(pid) => projects::get(&conn, &pid).map_err(|e| e.to_string())?.map(|p| p.name),
        None => None,
    };

    Ok(json!({
        "agents": { "total": agent_count, "online": online_count },
        "active_schedules": schedule_count,
        "projects": { "total": project_count, "active": active_project },
        "mcp_server": "running"
    }))
}
