use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::McpState;
use super::resources;
use super::tools;

// ── JSON-RPC 2.0 types ──────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub id: Option<Value>,
    pub method: String,
    #[serde(default)]
    pub params: Value,
}

#[derive(Debug, Serialize)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    pub id: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<JsonRpcError>,
}

#[derive(Debug, Serialize)]
pub struct JsonRpcError {
    pub code: i32,
    pub message: String,
}

impl JsonRpcResponse {
    pub fn ok(id: Value, result: Value) -> Self {
        Self { jsonrpc: "2.0".into(), id, result: Some(result), error: None }
    }

    pub fn err(id: Value, code: i32, message: impl Into<String>) -> Self {
        Self {
            jsonrpc: "2.0".into(),
            id,
            result: None,
            error: Some(JsonRpcError { code, message: message.into() }),
        }
    }
}

// ── Dispatcher ──────────────────────────────────────────────────────────────

pub fn dispatch(req: JsonRpcRequest, state: &McpState) -> JsonRpcResponse {
    let id = req.id.unwrap_or(Value::Null);

    match req.method.as_str() {
        "initialize" => handle_initialize(id),
        "tools/list" => handle_tools_list(id),
        "tools/call" => handle_tools_call(id, req.params, state),
        "resources/list" => handle_resources_list(id),
        "resources/read" => handle_resources_read(id, req.params, state),
        other => JsonRpcResponse::err(id, -32601, format!("Method not found: {}", other)),
    }
}

fn handle_initialize(id: Value) -> JsonRpcResponse {
    JsonRpcResponse::ok(id, json!({
        "protocolVersion": "2024-11-05",
        "capabilities": {
            "tools": {},
            "resources": {}
        },
        "serverInfo": {
            "name": "zentral",
            "version": "1.0.0"
        }
    }))
}

fn handle_tools_list(id: Value) -> JsonRpcResponse {
    let tool_list: Vec<Value> = tools::all_tools()
        .into_iter()
        .map(|t| json!({
            "name": t.name,
            "description": t.description,
            "inputSchema": t.input_schema
        }))
        .collect();
    JsonRpcResponse::ok(id, json!({ "tools": tool_list }))
}

fn handle_tools_call(id: Value, params: Value, state: &McpState) -> JsonRpcResponse {
    let name = match params.get("name").and_then(Value::as_str) {
        Some(n) => n.to_string(),
        None => return JsonRpcResponse::err(id, -32602, "Missing tool name"),
    };
    let args = params.get("arguments").cloned().unwrap_or(json!({}));

    match tools::call_tool(&name, args, state) {
        Ok(result) => JsonRpcResponse::ok(id, json!({
            "content": [{ "type": "text", "text": result.to_string() }]
        })),
        Err(e) => JsonRpcResponse::err(id, -32603, e),
    }
}

fn handle_resources_list(id: Value) -> JsonRpcResponse {
    let list: Vec<Value> = resources::all_resources()
        .into_iter()
        .map(|r| json!({
            "uri": r.uri,
            "name": r.name,
            "description": r.description,
            "mimeType": "application/json"
        }))
        .collect();
    JsonRpcResponse::ok(id, json!({ "resources": list }))
}

fn handle_resources_read(id: Value, params: Value, state: &McpState) -> JsonRpcResponse {
    let uri = match params.get("uri").and_then(Value::as_str) {
        Some(u) => u.to_string(),
        None => return JsonRpcResponse::err(id, -32602, "Missing uri"),
    };

    match resources::read_resource(&uri, state) {
        Ok(content) => JsonRpcResponse::ok(id, json!({
            "contents": [{
                "uri": uri,
                "mimeType": "application/json",
                "text": content.to_string()
            }]
        })),
        Err(e) => JsonRpcResponse::err(id, -32603, e),
    }
}
